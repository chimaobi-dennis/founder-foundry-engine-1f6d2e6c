/** Server side: the composed prompt for a key, from the admin's row. Throws PromptMissingError when it is not set. */
import { composePrompt, promptDef, type PromptRow } from "./prompts.ts";

// deno-lint-ignore no-explicit-any
export async function loadPrompt(admin: any, key: string, vars: Record<string, string> = {}): Promise<string> {
  const def = promptDef(key);
  if (!def) throw new Error(`Unknown prompt key: ${key}`);
  const { data } = await admin.from("ai_system_prompts").select("system_prompt, instructions, examples, is_active").eq("task_type", key).maybeSingle();
  return composePrompt(def, (data ?? null) as PromptRow | null, vars);
}

/** Several prompts at once, as a map. */
// deno-lint-ignore no-explicit-any
export async function loadPrompts(admin: any, keys: string[]): Promise<Record<string, string>> {
  const defs = keys.map((k) => { const d = promptDef(k); if (!d) throw new Error(`Unknown prompt key: ${k}`); return d; });
  const { data } = await admin.from("ai_system_prompts").select("task_type, system_prompt, instructions, examples, is_active").in("task_type", keys);
  const rows = new Map<string, PromptRow>((data ?? []).map((r: PromptRow & { task_type: string }) => [r.task_type, r]));
  const out: Record<string, string> = {};
  for (const d of defs) out[d.key] = composePrompt(d, rows.get(d.key) ?? null);
  return out;
}
