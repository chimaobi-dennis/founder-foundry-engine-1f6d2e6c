/**
 * Provider adapters for the ai-gateway. Each adapter turns a normalized
 * request into one provider call and returns text + normalized usage.
 * Streaming adapters emit text deltas through `onChunk` and resolve with the
 * full text and usage when the stream ends.
 */
import { normalizeUsage, type TokenUsage, EMPTY_USAGE } from "./pricing.ts";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface ProviderRequest {
  modelId: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  maxTokens: number;
  temperature?: number;
  imageBase64?: string;
  imageMimeType?: string;
  /** Mark the system prompt and the first user message as cacheable. */
  cacheContext?: boolean;
  stream?: boolean;
  onChunk?: (text: string) => void;
  signal?: AbortSignal;
}

export interface ProviderResponse {
  text: string;
  usage: TokenUsage;
  raw?: unknown;
}

export interface ProviderConfig {
  slug: string;
  base_url: string;
  auth_header_name: string;
  auth_header_prefix: string;
  apiKey: string;
}

export class ProviderError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export type ProviderKind = "anthropic" | "google" | "openai";

export function providerKind(slug: string): ProviderKind {
  if (slug === "anthropic") return "anthropic";
  if (slug === "google-ai-studio" || slug === "google") return "google";
  return "openai";
}

/** Text of a message regardless of shape. */
function textOf(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n");
  }
  return content == null ? "" : JSON.stringify(content);
}

/** Read an SSE stream and call `onEvent` with each parsed `data:` JSON payload. */
async function readSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (data: any) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trimEnd();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        onEvent(JSON.parse(payload));
      } catch {
        // partial or non-JSON line; ignore
      }
    }
  }
}

// ── Anthropic ────────────────────────────────────────────────────────────────

export async function callAnthropic(cfg: ProviderConfig, req: ProviderRequest): Promise<ProviderResponse> {
  const system = req.systemPrompt
    ? [{ type: "text", text: req.systemPrompt, ...(req.cacheContext ? { cache_control: { type: "ephemeral" } } : {}) }]
    : undefined;

  const messages = req.messages
    .filter((m) => m.role !== "system")
    .map((m, i) => {
      const text = textOf(m.content);
      const blocks: any[] = [{ type: "text", text }];
      if (i === 0 && req.cacheContext && text.length > 500) {
        blocks[0].cache_control = { type: "ephemeral" };
      }
      return { role: m.role, content: blocks };
    });

  if (req.imageBase64 && messages.length) {
    const last = messages[messages.length - 1];
    if (last.role === "user") {
      last.content.unshift({
        type: "image",
        source: { type: "base64", media_type: req.imageMimeType ?? "image/jpeg", data: req.imageBase64 },
      });
    }
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: req.signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: req.modelId,
      max_tokens: req.maxTokens,
      system,
      messages,
      stream: !!req.stream,
      ...(req.temperature != null ? { temperature: req.temperature } : {}),
    }),
  });

  if (!res.ok) {
    const err = await safeJson(res);
    throw new ProviderError(err?.error?.message ?? `Anthropic error ${res.status}`, res.status);
  }

  if (!req.stream) {
    const data = await res.json();
    const text = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    return { text, usage: normalizeUsage("anthropic", data.usage), raw: data };
  }

  let text = "";
  let usage: TokenUsage = { ...EMPTY_USAGE };
  await readSse(res.body!, (ev) => {
    if (ev.type === "message_start" && ev.message?.usage) {
      usage = normalizeUsage("anthropic", ev.message.usage);
    } else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
      text += ev.delta.text;
      req.onChunk?.(ev.delta.text);
    } else if (ev.type === "message_delta" && ev.usage) {
      usage.output_tokens = ev.usage.output_tokens ?? usage.output_tokens;
    } else if (ev.type === "error") {
      throw new ProviderError(ev.error?.message ?? "Anthropic stream error");
    }
  });
  return { text, usage };
}

// ── Google AI Studio ─────────────────────────────────────────────────────────

