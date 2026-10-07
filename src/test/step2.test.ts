import { describe, it, expect } from 'vitest';
import {
  ACTION_CLASS_LABEL, EVENT_TYPES, codeChangeUnits, coercePlanDraft, conditionsMatch, declineReason, planHiveRun, planRecipeRun,
  planSingleAgentRun, recipeUnits, sanitizeConditions, type AgentDefinition, type PlannerContext,
} from '@shared/runner';
import { decideChecksState } from '@shared/connectorOps';

const agent = (slug: string): AgentDefinition => ({
  id: slug, slug, name: slug, role: slug, system_prompt: 'x', model_tier: 'standard', action_type: 'agent_caption',
  unit_label: 'item', per_run_credit_ceiling: 100, cost_indicator: 2, output_spec: {},
});

describe('action classes', () => {
  it('stamps every step of a code change, ending in a code_change write', () => {
    const steps = planRecipeRun('code_change', agent('developer'), { brief: 'b', connection_id: 'c' });
    expect(steps.map((s) => s.input.action_class)).toEqual(['read', 'generate', 'read', 'generate', 'review', 'code_change']);
  });
  it('classifies data writes and publishing', () => {
    expect(planRecipeRun('seo_refresh', agent('seo_specialist'), { brief: 'b', connection_id: 'c' }).map((s) => s.input.action_class)).toEqual(['read', 'generate', 'review', 'data_write']);
    expect(planRecipeRun('social_publish', agent('copywriter'), { brief: 'b', connection_id: 'c', platforms: ['x'] }).at(-1)?.input.action_class).toBe('publish');
  });
  it('stamps plain tasks and hives', () => {
    expect(planSingleAgentRun(agent('copywriter'), { brief: 'b' }).map((s) => s.input.action_class)).toEqual(['generate', 'review']);
    expect(planHiveRun([{ agent: agent('researcher'), units: 1 }, { agent: agent('copywriter'), units: 1 }], { brief: 'b' }).every((s) => s.input.action_class)).toBe(true);
    expect(Object.keys(ACTION_CLASS_LABEL)).toHaveLength(6);
  });
});

describe('routing rule enforced in code', () => {
  const ctx = (request: string, providers: string[]): PlannerContext => ({
    request,
    agents: ['developer', 'seo_specialist', 'copywriter'].map((slug) => ({ slug, name: slug, unit_label: 'item' })),
    connections: providers.map((p) => ({ id: `c-${p}`, provider: p, display_name: p })),
  });
  const codeDraft = { kind: 'recipe', recipe: 'code_change', connection_id: 'c-github', agents: ['developer'], name: 'n', brief: 'b' };

  it('declines database schema changes before any planning', () => {
    expect(declineReason('Add a new column to the orders table')).toMatch(/schemas/);
    expect(declineReason('Run the migration on my database')).toBeTruthy();
    expect(declineReason('Add schema markup to my product pages')).toBeNull();
    expect(declineReason('Improve my product descriptions')).toBeNull();
  });
  it('prefers the data path when one exists and the request is about field content', () => {
    const d = coercePlanDraft(codeDraft, ctx('Improve the SEO meta descriptions of my products', ['github', 'shopify']))!;
    expect(d.recipe).toBe('seo_refresh');
    expect(d.connection_id).toBe('c-shopify');
    expect(d.action_class).toBe('data_write');
    expect(d.warnings.join(' ')).toMatch(/instead of a code change/);
  });
  it('keeps code for layout and styling, and when no data path exists', () => {
    expect(coercePlanDraft(codeDraft, ctx('Change the header colors and layout', ['github', 'shopify']))!.recipe).toBe('code_change');
    const noData = coercePlanDraft(codeDraft, ctx('Improve the SEO meta descriptions', ['github']))!;
    expect(noData.recipe).toBe('code_change');
    expect(noData.action_class).toBe('code_change');
  });
});

describe('event triggers', () => {
  it('keeps only conditions on fields the event carries', () => {
    expect(sanitizeConditions([{ field: 'stage_key', op: 'eq', value: 'Brand' }, { field: 'secret', op: 'eq', value: 'x' }, { field: 'name', op: 'contains', value: '' }], 'milestone_reached'))
      .toEqual([{ field: 'stage_key', op: 'eq', value: 'Brand' }]);
    expect(sanitizeConditions('nope', 'campaign_created')).toEqual([]);
  });
  it('matches conditions case-insensitively like the database does', () => {
    const payload = { stage_key: 'brand', name: 'Brand voice defined' };
    expect(conditionsMatch([{ field: 'stage_key', op: 'eq', value: 'BRAND' }], payload)).toBe(true);
    expect(conditionsMatch([{ field: 'stage_key', op: 'neq', value: 'brand' }], payload)).toBe(false);
    expect(conditionsMatch([{ field: 'name', op: 'contains', value: 'voice' }], payload)).toBe(true);
    expect(conditionsMatch([], payload)).toBe(true);
  });
  it('accepts an event schedule in a draft and drops unknown events', () => {
    const base = { kind: 'task', agents: ['copywriter'], name: 'n', brief: 'b' };
    const ctx: PlannerContext = { agents: [{ slug: 'copywriter', name: 'c', unit_label: 'caption' }], connections: [] };
    const ok = coercePlanDraft({ ...base, schedule: 'event', event: 'milestone_reached', conditions: [{ field: 'stage_key', op: 'eq', value: 'launch' }] }, ctx)!;
    expect(ok.schedule).toBe('event');
    expect(ok.event).toBe('milestone_reached');
    expect(ok.conditions).toHaveLength(1);
    const bad = coercePlanDraft({ ...base, schedule: 'event', event: 'user_signed_up' }, ctx)!;
    expect(bad.schedule).toBe('once');
    expect(bad.warnings.join(' ')).toMatch(/event you asked for/);
    expect(EVENT_TYPES.map((e) => e.value)).toEqual(['milestone_reached', 'campaign_created']);
  });
});

describe('code change sizing', () => {
  it('scales the quote with repository size, in whole units', () => {
    expect(codeChangeUnits(NaN)).toBe(1);
    expect(codeChangeUnits(40)).toBe(1);
    expect(codeChangeUnits(151)).toBe(2);
    expect(codeChangeUnits(900)).toBe(4);
    expect(recipeUnits('code_change', { brief: '', connection_id: 'c', repo_files: 320 })).toBe(3);
  });
});

describe('build first', () => {
  const snap = (over: Partial<{ state: string; merged: boolean; total: number; failure: number; pending: number }> = {}) => ({
    state: over.state ?? 'open', merged: over.merged ?? false, checks: { total: over.total ?? 2, failure: over.failure ?? 0, pending: over.pending ?? 0 },
  });
  it('waits while checks run and passes when they are green', () => {
    expect(decideChecksState(snap({ pending: 1 }), 5)).toBe('pending');
    expect(decideChecksState(snap(), 5)).toBe('passed');
  });
  it('flags failures and closed or merged pull requests', () => {
    expect(decideChecksState(snap({ failure: 1 }), 5)).toBe('failed');
    expect(decideChecksState(snap({ state: 'closed' }), 5)).toBe('closed');
    expect(decideChecksState(snap({ merged: true, state: 'closed' }), 5)).toBe('merged');
  });
  it('gives repositories with no checks a short grace period, then moves on', () => {
    expect(decideChecksState(snap({ total: 0 }), 1)).toBe('pending');
    expect(decideChecksState(snap({ total: 0 }), 4)).toBe('none');
  });
});
