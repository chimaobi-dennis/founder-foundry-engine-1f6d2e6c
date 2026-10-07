import { describe, it, expect } from 'vitest';
import { allowedFields, pickAllowedChanges, diffLines, PROVIDERS, type NormalizedRecord } from '@shared/connectors';
import { planRecipeRun, recipeUnits, type AgentDefinition } from '@shared/runner';

const agent: AgentDefinition = {
  id: 'seo', slug: 'seo_specialist', name: 'SEO Specialist', role: 'SEO', system_prompt: '', model_tier: 'standard',
  action_type: 'agent_seo_refresh', unit_label: 'product', per_run_credit_ceiling: 200, cost_indicator: 2, output_spec: {},
};

const records: NormalizedRecord[] = [
  { id: '1', label: 'Blue Mug', fields: { title: 'Blue Mug', body_html: '<p>x</p>', tags: '', seo_title: '', seo_description: '' } },
  { id: '2', label: 'Red Mug', fields: { title: 'Red Mug', body_html: '', tags: '', seo_title: 'Red Mug | Shop', seo_description: 'old' } },
];

describe('allowedFields', () => {
  it('uses provider defaults when the scope has none', () => {
    expect(allowedFields('shopify', {})).toEqual(['seo_title', 'seo_description']);
    expect(allowedFields('wordpress', null)).toEqual(['title', 'excerpt']);
  });
  it('honours the scope and drops unknown fields', () => {
    expect(allowedFields('shopify', { fields: ['title', 'bogus'] })).toEqual(['title']);
  });
});

describe('pickAllowedChanges', () => {
  it('keeps allowed, changed, non-empty, in-length strings only', () => {
    const { fields, rejected } = pickAllowedChanges('shopify', ['seo_title', 'seo_description'], records[1].fields, {
      seo_title: 'Red Mug | Shop',            // unchanged
      seo_description: 'A hand-glazed red mug.', // changed
      title: 'Nope',                            // not allowed
      tags: 123 as unknown as string,           // not a string
    });
    expect(fields).toEqual({ seo_description: 'A hand-glazed red mug.' });
    expect(rejected.map((r) => r.field).sort()).toEqual(['tags', 'title']);
  });
  it('rejects values over the provider max length', () => {
    const long = 'x'.repeat(PROVIDERS.shopify.fields.find((f) => f.key === 'seo_title')!.maxLength! + 1);
    const { fields, rejected } = pickAllowedChanges('shopify', ['seo_title'], {}, { seo_title: long });
    expect(fields).toEqual({});
    expect(rejected[0].reason).toContain('longer');
  });
});

describe('diffLines', () => {
  it('produces one line per changed field and ignores unknown records', () => {
    const { lines, applied, rejected } = diffLines(records, [
      { target_id: '1', fields: { seo_title: 'Blue Mug · Hand-glazed', seo_description: 'A blue mug.' } },
      { target_id: '99', fields: { seo_title: 'ghost' } },
    ], 'shopify', ['seo_title', 'seo_description']);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ target_id: '1', field: 'seo_title', before: '', after: 'Blue Mug · Hand-glazed' });
    expect(applied).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ target_id: '99', field: '*' });
  });
});

describe('planRecipeRun', () => {
  it('seo_refresh reads, proposes, reviews, writes', () => {
    const steps = planRecipeRun('seo_refresh', agent, { brief: 'b', connection_id: 'c1', record_limit: 10 });
    expect(steps.map((s) => s.type)).toEqual(['connector', 'agent_task', 'approval', 'connector']);
    expect(steps[0].input).toMatchObject({ action: 'list_records', limit: 10 });
    expect(steps[1].input).toMatchObject({ use_previous: 'records', units: 10 });
    expect(steps[3].input).toMatchObject({ action: 'apply_changes' });
  });
  it('autonomous policy drops the review but keeps the write', () => {
    const steps = planRecipeRun('seo_refresh', agent, { brief: 'b', connection_id: 'c1' }, { approval: 'autonomous' });
    expect(steps.map((s) => s.type)).toEqual(['connector', 'agent_task', 'connector']);
  });
  it('blog_draft writes, reviews, creates a draft', () => {
    const steps = planRecipeRun('blog_draft', { ...agent, slug: 'copywriter', name: 'Copywriter' }, { brief: 'b', connection_id: 'c1' });
    expect(steps.map((s) => s.type)).toEqual(['agent_task', 'approval', 'connector']);
    expect(steps[2].input).toMatchObject({ action: 'create_draft' });
  });
  it('quotes on the record limit, clamped', () => {
    expect(recipeUnits('seo_refresh', { brief: '', connection_id: 'c', record_limit: 1000 })).toBe(250);
    expect(recipeUnits('seo_refresh', { brief: '', connection_id: 'c' })).toBe(25);
    expect(recipeUnits('blog_draft', { brief: '', connection_id: 'c' })).toBe(1);
  });
});
