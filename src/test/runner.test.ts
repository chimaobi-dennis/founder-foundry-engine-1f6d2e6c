import { describe, it, expect } from 'vitest';
import {
  approvalKindFor,
  isConnectorWrite,
  writeMayRunUnreviewed,
  buildTaskPrompt,
  checkBudget,
  normalizeUnits,
  parseStructuredOutput,
  planSingleAgentRun,
  summarizeOutput,
  type AgentDefinition,
} from '@shared/runner';

const agent: AgentDefinition = {
  id: 'a1',
  slug: 'copywriter',
  name: 'Copywriter',
  role: 'Copywriter',
  system_prompt: 'You write.',
  model_tier: 'standard',
  action_type: 'agent_caption',
  unit_label: 'caption',
  per_run_credit_ceiling: 120,
  cost_indicator: 2,
  output_spec: {},
};

describe('normalizeUnits', () => {
  it('clamps to a sane range', () => {
    expect(normalizeUnits(undefined)).toBe(1);
    expect(normalizeUnits(0)).toBe(1);
    expect(normalizeUnits(3.7)).toBe(3);
    expect(normalizeUnits(1000)).toBe(20);
    expect(normalizeUnits('abc')).toBe(1);
  });
});

describe('planSingleAgentRun', () => {
  it('adds a review step under review_first', () => {
    const steps = planSingleAgentRun(agent, { brief: 'Three captions', units: 3 });
    expect(steps.map((s) => s.type)).toEqual(['agent_task', 'approval']);
    expect(steps[0].name).toBe('Copywriter: 3 captions');
    expect(steps[0].input.units).toBe(3);
  });
  it('skips the review step when autonomous', () => {
    const steps = planSingleAgentRun(agent, { brief: 'One', units: 1 }, { approval: 'autonomous' });
    expect(steps.map((s) => s.type)).toEqual(['agent_task']);
    expect(steps[0].name).toBe('Copywriter: 1 caption');
  });
});

describe('checkBudget', () => {
  const budget = { credits_per_run: 200, max_steps: 3 };
  it('allows a step inside both caps', () => {
    expect(checkBudget(budget, agent, { creditsCaptured: 50, stepsDone: 1 }, 20)).toEqual({ ok: true });
  });
  it('uses the lower of run and agent ceilings', () => {
    const v = checkBudget(budget, agent, { creditsCaptured: 110, stepsDone: 1 }, 20);
    expect(v.ok).toBe(false);
    expect(v.ok === false ? v.reason : '').toContain('120');
  });
  it('stops at the step cap', () => {
    const v = checkBudget(budget, agent, { creditsCaptured: 0, stepsDone: 3 }, 1);
    expect(v.ok).toBe(false);
  });
});

