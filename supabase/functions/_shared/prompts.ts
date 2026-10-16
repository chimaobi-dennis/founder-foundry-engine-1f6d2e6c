/**
 * The prompt registry: every prompt Kinika or an agent runs on, by key, with
 * its code default. Admins override the base text, append instructions and
 * attach examples in ai_system_prompts; `composePrompt` puts them together.
 * Pure module: used by the edge functions and, through @shared, by the admin page.
 */
import { planSystemPrompt } from "./plan.ts";
import { understandingSystemPrompt } from "./understanding.ts";
import { selfReviewInstruction } from "./runner.ts";
import { DEFAULT_TASK_RULES, DEFAULT_TASK_FOLLOWUPS, STATE_CONTRACT } from "./taskChat.ts";

export interface PromptExample { input: string; output: string; note?: string }

export interface PromptRow {
  system_prompt?: string | null;
  instructions?: string | null;
  examples?: PromptExample[] | null;
  is_active?: boolean | null;
  version?: number | null;
  updated_at?: string | null;
}

export interface PromptDef {
  key: string;
  name: string;
  /** What this prompt does, for the admin. */
  description: string;
  /** Where it runs. */
  usedBy: string;
  /** Group on the admin page. */
  group: "Kinika" | "Workspace" | "Agents" | "Studio";
  /** The gateway task type whose routing this prompt runs on (for the model flow). */
  taskType: string;
  /** Placeholders the default uses, with sample values for the preview. */
  variables?: Record<string, string>;
  /** A machine contract appended after the editable text; shown read-only. */
  contract?: string;
  /** The code default, with {{placeholders}} unresolved. */
  defaultText: () => string;
}

