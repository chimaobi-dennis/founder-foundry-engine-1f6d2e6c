/**
 * billingAdminService.ts
 *
 * Admin APIs for billing management.
 * All mutations require service role (adminSupabase).
 *
 * Provides:
 *   - Credit package CRUD
 *   - Generation pricing CRUD
 *   - Platform settings CRUD
 *   - Manual credit grants
 *   - Billing analytics
 */

import { supabase } from '@/integrations/supabase/client';
import { adminSupabase } from './adminServiceSupabase';

const db = supabase as any;

function getAdmin() {
  if (!adminSupabase) {
    throw new Error('Service role key not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to env.');
  }
  return adminSupabase as any;
}

// ═══════════════════════════════════════════════════════════════
// CREDIT PACKAGE CRUD
// ═══════════════════════════════════════════════════════════════

export interface CreditPackageRow {
  id: string;
  name: string;
  credits: number;
  price_usd: number;
  description: string | null;
  badge: string | null;
  stripe_price_id: string | null;
  active: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export async function listCreditPackages(): Promise<CreditPackageRow[]> {
  const { data, error } = await db
    .from('credit_packages')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[BillingAdmin] listCreditPackages error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function createCreditPackage(pkg: {
  name: string;
  credits: number;
  price_usd: number;
  description?: string;
  badge?: string;
  stripe_price_id?: string;
  sort_order?: number;
  active?: boolean;
}): Promise<CreditPackageRow | null> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('credit_packages')
    .insert({
      name: pkg.name,
      credits: pkg.credits,
      price_usd: pkg.price_usd,
      description: pkg.description ?? null,
      badge: pkg.badge ?? null,
      stripe_price_id: pkg.stripe_price_id ?? null,
      sort_order: pkg.sort_order ?? 0,
      active: pkg.active ?? true,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[BillingAdmin] createCreditPackage error:', error.message);
    return null;
  }
  return data;
}

export async function updateCreditPackage(
  id: string,
  updates: Partial<Omit<CreditPackageRow, 'id' | 'created_at'>>
): Promise<CreditPackageRow | null> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('credit_packages')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[BillingAdmin] updateCreditPackage error:', error.message);
    return null;
  }
  return data;
}

