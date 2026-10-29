/**
 * The prompt registry: every prompt Kinika or an agent runs on, by key. Only
 * metadata lives here (name, where it runs, the task type it is routed on,
 * placeholders). The text itself lives in ai_system_prompts and is managed
 * in Admin → Prompts; the seed migration put the first version there. No
 * prompt text is kept in code: a missing row is an error, not a fallback.
 * Pure module: used by the edge functions and, through @shared, by the admin page.
 */

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
  description: string;
  /** Where it runs. */
  usedBy: string;
  group: "Kinika" | "Workspace" | "Agents" | "Studio";
  /** The gateway task type whose routing this prompt runs on (for the model flow). */
  taskType: string;
  /** Placeholders the text uses, with sample values for the preview. */
  variables?: Record<string, string>;
  /** Code that reads the answer depends on this text's shape; edit with care. */
  fixed?: boolean;
}

export const PROMPT_REGISTRY: PromptDef[] = [
  { key: "understanding", name: "Understanding (the read-back)", group: "Kinika", taskType: "understanding", description: "Reads what a founder said, their site and documents, and writes the business back under headings with a source and confidence per line.", usedBy: "First run step 3 (understanding function)", variables: {"stage_keys": "spark, shape, validate, brand, launch, grow"} },
  { key: "understanding_retry", name: "Understanding: retry", group: "Kinika", taskType: "understanding", description: "What Kinika is told when its first read-back was not usable JSON.", usedBy: "understanding function, second attempt" },
  { key: "respond_json_only", name: "JSON-only closing line", group: "Kinika", taskType: "understanding", description: "The last line of every structured request.", usedBy: "understanding, plan builder, breakdown, agents", fixed: true },
  { key: "plan_build", name: "Plan builder", group: "Kinika", taskType: "plan_build", description: "Writes or revises the founder's plan: targets, tasks, who does each.", usedBy: "First run step 5, Revise with Kinika, milestone and stage revisions" },
  { key: "plan_goal_rule", name: "Plan builder: the goal", group: "Kinika", taskType: "plan_build", description: "How the founder's goal is put to the plan builder.", usedBy: "Plan builder, when a goal exists", variables: {"goal": "Steadier weekday sales", "horizon": " (About 3 months)"} },
  { key: "plan_agents_rule", name: "Plan builder: the agents", group: "Kinika", taskType: "plan_build", description: "How the roster is listed for the plan builder.", usedBy: "Plan builder", variables: {"agents": "- copywriter: Copywriter. Captions, posts and emails. (available to hire)"} },
  { key: "plan_playbook_auto", name: "Plan builder: playbooks (Kinika decides)", group: "Kinika", taskType: "plan_build", description: "The playbook list when the founder let Kinika choose.", usedBy: "Plan builder, first build", variables: {"playbooks": "- idea (a founder with an idea and no customers yet): Validate the problem with 10 conversations; …"} },
  { key: "plan_playbook_chosen", name: "Plan builder: a chosen playbook", group: "Kinika", taskType: "plan_build", description: "The playbook block when the founder picked one.", usedBy: "Plan builder, Start over with a playbook", variables: {"label": "Grow a running business", "who": "a business with customers and revenue", "targets": "- Find the step where most prospects drop and fix it", "choice": "running"} },
  { key: "mentor_chat", name: "Kinika page conversation", group: "Kinika", taskType: "mentor_chat", description: "The plan-level conversation with Kinika on the Kinika page.", usedBy: "The Kinika page", variables: {"brand_name": "Växjö Bageri", "journey_stage": "shape", "brand_voice": "warm, plain", "positioning_statement": "", "target_audience": "", "core_promise": "", "stage_focus": "", "current_substages": "", "next_uncaptured_substage": "", "stage_field_keys": "", "industry": "", "brand_references": "", "campaign_strategy": "", "customer_insight": ""} },
  { key: "mentor_context_note", name: "Kinika page: first reply after shared context", group: "Kinika", taskType: "mentor_chat", description: "Added to the first reply when the founder shared prior material.", usedBy: "The Kinika page, first exchange" },
  { key: "mentor_plan_edit", name: "Kinika page: editing the plan from the conversation", group: "Kinika", taskType: "mentor_chat", description: "How Kinika sees the plan and the PLAN_EDIT block it may append.", usedBy: "The Kinika page, every turn with a plan", variables: {"title": "Launch", "plan": "1. Validate [current]\n   - Talk to 10 customers [todo]"}, fixed: true },
  { key: "mentor_milestone_detect", name: "Milestone detection (system)", group: "Kinika", taskType: "mentor_chat", description: "Decides whether a conversation shifted enough for a milestone.", usedBy: "The Kinika page, after a reply" },
  { key: "mentor_milestone_detect_user", name: "Milestone detection (request)", group: "Kinika", taskType: "mentor_chat", description: "The request sent with the recent messages.", usedBy: "The Kinika page, after a reply", variables: {"existing": "Brand Discovery", "messages": "user: …\nassistant: …"}, fixed: true },
  { key: "project_title", name: "Project title", group: "Kinika", taskType: "mentor_chat", description: "Names an untitled workspace from the first exchange.", usedBy: "The Kinika page, first substantive message" },
  { key: "lovable_prompt", name: "Lovable prompt generator", group: "Kinika", taskType: "mentor_chat", description: "Turns a conversation into a prompt for an app builder.", usedBy: "The Kinika page, Generate Lovable prompt" },
  { key: "task_breakdown", name: "Task breakdown (deliverables)", group: "Workspace", taskType: "task_breakdown", description: "Breaks a founder task into the 2 to 5 deliverables that complete it.", usedBy: "Opening a founder task (founder-plan, breakdown)" },
  { key: "task_chat", name: "Task conversation: Kinika's voice", group: "Workspace", taskType: "task_chat", description: "Who Kinika is while working one task.", usedBy: "Task workspace, every turn", variables: {"brand_name": "Växjö Bageri"} },
  { key: "task_chat_intro", name: "Task conversation: the task and its deliverables", group: "Workspace", taskType: "task_chat", description: "How the task and the numbered deliverables are presented.", usedBy: "Task workspace, every turn", variables: {"task": "Define pricing tiers (target: Finalize the deal structure)", "deliverables": "D1 [open] Pricing tiers document (document): …"}, fixed: true },
  { key: "task_chat_rules", name: "Task conversation: how to work", group: "Workspace", taskType: "task_chat", description: "One question at a time, documents without placeholders, nobody in the room, needs raised instead of invented people.", usedBy: "Task workspace, every turn" },
  { key: "task_chat_contract", name: "Task conversation: the state line (contract)", group: "Workspace", taskType: "task_chat", description: "The machine line the workspace parses: closed deliverables, suggestions, options, needs.", usedBy: "Task workspace, every turn", fixed: true },
  { key: "task_chat_followups", name: "Task conversation: follow-ups", group: "Workspace", taskType: "task_chat", description: "How the three suggested replies and the clickable options are written.", usedBy: "Task workspace, every turn" },
  { key: "task_chat_open", name: "Task conversation: opening turn", group: "Workspace", taskType: "task_chat", description: "What Kinika is asked when the workspace opens with fresh deliverables.", usedBy: "Task workspace, first turn" },
  { key: "task_chat_write_down", name: "Task conversation: write the outcome down", group: "Workspace", taskType: "task_chat", description: "Sent when the founder asks Kinika to record a deliverable's outcome.", usedBy: "Deliverable sheet", variables: {"n": "2", "title": "Vesting terms decision"} },
  { key: "task_chat_brief_request", name: "Task conversation: brief for an outside person", group: "Workspace", taskType: "task_chat", description: "Sent when the founder asks Kinika to write the brief for a specialist.", usedBy: "Needs card, door 3", variables: {"label": "Legal drafter", "title": "Agreement outline"} },
  { key: "agent_task_prompt", name: "Agent task request", group: "Agents", taskType: "tier_standard", description: "How a brief is put to any agent.", usedBy: "Runner, every agent step", variables: {"brief": "Three captions for the weekday lunch offer", "units": "3", "unit_label": "captions", "platforms": "instagram", "extra": ""}, fixed: true },
  { key: "agent_self_review", name: "Agent self-review", group: "Agents", taskType: "tier_fast", description: "A creative agent checks its own draft against the brand before the founder sees it.", usedBy: "Runner, creative agents" },
  { key: "agent_revision", name: "Agent revision round", group: "Agents", taskType: "tier_standard", description: "What an agent is told after Send back for changes.", usedBy: "Runner", variables: {"round": "2", "note": "Shorter. Lead with the weekday offer."} },
  { key: "agent_handoff", name: "Hive hand-off", group: "Agents", taskType: "tier_standard", description: "How one agent's output is handed to the next in a hive.", usedBy: "Runner, hives", variables: {"name": "Researcher", "role": "Researcher"} },
  { key: "agent_records_mode", name: "Records mode (data connections)", group: "Agents", taskType: "tier_standard", description: "Fields an agent may change on connected records.", usedBy: "Runner, data recipes", variables: {"allowed": "title, description", "count": "12"}, fixed: true },
  { key: "agent_plan_mode", name: "Code change: plan mode", group: "Agents", taskType: "tier_standard", description: "The Developer plans a change before editing.", usedBy: "Runner, Developer", variables: {"count": "40", "truncated": ""}, fixed: true },
  { key: "agent_edit_mode", name: "Code change: edit mode", group: "Agents", taskType: "tier_standard", description: "The Developer edits files within writable paths.", usedBy: "Runner, Developer", variables: {"allowed": "src/, public/"}, fixed: true },
  { key: "agent_blog_shape", name: "Blog post shape", group: "Agents", taskType: "tier_standard", description: "Output shape for a blog draft.", usedBy: "Runner, blog recipe", fixed: true },
  { key: "automation_planner", name: "Describe-it planner", group: "Agents", taskType: "plan_automation", description: "Turns a founder's request into one plan for the team: task, hive or recipe.", usedBy: "Kinika's team, Describe it", variables: {"agents": "- copywriter: Copywriter (captions). Captions, posts and emails.", "recipes": "- seo_refresh: SEO refresh (needs a shopify connection; agent seo_specialist)", "connections": "(none)", "boards": "(none yet)"}, fixed: true },
  { key: "run_branch", name: "Board branch: which way?", group: "Agents", taskType: "tier_fast", description: "Kinika decides which branch of a board applies to what arrived.", usedBy: "Runner, branch step", fixed: true },
  { key: "kinika_boards", name: "Kinika: the boards as tools", group: "Kinika", taskType: "mentor_chat", description: "The standing boards on the team, and the RUN_BOARD block Kinika appends to start one from a conversation.", usedBy: "Task conversations (task-chat) and the Kinika page, every turn with an active board", variables: {"boards": "- 2f1c…: \"Weekly newsletter\" (Copywriter) — Draft the week's newsletter from what happened"}, fixed: true },
  { key: "plan_board", name: "Set up: the board for a plan task", group: "Workspace", taskType: "plan_automation", description: "When the founder presses Set up on a task, proposes the board: the plan draft, the role, one clarifying question only where the design forks, and what must be connected.", usedBy: "Set up dialog (founder-plan action plan_board)", variables: {"agents": "- copywriter: Copywriter (captions). Captions, posts and emails.", "recipes": "- seo_refresh: SEO refresh (needs a shopify connection; agent seo_specialist)", "connections": "(none)", "boards": "(none yet)"}, fixed: true },
  { key: "campaign_copy_platform", name: "CampaignKit: one platform's copy", group: "Studio", taskType: "campaign_copy", description: "Copy for one platform from a campaign brief.", usedBy: "CampaignKit", variables: {"platform": "Instagram caption", "brand": "Växjö Bageri", "audience": "", "goal": "", "benefit": "", "tone": "", "cta": "", "voice": "", "positioning": "", "insight": ""}, fixed: true },
  { key: "campaign_copy", name: "CampaignKit copy", group: "Studio", taskType: "campaign_copy", description: "Campaign copy from a brief.", usedBy: "CampaignKit" },
  { key: "template_generation", name: "Studio templates", group: "Studio", taskType: "template_generation", description: "Designs as editable scenes.", usedBy: "ProStudio" },
  { key: "document_generation", name: "Documents", group: "Studio", taskType: "document_generation", description: "Reports, briefs and one-pagers.", usedBy: "DocStudio" },
  { key: "reel_script", name: "Reel scripts", group: "Studio", taskType: "reel_script", description: "Short video scripts.", usedBy: "ReelBuilder" },
  { key: "context_extraction", name: "Context extraction", group: "Studio", taskType: "context_extraction", description: "Pulls brand facts out of pasted material.", usedBy: "Brand record" },
  { key: "variant_scene_generation", name: "Scene variants", group: "Studio", taskType: "template_generation", description: "Variations of a scene.", usedBy: "VariantStudio" },
  { key: "campaign_copy_request", name: "CampaignKit: request line", group: "Studio", taskType: "campaign_copy", description: "The user turn that asks for all platforms at once.", usedBy: "CampaignKit" },
  { key: "campaign_copy_platform_request", name: "CampaignKit: one platform request line", group: "Studio", taskType: "campaign_copy", description: "The user turn for one platform.", usedBy: "CampaignKit", variables: {"platform": "instagram"} },
  { key: "logo_generation", name: "LogoStudio: generate", group: "Studio", taskType: "logo_generation", description: "A logo concept as a scene.", usedBy: "LogoStudio", fixed: true },
  { key: "logo_mutation", name: "LogoStudio: mutate", group: "Studio", taskType: "logo_mutation", description: "A change to an existing logo scene.", usedBy: "LogoStudio", fixed: true },
  { key: "logo_generation_request", name: "LogoStudio: request line", group: "Studio", taskType: "logo_generation", description: "The user turn per variant.", usedBy: "LogoStudio", variables: {"index": "1"} },
  { key: "logo_mutation_request", name: "LogoStudio: mutation request line", group: "Studio", taskType: "logo_mutation", description: "The user turn carrying the requested change.", usedBy: "LogoStudio", variables: {"change": "Make the mark bolder"} },
  { key: "scene_json_contract", name: "Scene JSON output contract", group: "Studio", taskType: "template_generation", description: "How a design must be returned as a SceneDocument.", usedBy: "ProStudio, ContentStudio, LogoStudio (scene mode)", variables: {"width": "1080", "height": "1350", "max_nodes": "60", "max_depth": "3"}, fixed: true },
  { key: "template_scene_contract", name: "ContentStudio: copy + scene output contract", group: "Studio", taskType: "template_generation", description: "The mandatory JSON structure for copy and scenes per platform.", usedBy: "ContentStudio generation", variables: {"template": "{ ... }"}, fixed: true },
  { key: "brand_continuity_rules", name: "Brand continuity rules", group: "Studio", taskType: "template_generation", description: "Appended to studio generations: continue the brand system, avoid repetition.", usedBy: "ProStudio, ContentStudio (founder intelligence context)" },
  { key: "project_title_request", name: "Project title: request line", group: "Kinika", taskType: "mentor_chat", description: "The user turn with the first exchange.", usedBy: "The Kinika page", variables: {"first": "…", "reply": "…"} },
  { key: "lovable_prompt_request", name: "Lovable prompt: request line", group: "Kinika", taskType: "mentor_chat", description: "The user turn with the conversation context.", usedBy: "The Kinika page", variables: {"brand": "Växjö Bageri", "context": "…"} },
  { key: "template_content_rule", name: "ProStudio: use the given content", group: "Studio", taskType: "template_generation", description: "Tells the designer to use the founder's exact content.", usedBy: "ProStudio", variables: {"content": "headline: Fresh every morning"} },
];

