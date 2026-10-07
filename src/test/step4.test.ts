import { describe, it, expect } from 'vitest';
import { feedbackEntry, memoryLine, outcomeEntry, revertFeedbackEntry, runSummaryEntry } from '@shared/memory';
import { mergeSelfReview, planSingleAgentRun, selfReviewInstruction, type AgentDefinition } from '@shared/runner';

const designer: AgentDefinition = {
  id: 'd', slug: 'designer', name: 'Designer', role: 'Designer', system_prompt: 'x', model_tier: 'standard', action_type: 'agent_designed_post',
  unit_label: 'post', per_run_credit_ceiling: 160, cost_indicator: 2, output_spec: { type: 'creative_brief' },
};
const copywriter: AgentDefinition = { ...designer, id: 'c', slug: 'copywriter', name: 'Copywriter', output_spec: {} };

describe('designer self-review', () => {
  it('adds an uncharged fast-tier critique before the founder reviews', () => {
    const steps = planSingleAgentRun(designer, { brief: 'b', units: 2, platforms: ['instagram'] });
    expect(steps.map((s) => s.name)).toEqual(['Designer: 2 posts', 'Designer: self-review', 'Review the result']);
    expect(steps[1].input).toMatchObject({ use_previous: 'output', prompt_mode: 'critique', model_tier: 'fast', charge: false });
    expect(steps.map((s) => s.step_index)).toEqual([0, 1, 2]);
  });
  it('leaves other agents alone', () => {
    expect(planSingleAgentRun(copywriter, { brief: 'b' }).map((s) => s.type)).toEqual(['agent_task', 'approval']);
  });
  it('asks for the same shape plus review notes', () => {
    expect(selfReviewInstruction()).toMatch(/SAME JSON shape/);
    expect(selfReviewInstruction()).toMatch(/issues_found/);
  });
  it('keeps the draft when the review loses its items', () => {
    const draft = { items: [{ title: 'a' }], summary: 's' };
    expect(mergeSelfReview(draft, { items: [{ title: 'b' }], review: { confidence: 'high' } })).toMatchObject({ items: [{ title: 'b' }], summary: 's', review: { confidence: 'high' } });
    expect(mergeSelfReview(draft, { review: { issues_found: ['x'] } })).toEqual({ items: [{ title: 'a' }], summary: 's', review: { issues_found: ['x'] } });
    expect(mergeSelfReview(draft, { items: [] })).toEqual({ items: [{ title: 'a' }], summary: 's', review: null });
  });
});

describe('memory entries', () => {
  it('remembers a finished run, and nothing for an empty summary', () => {
    expect(runSummaryEntry('r1', 'Cultural night', 'Copywriter', 'Three captions drafted.', { credits: 6 })).toMatchObject({ kind: 'run_summary', key: 'run:r1:summary', title: 'Cultural night', data: { agent: 'Copywriter', credits: 6 } });
    expect(runSummaryEntry('r1', 'x', 'A', '   ')).toBeNull();
  });
  it('turns write results into outcomes and ignores dry runs and empties', () => {
    const applied = outcomeEntry('s1', 'apply_changes', { applied: [{ target_label: 'Mug', target_id: '1', fields: { seo_title: 'x', seo_description: 'y' }, change_set_id: 'cs1' }], failed: [] }, 'My Shop')!;
    expect(applied).toMatchObject({ kind: 'outcome', key: 'step:s1:outcome', title: 'Updated 1 record in My Shop' });
    expect(applied.summary).toBe('Mug (seo_title, seo_description).');
    expect(outcomeEntry('s2', 'apply_changes', { applied: [], failed: [] }, 'x')).toBeNull();
    expect(outcomeEntry('s3', 'apply_changes', { dry_run: true, would_change: [] }, 'x')).toBeNull();
    expect(outcomeEntry('s4', 'open_pr', { pr_number: 12, pr_url: 'https://github.com/o/r/pull/12', files: [{ path: 'src/a.css' }] }, 'Site')).toMatchObject({ title: 'Opened pull request #12 in Site' });
    expect(outcomeEntry('s5', 'publish_items', { published: [{ platforms: ['linkedin'], urls: { linkedin: 'https://l/1' } }], failed: [] }, 'Social')!.summary).toBe('linkedin: https://l/1');
    expect(outcomeEntry('s6', 'create_draft', { created: { id: '9', label: 'Post', url: 'https://w/9' } }, 'Blog')!.title).toBe('Created "Post" in Blog');
  });
  it('records rejections and notes, but not a bare approval', () => {
    expect(feedbackEntry('a1', 'rejected', 'Too salesy', 'Launch post', 'Copywriter')).toMatchObject({ kind: 'feedback', key: 'approval:a1:feedback', summary: 'Too salesy', data: { decision: 'rejected' } });
    expect(feedbackEntry('a2', 'rejected', null, 'Launch post', 'Copywriter')!.summary).toBe('No reason given.');
    expect(feedbackEntry('a3', 'approved', '', 'Launch post', 'Copywriter')).toBeNull();
    expect(feedbackEntry('a4', 'approved', 'Love the tone', 'Launch post', 'Copywriter')!.title).toMatch(/approved/);
    expect(revertFeedbackEntry('cs1', 'Mug', 'Shop').key).toBe('revert:cs1');
  });
  it('formats one stable line per memory', () => {
    expect(memoryLine({ kind: 'run_summary', title: 'A', summary: 'B' })).toBe('- [run summary] A: B');
    expect(memoryLine({ kind: 'feedback', title: 'T', summary: 'x\n  y' })).toBe('- [feedback] T: x y');
  });
});