export async function deleteCreditPackage(id: string): Promise<boolean> {
  const admin = getAdmin();
  const { error } = await admin
    .from('credit_packages')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[BillingAdmin] deleteCreditPackage error:', error.message);
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
// GENERATION PRICING CRUD
// ═══════════════════════════════════════════════════════════════

export interface GenerationPricingRow {
  id: string;
  pricing_key: string;
  display_name: string;
  base_cost: number;
  model_multipliers: Record<string, number>;
  feature_multipliers: Record<string, number>;
  per_platform_cost: number;
  complexity_multipliers: Record<string, number>;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export async function listGenerationPricing(): Promise<GenerationPricingRow[]> {
  const { data, error } = await db
    .from('ai_generation_pricing')
    .select('*')
    .order('pricing_key');

  if (error) {
    console.error('[BillingAdmin] listGenerationPricing error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function updateGenerationPricing(
  id: string,
  updates: Partial<Omit<GenerationPricingRow, 'id' | 'created_at'>>
): Promise<GenerationPricingRow | null> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('ai_generation_pricing')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[BillingAdmin] updateGenerationPricing error:', error.message);
    return null;
  }
  return data;
}

export async function createGenerationPricing(pricing: {
  pricing_key: string;
  display_name: string;
  base_cost: number;
  per_platform_cost?: number;
  model_multipliers?: Record<string, number>;
  feature_multipliers?: Record<string, number>;
  complexity_multipliers?: Record<string, number>;
  description?: string;
}): Promise<GenerationPricingRow | null> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('ai_generation_pricing')
    .insert({
      pricing_key: pricing.pricing_key,
      display_name: pricing.display_name,
      base_cost: pricing.base_cost,
      per_platform_cost: pricing.per_platform_cost ?? 1,
      model_multipliers: pricing.model_multipliers ?? {},
      feature_multipliers: pricing.feature_multipliers ?? {},
      complexity_multipliers: pricing.complexity_multipliers ?? { simple: 0.75, balanced: 1, advanced: 1.5, experimental: 2 },
      description: pricing.description ?? null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[BillingAdmin] createGenerationPricing error:', error.message);
    return null;
  }
  return data;
}

// ═══════════════════════════════════════════════════════════════
// PLATFORM SETTINGS CRUD (billing-specific)
// ═══════════════════════════════════════════════════════════════

export interface BillingSettings {
  stripe_live_mode: boolean;
  free_trial_credits: number;
  max_retry_count: number;
  default_generation_cost: number;
}

const BILLING_SETTINGS_KEY = 'billing';

const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  stripe_live_mode: false,
  free_trial_credits: 10,
  max_retry_count: 3,
  default_generation_cost: 1,
};

export async function getBillingSettings(): Promise<BillingSettings> {
  const { data, error } = await db
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', BILLING_SETTINGS_KEY)
    .maybeSingle();

  if (error || !data) {
    return { ...DEFAULT_BILLING_SETTINGS };
  }

  // Parse JSON string from setting_value
  let value: Partial<BillingSettings> = {};
  try {
    if (typeof data.setting_value === 'string') {
      value = JSON.parse(data.setting_value) as Partial<BillingSettings>;
    } else if (data.setting_value && typeof data.setting_value === 'object') {
      value = data.setting_value as Partial<BillingSettings>;
    }
  } catch (parseError) {
    console.error('[BillingAdmin] Failed to parse billing settings JSON:', parseError);
    return { ...DEFAULT_BILLING_SETTINGS };
  }

  return {
    stripe_live_mode: value.stripe_live_mode ?? DEFAULT_BILLING_SETTINGS.stripe_live_mode,
    free_trial_credits: value.free_trial_credits ?? DEFAULT_BILLING_SETTINGS.free_trial_credits,
    max_retry_count: value.max_retry_count ?? DEFAULT_BILLING_SETTINGS.max_retry_count,
    default_generation_cost: value.default_generation_cost ?? DEFAULT_BILLING_SETTINGS.default_generation_cost,
  };
}

export async function updateBillingSettings(
  updates: Partial<BillingSettings>
): Promise<BillingSettings | null> {
  const admin = getAdmin();
  const current = await getBillingSettings();
  const merged = { ...current, ...updates };

  const { data, error } = await admin
    .from('platform_settings')
    .upsert(
      {
        setting_key: BILLING_SETTINGS_KEY,
        setting_value: merged,
        description: 'Billing and Stripe configuration',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'setting_key' }
    )
    .select('setting_value')
    .single();

  if (error) {
    console.error('[BillingAdmin] updateBillingSettings error:', error.message);
    return null;
  }
  return data?.setting_value as BillingSettings;
}

// ═══════════════════════════════════════════════════════════════
// MANUAL CREDIT GRANTS
// ═══════════════════════════════════════════════════════════════

/**
 * Grant free trial credits to a new user after onboarding completion.
 * Reads free_trial_credits from billing settings and grants them as a bonus.
 * Prevents duplicate grants by checking for existing free trial transactions.
 */
export async function grantFreeTrialCredits(userId: string): Promise<{ success: boolean; error?: string; amount?: number; transactionId?: string; balanceAfter?: number; alreadyGranted?: boolean }> {
  try {
    // Check if user already received free trial credits
    const admin = getAdmin();
    const { data: existingTransactions, error: checkError } = await admin
      .from('wallet_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('transaction_type', 'topup')
      .filter('metadata->>description', 'ilike', '%free trial%')
      .limit(1);

    if (checkError) {
      console.error('[BillingAdmin] Error checking for existing free trial:', checkError.message);
    }

    if (existingTransactions && existingTransactions.length > 0) {
      console.log('[BillingAdmin] Free trial credits already granted to user:', userId);
      return { success: true, amount: 0, alreadyGranted: true };
    }

    // Get the free trial credits amount from settings
    const billingSettings = await getBillingSettings();
    const freeTrialCredits = billingSettings.free_trial_credits ?? DEFAULT_BILLING_SETTINGS.free_trial_credits;

    if (freeTrialCredits <= 0) {
      return { success: true, amount: 0 }; // No free trial configured
    }

    // Grant the credits as a bonus
    const result = await grantCreditsToUser({
      userId,
      amount: freeTrialCredits,
      type: 'bonus',
      description: `Free trial credits (${freeTrialCredits} credits)`,
    });

    if (result.success) {
      console.log('[BillingAdmin] Free trial credits granted:', { userId, amount: freeTrialCredits, transactionId: result.transactionId });
      return {
        success: true,
        amount: freeTrialCredits,
        transactionId: result.transactionId,
        balanceAfter: result.balanceAfter,
      };
    } else {
      return { success: false, error: result.error };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[BillingAdmin] grantFreeTrialCredits error:', message);
    return { success: false, error: message };
  }
}

export async function grantCreditsToUser(params: {
  userId: string;
  amount: number;
  type?: 'bonus' | 'adjustment' | 'topup';
  description?: string;
  adminUserId?: string;
}): Promise<{ success: boolean; error?: string; transactionId?: string; balanceAfter?: number }> {
  const admin = getAdmin();

  const idempotencyKey = `admin_grant_${params.userId}_${Date.now()}`;

  const { data, error } = await admin.rpc('grant_credits_admin', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_type: params.type || 'bonus',
    p_description: params.description || 'Admin credit grant',
    p_admin_user_id: params.adminUserId || null,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error('[BillingAdmin] grantCreditsToUser error:', error.message);
    return { success: false, error: error.message };
  }

  const result = data as Record<string, any>;
  return {
    success: result.success,
    error: result.error,
    transactionId: result.transaction_id,
    balanceAfter: result.balance_after != null ? Number(result.balance_after) : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════
// BILLING ANALYTICS
// ═══════════════════════════════════════════════════════════════

export interface BillingAnalytics {
  totalRevenue: number;
  totalPurchases: number;
  completedPurchases: number;
  totalCreditsGranted: number;
  totalCreditsSpent: number;
  activeWallets: number;
  averageBalance: number;
}

export async function getBillingAnalytics(): Promise<BillingAnalytics> {
  const admin = getAdmin();

  const [purchaseStats, walletStats] = await Promise.all([
    // Purchase stats
    admin
      .from('credit_purchases')
      .select('status, amount_usd, credits')
      .then(({ data }: any) => {
        const purchases = data || [];
        const completed = purchases.filter((p: any) => p.status === 'completed');
        return {
          totalPurchases: purchases.length,
          completedPurchases: completed.length,
          totalRevenue: completed.reduce((sum: number, p: any) => sum + Number(p.amount_usd || 0), 0),
          totalCreditsGranted: completed.reduce((sum: number, p: any) => sum + Number(p.credits || 0), 0),
        };
      }),

    // Wallet stats
    admin
      .from('wallets')
      .select('balance, lifetime_spent')
      .then(({ data }: any) => {
        const wallets = data || [];
        const totalBalance = wallets.reduce((sum: number, w: any) => sum + Number(w.balance || 0), 0);
        const totalSpent = wallets.reduce((sum: number, w: any) => sum + Number(w.lifetime_spent || 0), 0);
        return {
          activeWallets: wallets.length,
          averageBalance: wallets.length > 0 ? Math.round((totalBalance / wallets.length) * 100) / 100 : 0,
          totalCreditsSpent: totalSpent,
        };
      }),
  ]);

  return {
    totalRevenue: purchaseStats.totalRevenue,
    totalPurchases: purchaseStats.totalPurchases,
    completedPurchases: purchaseStats.completedPurchases,
    totalCreditsGranted: purchaseStats.totalCreditsGranted,
    totalCreditsSpent: walletStats.totalCreditsSpent,
    activeWallets: walletStats.activeWallets,
    averageBalance: walletStats.averageBalance,
  };
}

/**
 * Get all purchases across all users (admin view).
 */
export async function getAllPurchases(options?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<any[]> {
  const admin = getAdmin();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = admin
    .from('credit_purchases')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[BillingAdmin] getAllPurchases error:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Get all wallets with user info (admin view).
 */
export async function getAllWallets(options?: {
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const admin = getAdmin();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error } = await admin
    .from('wallets')
    .select('*')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[BillingAdmin] getAllWallets error:', error.message);
    return [];
  }
  return data ?? [];
}
