import { describe, it, expect } from 'vitest';
import { agentsBlock, checkinSummary, coercePlan, founderTypeFrom, matchByTitle, parsePlanEdits, planPromptBlock, playbookBlock, playbookFrom } from '@shared/plan';

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
    expect(agentsBlock(agents, 'AGENTS:\n{{agents}}')).toContain('copywriter: Copywriter. Captions (on the team)');
    expect(agentsBlock(agents, 'AGENTS:\n{{agents}}')).toMatch(/developer: Developer\.\s+\(available to hire\)/);
    expect(agentsBlock([], 'AGENTS:\n{{agents}}')).toMatch(/none available/);
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

describe('playbooks and in-chat plan edits', () => {
  it('parses PLAN_EDIT blocks, coerces ops and strips them from the reply', () => {
    const reply = 'Great, that is done.\n\n<PLAN_EDIT>{ "ops": [ { "op": "DONE", "task": "Talk to 10 customers" }, { "op": "add", "target": "Validate", "task": "Write a survey", "owner": "agent", "agent_slug": "Copywriter" }, { "op": "add", "task": "" }, { "op": "revise", "note": "We pivoted to B2B" }, { "op": "nonsense", "task": "x" } ] }</PLAN_EDIT>';
    const { text, ops } = parsePlanEdits(reply);
    expect(text).toBe('Great, that is done.');
    expect(ops).toEqual([
      { op: 'done', task: 'Talk to 10 customers' },
      { op: 'add', target: 'Validate', task: 'Write a survey', detail: '', owner: 'agent', agent_slug: 'copywriter' },
      { op: 'revise', note: 'We pivoted to B2B' },
    ]);
    expect(parsePlanEdits('plain <PLAN_EDIT>not json</PLAN_EDIT> text')).toEqual({ text: 'plain  text', ops: [] });
  });
  it('matches titles exactly, by containment, then by shared words', () => {
    const items = [{ title: 'Talk to 10 customers' }, { title: 'Write the landing page copy' }, { title: 'Set up payments' }];
    expect(matchByTitle('talk to 10 customers', items)?.title).toBe('Talk to 10 customers');
    expect(matchByTitle('landing page', items)?.title).toBe('Write the landing page copy');
    expect(matchByTitle('write landing copy', items)?.title).toBe('Write the landing page copy');
    expect(matchByTitle('raise a seed round', items)).toBeNull();
    expect(matchByTitle('', items)).toBeNull();
  });
  it('builds the playbook paragraph and the plan block for Mentor', () => {
    expect(playbookFrom('Creator')).toBe('creator');
    expect(playbookFrom('x')).toBe('auto');
    expect(playbookBlock('idea', { auto: 'PLAYBOOKS:\n{{playbooks}}', chosen: 'PLAYBOOK — {{label}} ({{who}}):\n{{targets}}\nSet founder_type to "{{choice}}".' })).toMatch(/PLAYBOOK — Validate an idea/);
    expect(playbookBlock('auto', { auto: 'PLAYBOOKS:\n{{playbooks}}', chosen: '' })).toMatch(/- running \(/);
    const block = planPromptBlock({ title: 'Launch', targets: [{ title: 'Validate', status: 'current', tasks: [{ title: 'Talk to 10 customers', status: 'todo', owner: 'agent' }] }] }, 'THE FOUNDER\'S PLAN — "{{title}}":\n{{plan}}\n<PLAN_EDIT>');
    expect(block).toContain('1. Validate [current]');
    expect(block).toContain('- Talk to 10 customers [todo, agent]');
    expect(block).toContain('<PLAN_EDIT>');
  });
});

describe('playbookForKind', () => {
  it('maps the kind of business to a playbook, auto otherwise', async () => {
    const { playbookForKind } = await import('@shared/plan');
    expect(playbookForKind('starting')).toBe('idea');
    expect(playbookForKind('running')).toBe('running');
    expect(playbookForKind('creator')).toBe('creator');
    expect(playbookForKind('other')).toBe('auto');
    expect(playbookForKind(null)).toBe('auto');
  });
});

describe('rolesForPlan', () => {
  it('lists agent roles in first-appearance order with open and total counts', async () => {
    const { rolesForPlan } = await import('@shared/plan');
    const roles = rolesForPlan([
      { owner: 'founder', agent_slug: null, status: 'todo', title: 'Decide the price' },
      { owner: 'agent', agent_slug: 'researcher', status: 'done', title: 'List offices' },
      { owner: 'agent', agent_slug: 'copywriter', status: 'todo', title: 'Write the offer' },
      { owner: 'agent', agent_slug: 'researcher', status: 'doing', title: 'Competitor check' },
      { owner: 'agent', agent_slug: 'copywriter', status: 'skipped', title: 'Newsletter' },
    ]);
    expect(roles.map((r) => r.slug)).toEqual(['researcher', 'copywriter']);
    expect(roles[0]).toMatchObject({ count: 2, open: 1, titles: ['List offices', 'Competitor check'] });
    expect(roles[1]).toMatchObject({ count: 2, open: 1 });
    expect(rolesForPlan([])).toEqual([]);
  });
});
