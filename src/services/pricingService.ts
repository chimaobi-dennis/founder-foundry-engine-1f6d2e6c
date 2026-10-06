/**
 * Pricing Service — quotes, rules and credit economics.
 *
 * Rules live in ai_generation_pricing (one row per action type), credit
 * economics in platform_settings.credit_economics, provider rates in
 * model_rates. All three are admin-editable; nothing here is hardcoded except
 * the fallbacks used when a row is missing.
 *
 * quoteAction()        — price any action before it runs
 * quoteContentStudio() — ContentStudio brief, using the DB rule
 * getContentStudioRule() — the rule itself, for callers that already use
 *                          calculateGenerationCredits directly
 * creditsForUsage()    — convert real provider usage into credits (metered)
 */

import { supabase } from '@/integrations/supabase/client';
import {
  calculateGenerationCredits,
  DEFAULT_CONTENT_STUDIO_RULE,
  type ContentStudioPricingRule,
  type CreditCalculationInput,
  type CreditBreakdown,
} from '@/utils/calculateGenerationCredits';
import {
  billableCredits,
  costFromUsage,
  creditCogsUsd,
  creditsFromCost,
  DEFAULT_CREDIT_ECONOMICS,
  type CreditEconomics,
  type ModelRate,
  type TokenUsage,
} from '@shared/pricing';

export type {
  CreditEconomics,
  ModelRate,
  TokenUsage,
} from '@shared/pricing';

const db = supabase as any;

// ─── Types ──────────────────────────────────────────────────

export type PricingMode = 'fixed' | 'metered';
export type ModelTier = 'fast' | 'standard' | 'reasoning';

export interface PricingRule {
  id: string;
  pricing_key: string;
  display_name: string;
  description: string | null;
  base_cost: number;
  per_platform_cost: number;
  complexity_multipliers: Record<string, number>;
  feature_multipliers: Record<string, number>;
  model_multipliers: Record<string, number>;
  is_active: boolean;
  pricing_mode: PricingMode;
  model_tier: ModelTier | null;
  range_factor: number;
  cogs_estimate_usd: number | null;
  unit_label: string | null;
}

export interface Quote {
  /** The action this quote is for */
  actionType: string;
  mode: PricingMode;
  /** Credits we expect to charge */
  estimate: number;
  /** Lower bound (equals estimate for fixed pricing) */
  min: number;
  /** Upper bound; what gets reserved for metered actions */
  max: number;
  /** Retail value of the estimate in USD */
  retailUsd: number;
  /** Human-readable lines for a breakdown tooltip */
  breakdown: { label: string; value: string }[];
  /** True when the rule came from the database (not a fallback) */
  fromRule: boolean;
}

export interface QuoteWithBalance extends Quote {
  balance: number;
  balanceAfter: number;
  hasSufficientBalance: boolean;
  /** Credits short of the max, 0 when affordable */
  shortfall: number;
}

// ─── Cache ──────────────────────────────────────────────────

const TTL_MS = 5 * 60 * 1000;
let rulesCache: { at: number; rules: Map<string, PricingRule> } | null = null;
let econCache: { at: number; econ: CreditEconomics } | null = null;
let ratesCache: { at: number; rates: Map<string, ModelRate> } | null = null;

const fresh = (c: { at: number } | null) => !!c && Date.now() - c.at < TTL_MS;

/** Drop cached rules so the next quote re-reads the database (admin saves call this). */
export function invalidatePricingCache(): void {
  rulesCache = null;
  econCache = null;
  ratesCache = null;
}

// ─── Loaders ────────────────────────────────────────────────

export async function getPricingRules(force = false): Promise<Map<string, PricingRule>> {
  if (!force && fresh(rulesCache)) return rulesCache!.rules;
  const { data, error } = await db
    .from('ai_generation_pricing')
    .select('*')
    .eq('is_active', true);
  if (error) {
    console.error('[Pricing] getPricingRules error:', error.message);
    return rulesCache?.rules ?? new Map();
  }
  const rules = new Map<string, PricingRule>();
  (data ?? []).forEach((r: any) => rules.set(r.pricing_key, normalizeRule(r)));
  rulesCache = { at: Date.now(), rules };
  return rules;
}

export async function getPricingRule(key: string): Promise<PricingRule | null> {
  const rules = await getPricingRules();
  return rules.get(key) ?? null;
}

