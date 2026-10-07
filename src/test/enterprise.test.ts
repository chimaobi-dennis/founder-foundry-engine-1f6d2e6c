import { describe, it, expect } from 'vitest';
import { isIdent, parseTable, sqlSelect, sqlUpdate, tableScope } from '@shared/postgres';
import { autoMergeEligible } from '@shared/github';
import { allowedFields, PROVIDERS } from '@shared/connectors';
import { planRecipeRun, recipeUnits, RECIPES, type AgentDefinition } from '@shared/runner';

const conn = { config: { table: 'shop.products', key_column: 'id', label_column: 'name' }, scope: { fields: ['name', 'description', 'Meta_Description', 'bad name', 'id'] } };

describe('database connections', () => {
  it('accepts only plain identifiers', () => {
    expect(isIdent('meta_description')).toBe(true);
    expect(isIdent('Drop Table')).toBe(false);
    expect(isIdent('a"b')).toBe(false);
    expect(parseTable('orders')).toEqual({ schema: 'public', table: 'orders' });
    expect(parseTable('shop.orders')).toEqual({ schema: 'shop', table: 'orders' });
    expect(parseTable('shop.orders; drop table x')).toBeNull();
  });

  it('builds parameterised SQL from validated names only', () => {
    const s = tableScope(conn);
    expect(s.columns).toEqual(['name', 'description', 'meta_description']);
    expect(sqlSelect(s)).toBe('SELECT "id"::text AS "id", "name"::text AS "name", "description"::text AS "description", "meta_description"::text AS "meta_description" FROM "shop"."products" ORDER BY "id" LIMIT $1');
    const u = sqlUpdate(s, { description: 'New copy', price: '0', meta_description: 'Meta' });
    expect(u.text).toBe('UPDATE "shop"."products" SET "description" = $1, "meta_description" = $2 WHERE "id"::text = $3 RETURNING "id"::text AS "id"');
    expect(u.params).toEqual(['New copy', 'Meta']);
  });

  it('refuses to update when no allowed column is touched', () => {
    expect(() => sqlUpdate(tableScope(conn), { price: '1' })).toThrow(/No allowed columns/);
  });

  it('exposes the listed columns as the allowed fields', () => {
    expect(allowedFields('postgres', conn.scope)).toEqual(['name', 'description', 'meta_description', 'id']);
    expect(PROVIDERS.postgres.kind).toBe('records');
  });
});

describe('auto-merge eligibility', () => {
  it('needs every path under an auto-merge glob and never a protected path', () => {
    expect(autoMergeEligible(['content/blog/post.md'], ['content/**'])).toBe(true);
    expect(autoMergeEligible(['content/blog/post.md', 'src/App.tsx'], ['content/**'])).toBe(false);
    expect(autoMergeEligible(['.github/workflows/ci.yml'], ['**'])).toBe(false);
    expect(autoMergeEligible(['content/x.md'], [])).toBe(false);
    expect(autoMergeEligible([], ['content/**'])).toBe(false);
  });
});

describe('table_refresh recipe', () => {
  const agent: AgentDefinition = { id: 'a', slug: 'seo_specialist', name: 'SEO Specialist', role: 'SEO', system_prompt: '', model_tier: 'standard', action_type: 'agent_seo_refresh', unit_label: 'row', per_run_credit_ceiling: 200, cost_indicator: 2, output_spec: {} };
  it('reads, proposes, reviews, then applies', () => {
    expect(RECIPES.table_refresh.provider).toBe('postgres');
    const steps = planRecipeRun('table_refresh', agent, { brief: 'Tighten names', connection_id: 'c', record_limit: 10 });
    expect(steps.map((s) => s.type)).toEqual(['connector', 'agent_task', 'approval', 'connector']);
    expect(steps[0].name).toBe('Read up to 10 rows');
    expect(recipeUnits('table_refresh', { brief: '', connection_id: 'c', record_limit: 10 })).toBe(10);
  });
});
