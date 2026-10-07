/**
 * Connection Service — the founder's links to external tools.
 *
 * Credentials go straight to the set_connection_secret RPC and are never
 * read back; everything that needs them runs in edge functions.
 */

import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_CONFIG } from '@/config/supabaseConfig';
import { PROVIDERS, allowedFields, type ConnectorProvider, type ConnectionScope, type Capability, type NormalizedRecord } from '@shared/connectors';
import { RECIPES, planRecipeRun, recipeUnits, normalizeUnits, DEFAULT_BUDGET, DEFAULT_POLICY, type RecipeKey, type RecipeInput, type RunPolicy, type RunBudget } from '@shared/runner';
import { quoteAction, type Quote } from './pricingService';
import { kickRun, type Agent, type AutomationRun } from './agentService';

export { PROVIDERS, RECIPES, allowedFields };
export type { ConnectorProvider, ConnectionScope, Capability, NormalizedRecord, RecipeKey, RecipeInput };

const db = supabase as any;

export interface ToolConnection {
  id: string;
  brand_id: string;
  user_id: string;
  provider: ConnectorProvider;
  display_name: string;
  capabilities: Capability[];
  scope: ConnectionScope;
  config: Record<string, string>;
  status: 'active' | 'paused' | 'error';
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface ChangeSet {
  id: string;
  connection_id: string | null;
  run_id: string | null;
  provider: string;
  action: 'update_record' | 'create_record';
  target_type: string;
  target_id: string;
  target_label: string | null;
  before: Record<string, string>;
  after: Record<string, string>;
  reverted_at: string | null;
  revert_error: string | null;
  created_at: string;
}

// ─── Connections ────────────────────────────────────────────

export async function listConnections(brandId: string): Promise<ToolConnection[]> {
  const { data, error } = await db.from('tool_connections').select('*').eq('brand_id', brandId).order('created_at');
  if (error) {
    console.error('[Connections] listConnections error:', error.message);
    return [];
  }
  return data ?? [];
}

export interface CreateConnectionInput {
  brandId: string;
  userId: string;
  provider: ConnectorProvider;
  displayName: string;
  config: Record<string, string>;
  secret: Record<string, string>;
  allowWrites: boolean;
  fields?: string[];
  maxRecordsPerRun?: number;
}

export async function createConnection(input: CreateConnectionInput): Promise<{ success: boolean; error?: string; connection?: ToolConnection }> {
  const spec = PROVIDERS[input.provider];
  if (!spec) return { success: false, error: 'Unknown provider' };
  const { data, error } = await db
    .from('tool_connections')
    .insert({
      brand_id: input.brandId,
      user_id: input.userId,
      provider: input.provider,
      display_name: input.displayName.trim() || spec.name,
      capabilities: input.allowWrites ? ['read', 'data_write'] : ['read'],
      scope: { fields: input.fields?.length ? input.fields : undefined, max_records_per_run: input.maxRecordsPerRun ?? 50 },
      config: input.config,
      status: 'active',
    })
    .select('*')
    .single();
  if (error) return { success: false, error: error.message };

  const { data: sec, error: secErr } = await db.rpc('set_connection_secret', { p_connection_id: data.id, p_secret: input.secret });
  if (secErr || !sec?.success) {
    await db.from('tool_connections').delete().eq('id', data.id);
    return { success: false, error: secErr?.message ?? sec?.error ?? 'Could not save credentials' };
  }
  return { success: true, connection: data };
}

export async function updateConnectionScope(id: string, patch: { allowWrites?: boolean; fields?: string[]; maxRecordsPerRun?: number; status?: 'active' | 'paused' }): Promise<boolean> {
  const update: Record<string, unknown> = {};
  if (patch.allowWrites != null) update.capabilities = patch.allowWrites ? ['read', 'data_write'] : ['read'];
  if (patch.fields || patch.maxRecordsPerRun != null) {
    const { data: cur } = await db.from('tool_connections').select('scope').eq('id', id).maybeSingle();
    update.scope = { ...(cur?.scope ?? {}), ...(patch.fields ? { fields: patch.fields } : {}), ...(patch.maxRecordsPerRun != null ? { max_records_per_run: patch.maxRecordsPerRun } : {}) };
  }
  if (patch.status) update.status = patch.status;
  const { error } = await db.from('tool_connections').update(update).eq('id', id);
  return !error;
}

export async function replaceConnectionSecret(id: string, secret: Record<string, string>): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await db.rpc('set_connection_secret', { p_connection_id: id, p_secret: secret });
  if (error) return { success: false, error: error.message };
  return data?.success ? { success: true } : { success: false, error: data?.error ?? 'Could not save credentials' };
}

