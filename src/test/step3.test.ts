import { describe, it, expect } from 'vitest';
import { applyDryRun, planRecipeRun, type AgentDefinition } from '@shared/runner';

const agent: AgentDefinition = {
  id: 'a', slug: 'seo_specialist', name: 'SEO', role: 'SEO', system_prompt: 'x', model_tier: 'standard', action_type: 'agent_seo_refresh',
  unit_label: 'product', per_run_credit_ceiling: 200, cost_indicator: 2, output_spec: {},
};

describe('dry run', () => {
  it('keeps the reads and the proposal, drops reviews and flags the write', () => {
    const steps = planRecipeRun('seo_refresh', agent, { brief: 'b', connection_id: 'c', dry_run: true });
    expect(steps.map((s) => s.type)).toEqual(['connector', 'agent_task', 'connector']);
    expect(steps.map((s) => s.step_index)).toEqual([0, 1, 2]);
    expect(steps[0].input.dry_run).toBeUndefined();
    expect(steps[2].input.dry_run).toBe(true);
    expect(steps[2].input.action_class).toBe('data_write');
  });
  it('applies to code changes and publishing too, so nothing can go out', () => {
    const pr = planRecipeRun('code_change', agent, { brief: 'b', connection_id: 'c', dry_run: true });
    expect(pr.at(-1)?.input).toMatchObject({ action: 'open_pr', dry_run: true });
    expect(pr.some((s) => s.type === 'approval')).toBe(false);
    const post = planRecipeRun('social_publish', agent, { brief: 'b', connection_id: 'c', platforms: ['x'], dry_run: true });
    expect(post.at(-1)?.input).toMatchObject({ action: 'publish_items', dry_run: true });
    expect(post.some((s) => s.type === 'approval')).toBe(false);
  });
  it('leaves a normal run untouched', () => {
    const steps = planRecipeRun('seo_refresh', agent, { brief: 'b', connection_id: 'c' });
    expect(steps.map((s) => s.type)).toEqual(['connector', 'agent_task', 'approval', 'connector']);
    expect(steps.every((s) => s.input.dry_run === undefined)).toBe(true);
  });
  it('does not mutate the steps it is given', () => {
    const base = [{ step_index: 0, type: 'connector' as const, name: 'w', input: { action: 'apply_changes' } }];
    applyDryRun(base);
    expect(base[0].input).toEqual({ action: 'apply_changes' });
  });
});