export async function getCreditEconomics(force = false): Promise<CreditEconomics> {
  if (!force && fresh(econCache)) return econCache!.econ;
  const { data } = await db
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', 'credit_economics')
    .maybeSingle();
  const v = (data?.setting_value ?? {}) as Partial<CreditEconomics>;
  const econ: CreditEconomics = {
    retail_usd_per_credit: Number(v.retail_usd_per_credit) || DEFAULT_CREDIT_ECONOMICS.retail_usd_per_credit,
    cogs_multiplier: Number(v.cogs_multiplier) || DEFAULT_CREDIT_ECONOMICS.cogs_multiplier,
  };
  econCache = { at: Date.now(), econ };
  return econ;
}

export async function getModelRates(force = false): Promise<Map<string, ModelRate>> {
  if (!force && fresh(ratesCache)) return ratesCache!.rates;
  const { data } = await db
    .from('model_rates')
    .select('provider_slug, model_id, input_per_1m, output_per_1m, cache_read_per_1m, cache_write_per_1m')
    .eq('is_active', true);
  const rates = new Map<string, ModelRate>();
  (data ?? []).forEach((r: any) => rates.set(`${r.provider_slug}:${r.model_id}`, r));
  ratesCache = { at: Date.now(), rates };
  return rates;
}

/** The ContentStudio rule in the shape calculateGenerationCredits reads. */
export async function getContentStudioRule(): Promise<ContentStudioPricingRule> {
  const rule = await getPricingRule('content_studio_generation');
  return rule ? toContentStudioRule(rule) : DEFAULT_CONTENT_STUDIO_RULE;
}

export function toContentStudioRule(rule: PricingRule): ContentStudioPricingRule {
  return {
    baseCost: rule.base_cost,
    perPlatformCost: rule.per_platform_cost,
    complexityMultipliers: { ...DEFAULT_CONTENT_STUDIO_RULE.complexityMultipliers, ...rule.complexity_multipliers },
    featureMultipliers: { ...DEFAULT_CONTENT_STUDIO_RULE.featureMultipliers, ...rule.feature_multipliers },
  };
}

// ─── Quotes ─────────────────────────────────────────────────

export interface QuoteActionInput {
  /** pricing_key, e.g. 'agent_designed_post' */
  actionType: string;
  /** How many units (products, posts, platforms …). Default 1. */
  units?: number;
  /** Optional multiplier keys to apply from model_multipliers / feature_multipliers */
  options?: string[];
}

/**
 * Pure quote from a rule. Exported so it can be unit-tested without a database.
 */
export function quoteFromRule(
  rule: PricingRule | null,
  input: QuoteActionInput,
  econ: CreditEconomics
): Quote {
  const units = Math.max(1, Math.floor(input.units ?? 1));
  if (!rule) {
    return {
      actionType: input.actionType,
      mode: 'fixed',
      estimate: 0,
      min: 0,
      max: 0,
      retailUsd: 0,
      breakdown: [{ label: 'No pricing rule', value: input.actionType }],
      fromRule: false,
    };
  }

  const breakdown: { label: string; value: string }[] = [];
  let raw = rule.base_cost * units;
  breakdown.push({
    label: `${rule.display_name} × ${units}${rule.unit_label ? ` ${rule.unit_label}${units === 1 ? '' : 's'}` : ''}`,
    value: `${rule.base_cost * units}`,
  });

  for (const key of input.options ?? []) {
    const m = rule.feature_multipliers?.[key] ?? rule.model_multipliers?.[key];
    if (typeof m === 'number' && m !== 1) {
      raw *= m;
      breakdown.push({ label: key.replace(/_/g, ' '), value: `×${m}` });
    }
  }

  const estimate = Math.max(0, Math.ceil(raw - 1e-9));
  const factor = rule.pricing_mode === 'metered' ? Math.max(1, rule.range_factor || 1) : 1;
  const max = Math.ceil(estimate * factor - 1e-9);
  const min = rule.pricing_mode === 'metered' ? Math.max(1, Math.floor(estimate * 0.5)) : estimate;
  if (factor > 1) breakdown.push({ label: 'Metered: reserved up to', value: `${max}` });

  return {
    actionType: input.actionType,
    mode: rule.pricing_mode,
    estimate,
    min,
    max,
    retailUsd: round2(estimate * econ.retail_usd_per_credit),
    breakdown,
    fromRule: true,
  };
}

export async function quoteAction(input: QuoteActionInput): Promise<Quote> {
  const [rule, econ] = await Promise.all([getPricingRule(input.actionType), getCreditEconomics()]);
  return quoteFromRule(rule, input, econ);
}

