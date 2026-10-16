/**
 * Planner Service — "describe it" authoring.
 *
 * The founder writes what they want in plain language; a fast-tier model
 * drafts a plan constrained to the agents, recipes and connections that
 * exist; the founder reviews the draft (with its quote) and confirms. Only
 * then does anything get created. The planning call itself is not charged.
 */

import { requirePrompt, callAI } from './aiService';
import { plannerSystemPrompt, coercePlanDraft, declineReason, parseStructuredOutput, planSingleAgentRun, planRecipeRun, planHiveRun, RECIPES, type ActionClass, type PlanDraft, type PlannerContext, type HiveStage } from '@shared/runner';
import { quoteAction, type Quote } from './pricingService';
import { createRun, createAutomation, createHiveRun, quoteHive, type Agent, type AutomationRun, type Automation } from './agentService';
import { startRecipe, quoteRecipe, type ToolConnection } from './connectionService';

export type { PlanDraft } from '@shared/runner';

export interface DraftResult {
  success: boolean;
  error?: string;
  draft?: PlanDraft;
  quote?: Quote;
}

/** Ask the planner for a draft and price it. */
export async function draftPlan(description: string, agents: Agent[], connections: ToolConnection[], stage: string | null | undefined, userId: string): Promise<DraftResult> {
  const text = description.trim();
  if (!text) return { success: false, error: 'Describe what you want first.' };
  // Schema changes are declined up front, before any model call.
  const declined = declineReason(text);
  if (declined) return { success: false, error: declined };
  const ctx: PlannerContext = {
    request: text,
    agents: agents.map((a) => ({ slug: a.slug, name: a.name, tagline: a.tagline, unit_label: a.unit_label })),
    connections: connections.filter((c) => c.status === 'active').map((c) => ({ id: c.id, provider: c.provider, display_name: c.display_name })),
    stage,
  };
  const res = await callAI({
    taskType: 'tier_fast',
    modelTier: 'fast',
    userId,
    systemPrompt: plannerSystemPrompt(ctx, await requirePrompt('automation_planner')),
    messages: [{ role: 'user', content: `${text}\n\nRespond with the JSON object only.` }],
    // Thinking models spend output tokens before the JSON; leave room.
    maxTokens: 6000,
    temperature: 0.2,
    userAction: 'plan_automation',
    metadata: { planner: true },
  });
  if (!res.success || !res.text) return { success: false, error: res.error ?? 'The planner did not answer.' };
  const parsed = parseStructuredOutput(res.text);
  if (!parsed.ok) return { success: false, error: 'The planner answered in an unexpected shape. Try rephrasing.' };
  const draft = coercePlanDraft(parsed.value, ctx);
  if (!draft) return { success: false, error: 'None of your agents fit that request. Hire one from the gallery, or rephrase.' };
  const quote = await quoteDraft(draft, agents, connections);
  return { success: true, draft, quote };
}

export async function quoteDraft(draft: PlanDraft, agents: Agent[], connections: ToolConnection[]): Promise<Quote> {
  const bySlug = new Map(agents.map((a) => [a.slug, a]));
  if (draft.kind === 'recipe' && draft.recipe) {
    const agent = bySlug.get(RECIPES[draft.recipe].agentSlug)!;
    return quoteRecipe(draft.recipe, agent, { brief: draft.brief, connection_id: draft.connection_id ?? '', record_limit: draft.units, platforms: draft.platforms });
  }
  if (draft.kind === 'hive') {
    return quoteHive(draft.agents.map((s) => ({ agent: bySlug.get(s)!, units: draft.units, platforms: draft.platforms })));
  }
  const agent = bySlug.get(draft.agents[0])!;
  return quoteAction({ actionType: agent.action_type, units: draft.units });
}

export interface ExecuteResult {
  success: boolean;
  error?: string;
  run?: AutomationRun;
  automation?: Automation;
}

/** Create exactly what the confirmed draft says. */
export async function executeDraft(draft: PlanDraft, brandId: string, userId: string, agents: Agent[], connections: ToolConnection[]): Promise<ExecuteResult> {
  const bySlug = new Map(agents.map((a) => [a.slug, a]));
  const policy = { approval: draft.approval } as const;
  const input = { brief: draft.brief, units: draft.units, platforms: draft.platforms };

  if (draft.kind === 'recipe' && draft.recipe) {
    const spec = RECIPES[draft.recipe];
    const agent = bySlug.get(spec.agentSlug);
    const connection = connections.find((c) => c.id === draft.connection_id);
    if (!agent || !connection) return { success: false, error: 'The agent or connection for this recipe is missing.' };
    return startRecipe({ recipe: draft.recipe, brandId, userId, agent, connection, name: draft.name, input: { ...input, connection_id: connection.id, record_limit: draft.units }, policy });
  }

  if (draft.kind === 'hive') {
    const stages: HiveStage[] = draft.agents.map((s) => ({ agent: bySlug.get(s)!, units: draft.units, platforms: draft.platforms }));
    if (stages.some((s) => !s.agent)) return { success: false, error: 'One of the agents in this plan is no longer available.' };
    return createHiveRun({ brandId, userId, name: draft.name, stages, input, policy });
  }

  const agent = bySlug.get(draft.agents[0]);
  if (!agent) return { success: false, error: 'That agent is no longer available.' };
  if (draft.schedule === 'once') {
    return createRun({ brandId, userId, agent, name: draft.name, input, policy });
  }
  if (draft.schedule === 'event' && draft.event) {
    return createAutomation({ brandId, userId, agent, name: draft.name, input, interval: 'weekly', trigger: 'event', eventType: draft.event, conditions: draft.conditions, policy, runNow: false });
  }
  return createAutomation({ brandId, userId, agent, name: draft.name, input, interval: draft.schedule === 'webhook' || draft.schedule === 'event' ? 'weekly' : draft.schedule, trigger: draft.schedule === 'webhook' ? 'webhook' : 'schedule', policy, runNow: draft.schedule !== 'webhook' });
}

export interface DraftStep {
  name: string;
  action_class: ActionClass;
}

/** The readable checklist of what a confirmed draft will do, each step with its class. */
export function describeDraftSteps(draft: PlanDraft, agents: Agent[]): DraftStep[] {
  const bySlug = new Map(agents.map((a) => [a.slug, a]));
  const policy = { approval: draft.approval } as const;
  const input = { brief: draft.brief, units: draft.units, platforms: draft.platforms };
  let steps;
  if (draft.kind === 'recipe' && draft.recipe) {
    const agent = bySlug.get(RECIPES[draft.recipe].agentSlug);
    if (!agent) return [];
    steps = planRecipeRun(draft.recipe, agent, { ...input, connection_id: draft.connection_id ?? '', record_limit: draft.units }, policy);
  } else if (draft.kind === 'hive') {
    const stages: HiveStage[] = draft.agents.map((s) => ({ agent: bySlug.get(s)!, units: draft.units, platforms: draft.platforms })).filter((s) => s.agent);
    steps = planHiveRun(stages, input, policy);
  } else {
    const agent = bySlug.get(draft.agents[0]);
    if (!agent) return [];
    steps = planSingleAgentRun(agent, input, policy);
  }
  return steps.map((s) => ({ name: s.name, action_class: s.input.action_class as ActionClass }));
}