export async function removeConnection(id: string): Promise<boolean> {
  const { error } = await db.from('tool_connections').delete().eq('id', id);
  return !error;
}

// ─── Edge function calls ────────────────────────────────────

async function callConnectorAction(body: Record<string, unknown>): Promise<any> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { success: false, error: 'Not signed in' };
  try {
    const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/connector-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_CONFIG.anonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return json ?? { success: false, error: `connector-action returned ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Could not reach the connector service' };
  }
}

export async function testConnection(id: string): Promise<{ success: boolean; error?: string; info?: Record<string, unknown> }> {
  return callConnectorAction({ connectionId: id, action: 'test' });
}

export async function previewRecords(id: string, limit = 5): Promise<{ success: boolean; error?: string; records?: NormalizedRecord[] }> {
  return callConnectorAction({ connectionId: id, action: 'list_records', limit });
}

export async function revertChange(changeSetId: string): Promise<{ success: boolean; error?: string }> {
  return callConnectorAction({ changeSetId, action: 'revert' });
}

// ─── Change sets ────────────────────────────────────────────

export async function listChangeSets(brandId: string, limit = 50): Promise<ChangeSet[]> {
  const { data, error } = await db
    .from('change_sets')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[Connections] listChangeSets error:', error.message);
    return [];
  }
  return data ?? [];
}

// ─── Recipes ────────────────────────────────────────────────

export async function quoteRecipe(recipe: RecipeKey, agent: Pick<Agent, 'action_type'>, input: RecipeInput): Promise<Quote> {
  return quoteAction({ actionType: agent.action_type, units: recipeUnits(recipe, input) });
}

export interface StartRecipeInput {
  recipe: RecipeKey;
  brandId: string;
  userId: string;
  agent: Agent;
  connection: ToolConnection;
  name: string;
  input: RecipeInput;
  policy?: RunPolicy;
  budget?: Partial<RunBudget>;
}

/** A recipe run: read → agent → (review) → write, quoted on the agent step. */
export async function startRecipe(params: StartRecipeInput): Promise<{ success: boolean; error?: string; run?: AutomationRun; quote?: Quote }> {
  const { recipe, brandId, userId, agent, connection, name, input } = params;
  const spec = RECIPES[recipe];
  if (!spec) return { success: false, error: 'Unknown recipe' };
  if (connection.provider !== spec.provider) return { success: false, error: `${spec.name} needs a ${PROVIDERS[spec.provider].name} connection.` };
  if (!connection.capabilities.includes('data_write')) return { success: false, error: `Allow data writes on "${connection.display_name}" first; this recipe changes records.` };
  const policy = params.policy ?? DEFAULT_POLICY;
  const quote = await quoteRecipe(recipe, agent, input);
  if (!quote.fromRule) return { success: false, error: `No pricing rule for ${agent.name}.` };
  const budget: RunBudget = { ...DEFAULT_BUDGET, credits_per_run: Math.min(DEFAULT_BUDGET.credits_per_run, agent.per_run_credit_ceiling), ...(params.budget ?? {}) };
  const steps = planRecipeRun(recipe, agent, { ...input, connection_id: connection.id }, policy);

  const { data: run, error } = await db
    .from('automation_runs')
    .insert({
      brand_id: brandId,
      user_id: userId,
      agent_id: agent.id,
      name: name.trim() || `${spec.name} · ${connection.display_name}`,
      trigger_type: 'manual',
      status: 'queued',
      input: { ...input, connection_id: connection.id, recipe, units: normalizeUnits(recipeUnits(recipe, input), 250) },
      policy,
      budget,
      credits_quoted: quote.estimate,
      credits_reserved: quote.max,
    })
    .select('*')
    .single();
  if (error) return { success: false, error: error.message };

  const { error: stepErr } = await db.from('automation_run_steps').insert(
    steps.map((s) => ({ run_id: run.id, step_index: s.step_index, type: s.type, name: s.name, input: s.input }))
  );
  if (stepErr) {
    await db.from('automation_runs').update({ status: 'failed', error: stepErr.message }).eq('id', run.id);
    return { success: false, error: stepErr.message };
  }
  void kickRun(run.id);
  return { success: true, run, quote };
}