export function promptDef(key: string): PromptDef | undefined {
  return PROMPT_REGISTRY.find((d) => d.key === key);
}

export function fillVars(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{{${k}}}`).join(v);
  return out;
}

export class PromptMissingError extends Error {
  constructor(key: string) { super(`Prompt "${key}" is not set. Open Admin → Prompts and save it.`); this.name = "PromptMissingError"; }
}

/** The admin's text + further instructions + examples, with variables filled. Throws when the prompt is missing or inactive. */
export function composePrompt(def: PromptDef, row: PromptRow | null | undefined, vars: Record<string, string> = {}): string {
  const base = row?.is_active !== false ? row?.system_prompt?.trim() : "";
  if (!base) throw new PromptMissingError(def.key);
  const parts = [fillVars(base, vars)];
  const ins = row?.instructions?.trim();
  if (ins) parts.push(`FURTHER INSTRUCTIONS FROM THE ADMIN (these take precedence):\n${fillVars(ins, vars)}`);
  const ex = (row?.examples ?? []).filter((e) => e && (e.input?.trim() || e.output?.trim())).slice(0, 8);
  if (ex.length) parts.push(`EXAMPLES OF GOOD WORK (match their quality and shape, not their content):\n` + ex.map((e, i) => `Example ${i + 1}${e.note ? ` (${e.note})` : ""}:\nInput: ${e.input?.trim() ?? ""}\nOutput: ${e.output?.trim() ?? ""}`).join("\n\n"));
  return parts.join("\n\n");
}
