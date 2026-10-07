import { describe, it, expect } from 'vitest';
import { agentsBlock, coercePlan, founderTypeFrom, planSystemPrompt } from '@shared/plan';

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