export async function quoteWithBalance(input: QuoteActionInput, balance: number): Promise<QuoteWithBalance> {
  const q = await quoteAction(input);
  return withBalance(q, balance);
}

export function withBalance(q: Quote, balance: number): QuoteWithBalance {
  const shortfall = Math.max(0, q.max - balance);
  return {
    ...q,
    balance,
    balanceAfter: balance - q.estimate,
    hasSufficientBalance: shortfall === 0,
    shortfall,
  };
}

/** ContentStudio quote built from the database rule. */
export async function quoteContentStudio(
  input: CreditCalculationInput
): Promise<Quote & { breakdownDetail: CreditBreakdown }> {
  const [rule, econ] = await Promise.all([getPricingRule('content_studio_generation'), getCreditEconomics()]);
  const csRule = rule ? toContentStudioRule(rule) : DEFAULT_CONTENT_STUDIO_RULE;
  const { estimatedCredits, breakdown } = calculateGenerationCredits(input, csRule);
  const lines: { label: string; value: string }[] = [
    { label: `Platforms × ${input.platformCount}`, value: `${breakdown.platforms}` },
  ];
  if (breakdown.complexityMultiplier !== 1) lines.push({ label: `Complexity (${input.complexityLevel})`, value: `×${breakdown.complexityMultiplier}` });
  if (breakdown.aiVisualsMultiplier !== 1) lines.push({ label: 'AI visuals', value: `×${breakdown.aiVisualsMultiplier}` });
  if (breakdown.svgCost) lines.push({ label: 'SVG graphics', value: `+${breakdown.svgCost}` });
  if (breakdown.experimentalMultiplier !== 1) lines.push({ label: 'Experimental mode', value: `×${breakdown.experimentalMultiplier}` });
  if (breakdown.aiFreedomMultiplier !== 1) lines.push({ label: 'High AI freedom', value: `×${breakdown.aiFreedomMultiplier}` });
  return {
    actionType: 'content_studio_generation',
    mode: 'fixed',
    estimate: estimatedCredits,
    min: estimatedCredits,
    max: estimatedCredits,
    retailUsd: round2(estimatedCredits * econ.retail_usd_per_credit),
    breakdown: lines,
    fromRule: !!rule,
    breakdownDetail: breakdown,
  };
}

// ─── Metered usage → credits ────────────────────────────────

export interface UsageCredits {
  costUsd: number;
  /** Fractional credits the usage is worth at the current multiplier */
  creditsEquivalent: number;
  /** Whole credits to capture (never undercharges) */
  billableCredits: number;
  /** What one credit costs the platform */
  creditCogsUsd: number;
}

/** Convert real provider usage into credits using model_rates and credit economics. */
export async function creditsForUsage(
  providerSlug: string,
  modelId: string,
  usage: TokenUsage
): Promise<UsageCredits> {
  const [rates, econ] = await Promise.all([getModelRates(), getCreditEconomics()]);
  const rate = rates.get(`${providerSlug}:${modelId}`) ?? null;
  return usageCredits(usage, rate, econ);
}

/** Pure version for tests and for callers that already hold the rate. */
export function usageCredits(usage: TokenUsage, rate: ModelRate | null, econ: CreditEconomics): UsageCredits {
  const costUsd = costFromUsage(usage, rate);
  return {
    costUsd,
    creditsEquivalent: creditsFromCost(costUsd, econ),
    billableCredits: billableCredits(costUsd, econ),
    creditCogsUsd: creditCogsUsd(econ),
  };
}

// ─── helpers ────────────────────────────────────────────────

function normalizeRule(r: any): PricingRule {
  return {
    id: r.id,
    pricing_key: r.pricing_key,
    display_name: r.display_name ?? r.pricing_key,
    description: r.description ?? null,
    base_cost: Number(r.base_cost) || 0,
    per_platform_cost: Number(r.per_platform_cost) || 0,
    complexity_multipliers: r.complexity_multipliers ?? {},
    feature_multipliers: r.feature_multipliers ?? {},
    model_multipliers: r.model_multipliers ?? {},
    is_active: r.is_active !== false,
    pricing_mode: r.pricing_mode === 'metered' ? 'metered' : 'fixed',
    model_tier: r.model_tier ?? null,
    range_factor: Number(r.range_factor) || 1,
    cogs_estimate_usd: r.cogs_estimate_usd == null ? null : Number(r.cogs_estimate_usd),
    unit_label: r.unit_label ?? null,
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
