import { describe, it, expect } from 'vitest';
import { applyProgress, makeNarrator, parseProgressLine, type ProgressStep } from '@shared/progress';

describe('applyProgress', () => {
  it('plans, starts, finishes and keeps order', () => {
    let s: ProgressStep[] = applyProgress([], { op: 'plan', steps: [{ key: 'a', label: 'Read' }, { key: 'b', label: 'Write' }] });
    s = applyProgress(s, { op: 'doing', key: 'a', at: 't1' });
    s = applyProgress(s, { op: 'done', key: 'a', note: 'found 3', at: 't2' });
    s = applyProgress(s, { op: 'doing', key: 'b', at: 't3' });
    expect(s.map((x) => x.status)).toEqual(['done', 'doing']);
    expect(s[0].note).toBe('found 3');
    expect(s[1].at).toBe('t3');
  });
  it('adds an unplanned step at the end and does not duplicate planned ones', () => {
    let s = applyProgress([], { op: 'plan', steps: [{ key: 'a', label: 'A' }] });
    s = applyProgress(s, { op: 'plan', steps: [{ key: 'a', label: 'A' }, { key: 'c', label: 'C' }] });
    s = applyProgress(s, { op: 'failed', key: 'z', label: 'Z', note: 'no', at: 't' });
    expect(s.map((x) => x.key)).toEqual(['a', 'c', 'z']);
    expect(s[2].status).toBe('failed');
  });
});

describe('makeNarrator', () => {
  it('emits the full list on every change', () => {
    const seen: ProgressStep[][] = [];
    const n = makeNarrator((steps) => seen.push(steps));
    n.plan([{ key: 'a', label: 'A' }]);
    n.start('a');
    n.skip('a', 'left out');
    expect(seen.length).toBe(3);
    expect(n.steps[0].status).toBe('skipped');
    expect(n.steps[0].note).toBe('left out');
  });
});

describe('parseProgressLine', () => {
  it('reads progress and result lines, ignores blanks and junk', () => {
    expect(parseProgressLine('')).toBeNull();
    expect(parseProgressLine('nope')).toBeNull();
    expect(parseProgressLine('{"progress":[]}')).toEqual({ progress: [] });
    expect(parseProgressLine('{"result":{"success":true}}')).toEqual({ result: { success: true } });
  });
});