export const PROMPT_REGISTRY: PromptDef[] = [
  {
    key: "understanding", name: "Understanding (the read-back)", group: "Kinika", taskType: "understanding",
    description: "Reads what a founder said, their site and documents, and writes the business back under headings with a source and confidence per line.",
    usedBy: "First run, step 3 (understanding function)",
    variables: { stage_keys: "spark, shape, validate, brand, launch, grow" },
    defaultText: () => understandingSystemPrompt(["{{stage_keys}}"]).replace("Pick stage_key from: {{stage_keys}}.", "Pick stage_key from: {{stage_keys}}."),
  },
  {
    key: "plan_build", name: "Plan builder", group: "Kinika", taskType: "plan_build",
    description: "Writes or revises the founder's plan: targets, tasks, who does each, from the brand context and the goal.",
    usedBy: "First run step 5, Revise with Kinika, milestone and stage revisions (founder-plan, runner)",
    defaultText: () => planSystemPrompt(),
  },
  {
    key: "mentor_chat", name: "Kinika page conversation", group: "Kinika", taskType: "mentor_chat",
    description: "The plan-level conversation with Kinika: knows the brand record, the stage, and the plan; may edit the plan with PLAN_EDIT ops.",
    usedBy: "The Kinika page (mentor chat)",
    variables: { brand_name: "Växjö Bageri", journey_stage: "shape", brand_voice: "warm, plain", positioning_statement: "", target_audience: "", core_promise: "", stage_focus: "", current_substages: "", next_uncaptured_substage: "", stage_field_keys: "", industry: "", brand_references: "", campaign_strategy: "", customer_insight: "" },
    defaultText: () => "You are Kinika, the business manager of {{brand_name}}: direct, warm, concrete, never a pronoun for yourself. You know the business from its record and the plan, you ask one sharp question at a time, and you never invent numbers the record does not give. Current stage: {{journey_stage}}. {{stage_focus}}",
  },
  {
    key: "project_title", name: "Project title", group: "Kinika", taskType: "mentor_chat",
    description: "Names an untitled workspace from the founder's first exchange: exactly three words.",
    usedBy: "Kinika page, first substantive message",
    defaultText: () => "You generate short, descriptive project titles. You receive a founder's first message and the mentor's response. You output exactly 3 words that capture the essence of what is being built. \n\nRules:\n- Exactly 3 words. Never more, never less.\n- Each word starts with a capital letter\n- No punctuation\n- No generic words like \"The\", \"A\", \"An\", \"My\", \"New\"\n- Should sound like a real product or company name\n- Examples: \"Smart Founder OS\", \"Origin Brand Platform\", \"Solo Architect Tool\", \"Nordic Wellness App\", \"Legal Doc Engine\"\n- Output only the 3 words. Nothing else.",
  },
  {
    key: "task_breakdown", name: "Task breakdown (deliverables)", group: "Workspace", taskType: "task_breakdown",
    description: "Breaks a founder task on the plan into the 2 to 5 deliverables that complete it.",
    usedBy: "Opening a founder task in the workspace (founder-plan, action breakdown)",
    contract: 'Respond with JSON only: {"deliverables":[{"title":"short name of the thing","detail":"one sentence: what done looks like","kind":"decision"|"document"|"list"|"action"}]}',
    defaultText: () => [
      "You are Kinika, the manager of a founder's business. A task on the founder's plan is about to be worked with the founder in a workspace. Break it into the deliverables that, once done, make the task complete.",
      "Rules: 2 to 5 deliverables, each a concrete thing the founder will have at the end (a decision made, a document written, a list, an action taken). No vague steps like 'think about'. Name real numbers only when the context gives them; otherwise the deliverable is the decision itself.",
    ].join("\n"),
  },
  {
    key: "task_chat", name: "Task conversation (Kinika's voice)", group: "Workspace", taskType: "task_chat",
    description: "Who Kinika is while working one task with the founder. The brand context, the plan and the task block are appended by the function.",
    usedBy: "The task workspace conversation (task-chat function)",
    variables: { brand_name: "Växjö Bageri" },
    defaultText: () => "You are Kinika, the business manager of {{brand_name}}: direct, warm, concrete, never a pronoun for yourself. You know the business from its record and you never invent numbers it does not give you.",
  },
  {
    key: "task_chat_rules", name: "Task conversation: how to work", group: "Workspace", taskType: "task_chat",
    description: "The working rules for a task: one question at a time, documents without placeholders, nobody in the room but Kinika and the founder, needs raised instead of invented people.",
    usedBy: "Appended to every task-chat turn after the task and its deliverables",
    contract: STATE_CONTRACT,
    defaultText: () => DEFAULT_TASK_RULES,
  },
  {
    key: "task_chat_followups", name: "Task conversation: follow-ups", group: "Workspace", taskType: "task_chat",
    description: "How Kinika writes the three suggested replies and, for a choice question, the options the founder can click.",
    usedBy: "The state line of every task-chat turn",
    defaultText: () => DEFAULT_TASK_FOLLOWUPS,
  },
  {
    key: "agent_self_review", name: "Agent self-review", group: "Agents", taskType: "tier_fast",
    description: "A creative agent checks its own draft against the brand before the founder sees it (fast, uncharged).",
    usedBy: "Runner, creative agents (Copywriter, Designer)",
    defaultText: () => selfReviewInstruction(),
  },
  {
    key: "agent_revision", name: "Agent revision round", group: "Agents", taskType: "tier_standard",
    description: "What an agent is told when the founder sends a result back for changes.",
    usedBy: "Runner, after 'Send back for changes'",
    variables: { round: "2", note: "Shorter. Lead with the weekday offer." },
    defaultText: () => [
      "REVISION, ROUND {{round}}. The founder reviewed your previous result and sent it back with this note:",
      '"{{note}}"',
      "Change what the note asks for and keep everything else as it was. Do not start over. Return the complete revised result in the same JSON shape.",
    ].join("\n"),
  },
  { key: "campaign_copy", name: "CampaignKit copy", group: "Studio", taskType: "campaign_copy", description: "Campaign copy from a brief.", usedBy: "CampaignKit", defaultText: () => "" },
  { key: "template_generation", name: "Studio templates", group: "Studio", taskType: "template_generation", description: "Designs as editable scenes.", usedBy: "ProStudio", defaultText: () => "" },
  { key: "document_generation", name: "Documents", group: "Studio", taskType: "document_generation", description: "Reports, briefs and one-pagers.", usedBy: "DocStudio", defaultText: () => "" },
  { key: "reel_script", name: "Reel scripts", group: "Studio", taskType: "reel_script", description: "Short video scripts.", usedBy: "ReelBuilder", defaultText: () => "" },
  { key: "context_extraction", name: "Context extraction", group: "Studio", taskType: "context_extraction", description: "Pulls brand facts out of pasted material.", usedBy: "Brand record", defaultText: () => "" },
  { key: "variant_scene_generation", name: "Scene variants", group: "Studio", taskType: "template_generation", description: "Variations of a scene.", usedBy: "VariantStudio", defaultText: () => "" },
];

export function promptDef(key: string): PromptDef | undefined {
  return PROMPT_REGISTRY.find((d) => d.key === key);
}

export function fillVars(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{{${k}}}`).join(v);
  return out;
}

/** Base (override or default) + admin instructions + examples + the contract, with variables filled. */
export function composePrompt(def: PromptDef, row: PromptRow | null | undefined, vars: Record<string, string> = {}): string {
  const base = (row?.is_active !== false && row?.system_prompt?.trim()) ? row.system_prompt.trim() : def.defaultText();
  const parts = [fillVars(base, vars)];
  const ins = row?.instructions?.trim();
  if (ins) parts.push(`FURTHER INSTRUCTIONS FROM THE ADMIN (these take precedence):\n${fillVars(ins, vars)}`);
  const ex = (row?.examples ?? []).filter((e) => e && (e.input?.trim() || e.output?.trim())).slice(0, 8);
  if (ex.length) parts.push(`EXAMPLES OF GOOD WORK (match their quality and shape, not their content):\n` + ex.map((e, i) => `Example ${i + 1}${e.note ? ` (${e.note})` : ""}:\nInput: ${e.input?.trim() ?? ""}\nOutput: ${e.output?.trim() ?? ""}`).join("\n\n"));
  if (def.contract) parts.push(def.contract);
  return parts.join("\n\n");
}
