import { describe, it, expect } from 'vitest';
import { planAllows, effectiveLimit, isActiveStatus, FREE_LIMITS, type Entitlements } from '@shared/plans';

const startup: Entitlements = {
  agents: 5, automations: 15, connections: -1, members: 3, autonomous_publishing: true, code_repos: 3, enterprise: false,
  plan_slug: 'startup', plan_name: 'Startup', status: 'active', monthly_credits: 2000,
  extra_agent_seats: 2, extra_member_seats: 1, current_period_end: null, cancel_at_period_end: false,
};

describe('entitlements', () => {
  it('adds seats to the base agent and member limits', () => {
    expect(effectiveLimit(startup, 'agents')).toBe(7);
    expect(effectiveLimit(startup, 'members')).toBe(4);
    expect(effectiveLimit(startup, 'automations')).toBe(15);
    expect(effectiveLimit(startup, 'connections')).toBe(-1);
  });
  it('allows below the cap, refuses at it, and treats -1 as unlimited', () => {
    expect(planAllows(startup, 'agents', 6)).toEqual({ ok: true, remaining: 1 });
    const v = planAllows(startup, 'agents', 7);
    expect(v.ok).toBe(false);
    expect(v.ok === false ? v.reason : '').toContain('Startup includes 7 agents');
    expect(planAllows(startup, 'connections', 999)).toEqual({ ok: true, remaining: -1 });
  });
  it('free plan is one of everything and no code', () => {
    const free: Entitlements = { ...FREE_LIMITS, plan_slug: 'free', plan_name: 'Free', status: 'free', monthly_credits: 0, extra_agent_seats: 0, extra_member_seats: 0, current_period_end: null, cancel_at_period_end: false };
    expect(planAllows(free, 'agents', 1).ok).toBe(false);
    expect(planAllows(free, 'code_repos', 0).ok).toBe(false);
  });
  it('past_due still counts as usable; canceled does not', () => {
    expect(isActiveStatus('past_due')).toBe(true);
    expect(isActiveStatus('canceled')).toBe(false);
    expect(isActiveStatus('free')).toBe(false);
  });
});

import { roleAtLeast, ROLE_LABEL } from '@shared/plans';

describe('workspace roles', () => {
  it('ranks owner > editor > viewer and rejects unknown', () => {
    expect(roleAtLeast('owner', 'editor')).toBe(true);
    expect(roleAtLeast('editor', 'editor')).toBe(true);
    expect(roleAtLeast('viewer', 'editor')).toBe(false);
    expect(roleAtLeast('editor', 'owner')).toBe(false);
    expect(roleAtLeast(null, 'viewer')).toBe(false);
    expect(roleAtLeast('admin' as never, 'viewer')).toBe(false);
    expect(Object.keys(ROLE_LABEL)).toEqual(['owner', 'editor', 'viewer']);
  });
});
