/**
 * The read-back: "your business, as Kinika understands it". Pure helpers
 * shared by the understanding function, the UI and tests. The model drafts;
 * these make it safe, give each line a source and a confidence, and map the
 * approved lines onto the brand record.
 */

export type BusinessKind = "starting" | "running" | "creator" | "other";
export type Confidence = "sure" | "fairly_sure" | "guess";

export const SECTION_KEYS = ["what", "who", "problem", "channels", "voice", "stage"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export interface ReadbackSection {
  key: SectionKey;
  label: string;
  value: string;
  source: string;
  confidence: Confidence;
}

export interface Readback {
  name: string;
  kind: BusinessKind;
  descriptor: string;          // "a neighbourhood bakery", "a cooking creator"
  stage_key: string;           // journey stage Kinika picked
  promise: string;             // one sentence, becomes core_promise
  sections: ReadbackSection[];
  not_known: string[];
  /** Two or three goals that would make sense, as outcomes with a horizon. */
  goals: string[];
}

const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function kindFrom(v: unknown): BusinessKind {
  const s = String(v ?? "").toLowerCase();
  return s === "starting" || s === "running" || s === "creator" ? s : "other";
}

export function confidenceFrom(v: unknown): Confidence {
  const s = String(v ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (s === "sure" || s === "high") return "sure";
  if (s === "fairly_sure" || s === "medium" || s === "likely") return "fairly_sure";
  return "guess";
}

/** Section labels fit the kind of business. */
export function sectionLabels(kind: BusinessKind): Record<SectionKey, string> {
  if (kind === "creator") {
    return { what: "What you make", who: "Your audience", problem: "What they come to you for", channels: "Your platforms", voice: "How you sound", stage: "Where you are now" };
  }
  if (kind === "starting") {
    return { what: "What you want to do", who: "Who it is for", problem: "The problem worth solving", channels: "Where you would reach them", voice: "How you sound", stage: "Where you are now" };
  }
  return { what: "What you sell", who: "Who buys", problem: "The problem you solve", channels: "How people find you", voice: "How you sound", stage: "Where you are now" };
}

/** Make the model's read-back safe: known sections only, bounded, labelled for the kind. */
export function coerceReadback(raw: unknown, stageKeys: string[]): Readback | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = kindFrom(r.kind);
  const labels = sectionLabels(kind);
  const given = new Map<string, Record<string, unknown>>();
  for (const s of Array.isArray(r.sections) ? r.sections : []) {
    const o = (s ?? {}) as Record<string, unknown>;
    const k = clip(o.key, 20).toLowerCase();
    if ((SECTION_KEYS as readonly string[]).includes(k)) given.set(k, o);
  }
  const sections: ReadbackSection[] = [];
  for (const key of SECTION_KEYS) {
    const o = given.get(key);
    const value = clip(o?.value, 400);
    if (!value) continue;
    sections.push({ key, label: labels[key], value, source: clip(o?.source, 60) || "what you said", confidence: confidenceFrom(o?.confidence) });
  }
  if (sections.length < 2) return null;
  const stage = clip(r.stage_key, 40).toLowerCase();
  return {
    name: clip(r.name, 80) || "Your business",
    kind,
    descriptor: clip(r.descriptor, 80),
    stage_key: stageKeys.includes(stage) ? stage : (stageKeys[0] ?? "spark"),
    promise: clip(r.promise, 200),
    sections,
    not_known: (Array.isArray(r.not_known) ? r.not_known : []).map((x) => clip(x, 80)).filter(Boolean).slice(0, 5),
    goals: (Array.isArray(r.goals) ? r.goals : []).map((x) => clip(x, 140)).filter(Boolean).slice(0, 3),
  };
}

/** The approved read-back as brand_dna columns plus per-field provenance. */
export function readbackToDna(rb: Readback): { dna: Record<string, string>; meta: Record<string, { source: string; confidence: Confidence }> } {
  const map: Record<SectionKey, string> = { what: "product_positioning", who: "target_audience", problem: "customer_insight", channels: "campaign_strategy", voice: "brand_voice", stage: "" };
  const dna: Record<string, string> = {};
  const meta: Record<string, { source: string; confidence: Confidence }> = {};
  for (const s of rb.sections) {
    const col = map[s.key];
    if (!col) continue;
    dna[col] = s.value;
    meta[col] = { source: s.source, confidence: s.confidence };
  }
  if (rb.promise) { dna.core_promise = rb.promise; meta.core_promise = { source: "Kinika's reading", confidence: "fairly_sure" }; }
  if (rb.descriptor) dna.positioning_statement = `${rb.name}: ${rb.descriptor}`;
  return { dna, meta };
}

/** The instruction for the read-back. Admins can override it in ai_system_prompts (task_type understanding). */
export function understandingSystemPrompt(stageKeys: string[]): string {
  return [
    "You are Kinika, a business manager meeting a new business. From what the founder wrote and any website, documents or past conversation given, write back the business the way a good new employee would describe it on day one: specific, plain, no praise, no invented facts.",
    "Decide the kind: starting (an idea, no customers), running (a business with customers), creator (an audience on platforms), other.",
    "Fill these sections when you have something to say, in one to three sentences each, in the founder's language: what (what they sell, make, or want to do), who (who buys or follows), problem (what people come to them for), channels (how people find them), voice (how they sound), stage (where the business is now and what the next stage is).",
    'For every section give "source" (a few words: "what you said", "site", "Instagram", "deck") and "confidence": "sure" when two sources agree or the founder said it, "fairly_sure" when one source implies it, "guess" when you inferred it. Leave a section out rather than guess twice.',
    `Pick stage_key from: ${stageKeys.join(", ")}.`,
    "List under not_known the two to five things you would need next (prices, whether they deliver, what they tried) that nothing told you.",
    "Under goals, suggest three goals this business could set for the next few months, each an outcome in one sentence with a horizon (\"Fill the quiet weekdays with office orders in about three months\"), drawn from what you read, never generic.",
    'Return ONLY a JSON object: { "name": "...", "kind": "starting|running|creator|other", "descriptor": "a neighbourhood bakery", "stage_key": "...", "promise": "one sentence of what they promise customers", "sections": [ { "key": "what", "value": "...", "source": "...", "confidence": "sure|fairly_sure|guess" } ], "not_known": ["..."], "goals": ["...", "...", "..."] }',
  ].join("\n\n");
}