describe('parseStructuredOutput', () => {
  it('parses plain JSON', () => {
    const r = parseStructuredOutput('{"items":[{"body":"hi"}],"summary":"x"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value as any).items).toHaveLength(1);
  });
  it('parses JSON inside a code fence with prose around it', () => {
    const r = parseStructuredOutput('Sure! Here you go:\n```json\n{"items":[],"summary":"done"}\n```\nLet me know.');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.summary).toBe('done');
  });
  it('handles braces inside strings', () => {
    const r = parseStructuredOutput('{"body":"use {curly} braces } here","n":1}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.n).toBe(1);
  });
  it('rejects non-objects and empties', () => {
    expect(parseStructuredOutput('').ok).toBe(false);
    expect(parseStructuredOutput('[1,2]').ok).toBe(false);
    expect(parseStructuredOutput('just words').ok).toBe(false);
  });
});

describe('summarizeOutput and buildTaskPrompt', () => {
  it('prefers the model summary, then item counts, then the fallback', () => {
    expect(summarizeOutput('Copywriter', { summary: ' Wrote 3 captions. ' }, 'fb')).toBe('Wrote 3 captions.');
    expect(summarizeOutput('Copywriter', { items: [{}, {}] }, 'fb')).toBe('Copywriter produced 2 items.');
    expect(summarizeOutput('Copywriter', null, 'fb')).toBe('fb');
  });
  it('states units and platforms in the prompt', () => {
    const p = buildTaskPrompt(agent, { brief: 'Launch week', units: 2, platforms: ['instagram', 'x'] });
    expect(p).toContain('Launch week');
    expect(p).toContain('produce 2 captions');
    expect(p).toContain('instagram, x');
  });
});

import { nextRunAt, agentSuitsStage } from '@shared/runner';

describe('schedules and stage matching', () => {
  it('nextRunAt advances by the interval', () => {
    const from = new Date('2026-10-07T10:00:00Z');
    expect(nextRunAt('daily', from).toISOString()).toBe('2026-10-08T10:00:00.000Z');
    expect(nextRunAt('weekly', from).toISOString()).toBe('2026-10-14T10:00:00.000Z');
    expect(nextRunAt('biweekly', from).toISOString()).toBe('2026-10-21T10:00:00.000Z');
    expect(nextRunAt('monthly', from).toISOString()).toBe('2026-11-07T10:00:00.000Z');
  });
  it('agentSuitsStage matches live keys and seed aliases', () => {
    expect(agentSuitsStage(['brand', 'launch'], 'brand')).toBe(true);
    expect(agentSuitsStage(['validation'], 'validate')).toBe(true);
    expect(agentSuitsStage(['growth'], 'grow')).toBe(true);
    expect(agentSuitsStage(['idea'], 'spark')).toBe(true);
    expect(agentSuitsStage(['brand'], 'spark')).toBe(false);
    expect(agentSuitsStage([], 'brand')).toBe(false);
    expect(agentSuitsStage(['brand'], null)).toBe(false);
  });
});

import { planHiveRun, hiveBudget, coercePlanDraft, plannerSystemPrompt } from '@shared/runner';

describe('hives', () => {
  const researcher: AgentDefinition = { ...agent, id: 'r', slug: 'researcher', name: 'Researcher', unit_label: 'brief', per_run_credit_ceiling: 160 };
  it('hands off output between stages and reviews once', () => {
    const steps = planHiveRun([{ agent: researcher, units: 1 }, { agent, units: 3, platforms: ['linkedin'] }], { brief: 'Student events' });
    expect(steps.map((s) => s.type)).toEqual(['agent_task', 'agent_task', 'approval']);
    expect(steps[0].input.use_previous).toBeUndefined();
    expect(steps[1].input).toMatchObject({ use_previous: 'output', units: 3, platforms: ['linkedin'] });
    expect(hiveBudget([{ agent: researcher }, { agent }])).toEqual({ credits_per_run: 280, max_steps: 6 });
  });
});

describe('coercePlanDraft', () => {
  const ctx = {
    agents: [{ slug: 'copywriter', name: 'Copywriter', unit_label: 'caption' }, { slug: 'researcher', name: 'Researcher', unit_label: 'brief' }, { slug: 'seo_specialist', name: 'SEO', unit_label: 'product' }],
    connections: [{ id: 'c-shop', provider: 'shopify', display_name: 'Store' }],
  };
  it('keeps a valid hive and bounds numbers', () => {
    const d = coercePlanDraft({ kind: 'hive', name: 'Weekly posts', brief: 'b', agents: ['researcher', 'copywriter', 'ghost'], units: 99, platforms: ['LinkedIn'], schedule: 'weekly', approval: 'autonomous', explanation: 'e' }, ctx)!;
    expect(d.kind).toBe('hive');
    expect(d.agents).toEqual(['researcher', 'copywriter']);
    expect(d.units).toBe(20);
    expect(d.platforms).toEqual(['linkedin']);
    expect(d.schedule).toBe('weekly');
    expect(d.approval).toBe('autonomous');
    expect(d.warnings.some((w) => w.includes('ghost'))).toBe(true);
  });
  it('downgrades a one-agent hive to a task and rejects unknown-only agents', () => {
    expect(coercePlanDraft({ kind: 'hive', agents: ['copywriter'] }, ctx)!.kind).toBe('task');
    expect(coercePlanDraft({ kind: 'task', agents: ['nobody'] }, ctx)).toBeNull();
  });
  it('binds a recipe to a matching connection, or falls back with a warning', () => {
    const ok = coercePlanDraft({ kind: 'recipe', recipe: 'seo_refresh', agents: [], units: 10 }, ctx)!;
    expect(ok.kind).toBe('recipe');
    expect(ok.connection_id).toBe('c-shop');
    expect(ok.agents).toEqual(['seo_specialist']);
    const no = coercePlanDraft({ kind: 'recipe', recipe: 'blog_draft', agents: ['copywriter'] }, ctx)!;
    expect(no.kind).toBe('task');
    expect(no.warnings[0]).toContain('wordpress');
  });
  it('never lets an irreversible recipe run without review', () => {
    const d = coercePlanDraft({ kind: 'recipe', recipe: 'social_publish', agents: [], approval: 'autonomous' }, { ...ctx, connections: [{ id: 'c-soc', provider: 'ayrshare', display_name: 'Social' }] })!;
    expect(d.kind).toBe('recipe');
    expect(d.approval).toBe('review_first');
  });
  it('planner prompt lists only what exists', () => {
    const p = plannerSystemPrompt(ctx);
    expect(p).toContain('copywriter');
    expect(p).toContain('c-shop');
    expect(p).toContain('seo_refresh');
  });
});

describe('connector write review policy', () => {
  it('knows which connector actions change the outside world', () => {
    expect(isConnectorWrite('apply_changes')).toBe(true);
    expect(isConnectorWrite('open_pr')).toBe(true);
    expect(isConnectorWrite('list_records')).toBe(false);
    expect(isConnectorWrite(undefined)).toBe(false);
  });

  it('maps writes to the approval kind the UI renders', () => {
    expect(approvalKindFor('apply_changes')).toBe('review_changes');
    expect(approvalKindFor('open_pr')).toBe('review_code');
    expect(approvalKindFor('publish_items')).toBe('review_publish');
    expect(approvalKindFor('create_draft')).toBe('review_output');
  });

  it('lets writes run unreviewed only under autonomous policy on a plan that includes it', () => {
    expect(writeMayRunUnreviewed('apply_changes', 'autonomous', true)).toBe(true);
    expect(writeMayRunUnreviewed('apply_changes', 'autonomous', false)).toBe(false);
    expect(writeMayRunUnreviewed('apply_changes', 'review_first', true)).toBe(false);
    expect(writeMayRunUnreviewed('open_pr', 'autonomous', true)).toBe(true);
  });

  it('never publishes without a review', () => {
    expect(writeMayRunUnreviewed('publish_items', 'autonomous', true)).toBe(false);
  });
});
