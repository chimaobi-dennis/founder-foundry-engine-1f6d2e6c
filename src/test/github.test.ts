import { describe, it, expect } from 'vitest';
import { globToRegExp, matchesAny, isProtectedPath, pathWriteVerdict, validateEdit, parseRepo, slugifyBranch, MAX_FILES_PER_PR } from '@shared/github';
import { planRecipeRun, type AgentDefinition } from '@shared/runner';

describe('globs', () => {
  it('matches ** across directories and * within a segment', () => {
    expect(globToRegExp('src/**').test('src/a/b/c.ts')).toBe(true);
    expect(globToRegExp('src/**').test('src')).toBe(false);
    expect(globToRegExp('*.md').test('README.md')).toBe(true);
    expect(globToRegExp('*.md').test('docs/README.md')).toBe(false);
    expect(globToRegExp('**/*.lock').test('a/b/yarn.lock')).toBe(true);
    expect(globToRegExp('**/*.lock').test('yarn.lock')).toBe(true);
    expect(matchesAny('./src/x.ts', ['src/**'])).toBe(true);
  });
});

describe('path policy', () => {
  it('protects secrets, CI, lockfiles and migrations no matter the allowlist', () => {
    for (const p of ['.env', '.env.local', 'app/.env', '.github/workflows/ci.yml', 'package-lock.json', 'src/keys/server.pem', 'supabase/migrations/x.sql', 'node_modules/x/index.js']) {
      expect(isProtectedPath(p)).toBe(true);
      expect(pathWriteVerdict(p, ['**']).ok).toBe(false);
    }
  });
  it('allows writes under the allowlist only', () => {
    expect(pathWriteVerdict('src/pages/Home.tsx', ['src/**'])).toEqual({ ok: true });
    expect(pathWriteVerdict('server/index.ts', ['src/**']).ok).toBe(false);
    expect(pathWriteVerdict('../etc/passwd', ['**']).ok).toBe(false);
  });
});

describe('validateEdit', () => {
  it('drops protected, outside, oversized, duplicate and content-less changes', () => {
    const big = 'x'.repeat(200_000);
    const v = validateEdit([
      { path: 'src/a.ts', action: 'update', content: 'ok' },
      { path: 'src/a.ts', action: 'update', content: 'dupe' },
      { path: '.env', action: 'update', content: 'X=1' },
      { path: 'lib/b.ts', action: 'create', content: 'nope' },
      { path: 'src/c.ts', action: 'update' },
      { path: 'src/d.ts', action: 'create', content: big },
      { path: 'src/e.ts', action: 'delete' },
    ], ['src/**']);
    expect(v.accepted.map((a) => `${a.action}:${a.path}`)).toEqual(['update:src/a.ts', 'delete:src/e.ts']);
    expect(v.rejected.map((r) => r.path)).toEqual(['src/a.ts', '.env', 'lib/b.ts', 'src/c.ts', 'src/d.ts']);
  });
  it('caps the number of files per pull request', () => {
    const many = Array.from({ length: MAX_FILES_PER_PR + 2 }, (_, i) => ({ path: `src/f${i}.ts`, action: 'update' as const, content: 'x' }));
    const v = validateEdit(many, ['src/**']);
    expect(v.accepted).toHaveLength(MAX_FILES_PER_PR);
    expect(v.rejected).toHaveLength(2);
  });
});

describe('repo helpers', () => {
  it('parses owner/name and GitHub URLs', () => {
    expect(parseRepo('acme/site')).toEqual({ owner: 'acme', repo: 'site' });
    expect(parseRepo('https://github.com/acme/site.git')).toEqual({ owner: 'acme', repo: 'site' });
    expect(parseRepo('not a repo')).toBeNull();
  });
  it('makes a safe branch name under the kinika/ prefix', () => {
    expect(slugifyBranch('Update hero copy & colors!')).toMatch(/^kinika\/update-hero-copy-colors-[a-z0-9]{5}$/);
  });
});

describe('code_change plan', () => {
  const dev: AgentDefinition = { id: 'd', slug: 'developer', name: 'Developer', role: 'Developer', system_prompt: '', model_tier: 'reasoning', action_type: 'agent_code_change', unit_label: 'change', per_run_credit_ceiling: 400, cost_indicator: 3, output_spec: {} };
  it('snapshots, plans, reads, edits, reviews, opens a PR', () => {
    const steps = planRecipeRun('code_change', dev, { brief: 'Change the hero', connection_id: 'c' });
    expect(steps.map((s) => s.type)).toEqual(['connector', 'agent_task', 'connector', 'agent_task', 'approval', 'connector']);
    expect(steps[1].input).toMatchObject({ prompt_mode: 'plan', charge: false });
    expect(steps[3].input).toMatchObject({ prompt_mode: 'edit', max_tokens: 16000 });
    expect(steps[5].input).toMatchObject({ action: 'open_pr' });
  });
  it('autonomous still ends in a PR the founder merges', () => {
    const steps = planRecipeRun('code_change', dev, { brief: 'x', connection_id: 'c' }, { approval: 'autonomous' });
    expect(steps.map((s) => s.type)).toEqual(['connector', 'agent_task', 'connector', 'agent_task', 'connector']);
  });
});
