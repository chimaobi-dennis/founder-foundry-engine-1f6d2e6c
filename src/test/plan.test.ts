import { describe, it, expect } from 'vitest';
import { agentsBlock, checkinSummary, coercePlan, founderTypeFrom, planSystemPrompt } from '@shared/plan';

const agents = [{ slug: 'copywriter', name: 'Copywriter', tagline: 'Captions', hired: true }, { slug: 'developer', name: 'Developer', hired: false }];

describe('coercePlan', () => {
  it('keeps a well-formed plan, assigns agents only when known and marked agent', () => {
    const p = coercePlan({
      title: 'Launch the shop', summary: 'Two sentences.', founder_type: 'running',
      targets: [
        { title: 'Validate', why: 'Because', tasks: [
          { title: 'Talk to 10 customers', owner: 'founder' },
          { title: 'Write 3 captions', owner: 'agent', agent_slug: 'copywriter', agent_brief: 'Three captions about the launch' },
          { title: 'Build the landing page', owner: 'agent', agent_slug: 'ghost' },
          { title: 'Fix header', owner: 'founder', agent_slug: 'developer' },
        ] },
      ],
    }, agents)!;
    expect(p.founder_type).toBe('running');
    const t = p.targets[0].tasks;
    expect(t[0].owner).toBe('founder');
    expect(t[1]).toMatchObject({ owner: 'agent', agent_slug: 'copywriter', agent_brief: 'Three captions about the launch' });
    expect(t[2]).toMatchObject({ owner: 'founder', agent_slug: null });
    expect(t[3]).toMatchObject({ owner: 'founder', agent_slug: null });
  });
  it('bounds targets and tasks and drops empties', () => {
    const many = { targets: Array.from({ length: 8 }, (_, i) => ({ title: `T${i}`, tasks: Array.from({ length: 9 }, (_, j) => ({ title: `k${j}` })) })) };
    const p = coercePlan(many, [])!;
    expect(p.targets).toHaveLength(5);
    expect(p.targets[0].tasks).toHaveLength(6);
    expect(coercePlan({ targets: [{ title: 'x', tasks: [] }, { title: '', tasks: [{ title: 'y' }] }] }, [])).toBeNull();
    expect(coercePlan('nope', [])).toBeNull();
  });
  it('defaults the agent brief to the task title and normalises the founder type', () => {
    const p = coercePlan({ targets: [{ title: 'T', tasks: [{ title: 'Write the bio', owner: 'AGENT', agent_slug: 'COPYWRITER' }] }] }, agents)!;
    expect(p.targets[0].tasks[0]).toMatchObject({ owner: 'agent', agent_brief: 'Write the bio' });
    expect(founderTypeFrom('creator')).toBe('creator');
    expect(founderTypeFrom('agency')).toBe('other');
  });
  it('lists agents with their hire state for the prompt', () => {
    expect(agentsBlock(agents)).toContain('copywriter: Copywriter. Captions (on the team)');
    expect(agentsBlock(agents)).toMatch(/developer: Developer\.\s+\(available to hire\)/);
    expect(agentsBlock([])).toMatch(/none available/);
    expect(planSystemPrompt()).toMatch(/2 to 5 TARGETS/);
  });
});

describe('checkinSummary', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  const days = (n: number) => new Date(now.getTime() - n * 24 * 3600_000).toISOString();
  const task = (title: string, status: string, extra: Partial<{ owner: string; done_at: string | null; updated_at: string }> = {}) =>
    ({ title, status, owner: 'founder', done_at: null, updated_at: days(1), ...extra });

  it('reports the week: done, next in the current target, stalled, delegable', () => {
    const s = checkinSummary({ title: 'Launch', targets: [
      { title: 'Validate', status: 'done', position: 0, tasks: [task('Talk to 10 people', 'done', { done_at: days(2) }), task('Old one', 'done', { done_at: days(20) })] },
      { title: 'Build', status: 'current', position: 1, tasks: [task('Write the landing page', 'doing', { owner: 'agent', updated_at: days(9) }), task('Set up payments', 'todo'), task('Skip me', 'skipped')] },
      { title: 'Grow', status: 'upcoming', position: 2, tasks: [task('First 100 customers', 'todo')] },
    ] }, now);
    expect(s.complete).toBe(false);
    expect(s.title).toBe('Your week on the plan: 1 done, 3 to go');
    expect(s.body).toContain('Done this week: "Talk to 10 people".');
    expect(s.body).toContain('Up next in "Build": "Write the landing page", "Set up payments".');
    expect(s.body).toContain('1 task has been in progress for over a week: "Write the landing page".');
    expect(s.body).toContain('1 of the open tasks can go to an agent.');
  });
  it('says so when nothing moved, and when everything is done', () => {
    const quiet = checkinSummary({ title: 'P', targets: [{ title: 'T', status: 'current', position: 0, tasks: [task('A', 'todo')] }] }, now);
    expect(quiet.body).toMatch(/^Nothing moved this week\. Up next in "T": "A"\.$/);
    const done = checkinSummary({ title: 'Launch the shop', targets: [{ title: 'T', status: 'done', position: 0, tasks: [task('A', 'done', { done_at: days(1) })] }] }, now);
    expect(done).toMatchObject({ complete: true, title: 'Your plan is complete' });
    expect(done.body).toContain('"Launch the shop"');
  });
});
