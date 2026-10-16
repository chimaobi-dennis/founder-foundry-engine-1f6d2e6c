/** Server side: the composed prompt for a key, from the registry default and the admin's row. */
import { composePrompt, promptDef, type PromptRow } from "./prompts.ts";

// deno-lint-ignore no-explicit-any
export async function loadPrompt(admin: any, key: string, vars: Record<string, string> = {}): Promise<string> {
  const def = promptDef(key);
  if (!def) throw new Error(`Unknown prompt key: ${key}`);
  const { data } = await admin.from("ai_system_prompts").select("system_prompt, instructions, examples, is_active").eq("task_type", key).maybeSingle();
  return composePrompt(def, (data ?? null) as PromptRow | null, vars);
}