export async function callGoogle(cfg: ProviderConfig, req: ProviderRequest): Promise<ProviderResponse> {
  // Google needs strict user/model alternation and no empty parts.
  const contents: Array<{ role: "user" | "model"; parts: any[] }> = [];
  for (const m of req.messages) {
    if (m.role === "system") continue;
    const text = textOf(m.content).trim();
    if (!text) continue;
    const role = m.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0].text += "\n" + text;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }
  while (contents.length && contents[0].role === "model") contents.shift();
  if (!contents.length) throw new ProviderError("No valid messages to send", 400);

  if (req.imageBase64) {
    const last = contents[contents.length - 1];
    if (last.role === "user") {
      last.parts.unshift({ inlineData: { mimeType: req.imageMimeType ?? "image/jpeg", data: req.imageBase64 } });
    }
  }

  // Accept a bare host or a versioned base from the provider row.
  let base = (cfg.base_url || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  if (!/\/v1(beta)?$/.test(base)) base += "/v1beta";
  const method = req.stream ? "streamGenerateContent?alt=sse" : "generateContent";
  const url = `${base}/models/${encodeURIComponent(req.modelId)}:${method}`;

  const res = await fetch(url, {
    method: "POST",
    signal: req.signal,
    headers: { "content-type": "application/json", "x-goog-api-key": cfg.apiKey },
    body: JSON.stringify({
      contents,
      ...(req.systemPrompt ? { systemInstruction: { parts: [{ text: req.systemPrompt }] } } : {}),
      generationConfig: { maxOutputTokens: req.maxTokens, temperature: req.temperature ?? 0.8 },
    }),
  });

  if (!res.ok) {
    const err = await safeJson(res);
    throw new ProviderError(err?.error?.message ?? `Google AI error ${res.status}`, res.status);
  }

  const extract = (data: any) =>
    (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");

  if (!req.stream) {
    const data = await res.json();
    const text = extract(data);
    if (!text) {
      // Usually the output budget was spent on thinking: say so in the log.
      const reason = data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason ?? "unknown";
      throw new ProviderError(`Google AI returned an empty response (finishReason=${reason}; raise maxTokens if MAX_TOKENS)`);
    }
    return { text, usage: normalizeUsage("google", data.usageMetadata), raw: data };
  }

  let text = "";
  let usageRaw: any = null;
  await readSse(res.body!, (ev) => {
    const piece = extract(ev);
    if (piece) {
      text += piece;
      req.onChunk?.(piece);
    }
    if (ev.usageMetadata) usageRaw = ev.usageMetadata;
  });
  return { text, usage: normalizeUsage("google", usageRaw) };
}

// ── OpenAI-compatible (OpenAI, DeepInfra, Together, Lovable gateway, …) ──────

export async function callOpenAICompatible(cfg: ProviderConfig, req: ProviderRequest): Promise<ProviderResponse> {
  const messages: any[] = req.messages.map((m) => ({ role: m.role, content: m.content }));
  if (req.systemPrompt) messages.unshift({ role: "system", content: req.systemPrompt });

  if (req.imageBase64 && messages.length) {
    const last = messages[messages.length - 1];
    if (last.role === "user") {
      last.content = [
        { type: "image_url", image_url: { url: `data:${req.imageMimeType ?? "image/jpeg"};base64,${req.imageBase64}` } },
        { type: "text", text: textOf(last.content) },
      ];
    }
  }

  // Normalize any non-string, non-array content so the API never sees objects.
  for (const m of messages) {
    if (typeof m.content !== "string" && !Array.isArray(m.content)) m.content = JSON.stringify(m.content);
  }

  const headerName = cfg.auth_header_name || "Authorization";
  const headerValue = cfg.auth_header_prefix ? `${cfg.auth_header_prefix} ${cfg.apiKey}` : cfg.apiKey;
  const base = cfg.base_url.replace(/\/$/, "");
  const maxTokensKey = cfg.slug === "openai" ? "max_completion_tokens" : "max_tokens";

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal: req.signal,
    headers: { "content-type": "application/json", [headerName]: headerValue },
    body: JSON.stringify({
      model: req.modelId,
      messages,
      [maxTokensKey]: req.maxTokens,
      ...(req.temperature != null ? { temperature: req.temperature } : {}),
      ...(req.stream ? { stream: true, stream_options: { include_usage: true } } : {}),
    }),
  });

  if (!res.ok) {
    const err = await safeJson(res);
    throw new ProviderError(err?.error?.message ?? `${cfg.slug} error ${res.status}`, res.status);
  }

  if (!req.stream) {
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return { text, usage: normalizeUsage("openai", data.usage), raw: data };
  }

  let text = "";
  let usageRaw: any = null;
  await readSse(res.body!, (ev) => {
    const piece = ev.choices?.[0]?.delta?.content;
    if (typeof piece === "string" && piece) {
      text += piece;
      req.onChunk?.(piece);
    }
    if (ev.usage) usageRaw = ev.usage;
  });
  return { text, usage: normalizeUsage("openai", usageRaw) };
}

export async function callProvider(cfg: ProviderConfig, req: ProviderRequest): Promise<ProviderResponse> {
  switch (providerKind(cfg.slug)) {
    case "anthropic":
      return callAnthropic(cfg, req);
    case "google":
      return callGoogle(cfg, req);
    default:
      return callOpenAICompatible(cfg, req);
  }
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
