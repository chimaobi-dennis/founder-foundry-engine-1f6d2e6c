import { describe, it, expect } from 'vitest';
import {
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
