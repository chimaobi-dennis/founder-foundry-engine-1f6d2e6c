/**
 * Generation Credit Service — Production-grade billing for AI generation.
 *
 * Architecture:
 * - All balance mutations happen server-side via Supabase RPC (plpgsql functions)
 * - Functions use SELECT ... FOR UPDATE to prevent race conditions
 * - Immutable ledger: transactions are never modified or deleted
 * - Idempotency keys prevent duplicate charges from tab spam / retries
 * - Every charge produces a billing event that tracks the full lifecycle
 *
 * Public API:
 * - chargeGenerationCredits()  — atomic deduction before generation
 * - refundGenerationCredits()  — atomic refund on failure
 * - completeGenerationBilling() — mark billing event as completed
 * - estimateGenerationCost()   — preview cost (no mutations)
 * - getWalletBalance()         — current balance
 * - getTransactionHistory()    — paginated ledger
 * - getBillingEvent()          — single event lookup
 * - addCredits()               — admin/purchase top-up
 */

import { supabase } from '@/integrations/supabase/client';
import { calculateGenerationCredits, type CreditCalculationInput, type CreditBreakdown } from '@/utils/calculateGenerationCredits';
import { logError } from './errorService';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChargeResult {
  success: boolean;
  error?: string;
  message?: string;
  billingEventId?: string;
  transactionId?: string;
  creditsCharged?: number;
  balanceBefore?: number;
  balanceAfter?: number;
}

export interface RefundResult {
  success: boolean;
  error?: string;
  message?: string;
  transactionId?: string;
  refundAmount?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  newStatus?: string;
}

export interface CompleteResult {
  success: boolean;
  error?: string;
  billingEventId?: string;
  netCost?: number;
}

export interface WalletBalance {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  lifetimeRefunded: number;
  walletId: string;
}

export interface CreditEstimate {
  totalCredits: number;
  breakdown: CreditBreakdown;
  hasSufficientBalance: boolean;
  currentBalance: number;
  balanceAfterCharge: number;
}

export interface BillingEvent {
  id: string;
  userId: string;
  briefId: string | null;
  generationSessionId: string | null;
  creditsCharged: number;
  creditsRefunded: number;
  netCost: number;
  status: 'pending' | 'charged' | 'completed' | 'refunded' | 'partial_refund';
  platformCount: number;
  platformsSucceeded: number;
  platformsFailed: number;
  renderEngine: string | null;
  pricingSnapshot: Record<string, unknown>;
  creditBreakdown: Record<string, unknown>;
  errorMessage: string | null;
  chargedAt: string | null;
  completedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
}

export interface CreditTransaction {
  id: string;
  type: 'charge' | 'refund' | 'topup' | 'bonus' | 'adjustment' | 'expiry';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

// Use the anon client — RPC functions are SECURITY DEFINER so they run as service role
const db = supabase as any;

// ═══════════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY KEY GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

function generateIdempotencyKey(userId: string, briefId: string, sessionId: string): string {
  return `gen_${userId}_${briefId}_${sessionId}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHARGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Atomically charge credits for a generation session.
 * Must be called BEFORE generation begins.
 *
 * - Locks the user's wallet row (FOR UPDATE)
 * - Validates sufficient balance
 * - Deducts credits
 * - Creates billing event + immutable transaction
 * - Returns billing event ID for lifecycle tracking
 */
export async function chargeGenerationCredits(params: {
  userId: string;
  briefId: string;
  sessionId: string;
  platformCount: number;
  renderEngine: string;
  calculationInput: CreditCalculationInput;
}): Promise<ChargeResult> {
  const { userId, briefId, sessionId, platformCount, renderEngine, calculationInput } = params;

  try {
    // Calculate cost using shared utility
    const { estimatedCredits, breakdown } = calculateGenerationCredits(calculationInput);

    const idempotencyKey = generateIdempotencyKey(userId, briefId, sessionId);

    console.log('[CreditBilling] Charging credits:', {
      userId,
      briefId,
      sessionId,
      credits: estimatedCredits,
      platformCount,
      renderEngine,
      idempotencyKey,
    });

    const { data, error } = await db.rpc('charge_generation_credits', {
      p_user_id: userId,
      p_brief_id: briefId,
      p_session_id: sessionId,
      p_credits: estimatedCredits,
      p_platform_count: platformCount,
      p_render_engine: renderEngine,
      p_pricing_snapshot: { source: 'calculateGenerationCredits', version: '1.0' },
      p_credit_breakdown: breakdown as any,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      console.error('[CreditBilling] RPC error:', error.message);
      await logError({
        errorMessage: error.message,
        errorType: 'database',
        module: 'prostudio',
        componentName: 'generationCreditService',
        callLocation: 'chargeGenerationCredits',
        pipelineStep: 'rpc_call',
        context: { userId, briefId, sessionId },
      });
      return { success: false, error: 'RPC_ERROR', message: error.message };
    }

    const result = data as Record<string, any>;

    if (!result.success) {
      console.warn('[CreditBilling] Charge rejected:', result.error, result.message);
      return {
        success: false,
        error: result.error,
        message: result.message,
        balanceBefore: result.balance,
        creditsCharged: result.required,
      };
    }

    console.log('[CreditBilling] Charge success:', {
      billingEventId: result.billing_event_id,
      creditsCharged: result.credits_charged,
      balanceBefore: result.balance_before,
      balanceAfter: result.balance_after,
    });

    return {
      success: true,
      billingEventId: result.billing_event_id,
      transactionId: result.transaction_id,
      creditsCharged: result.credits_charged,
      balanceBefore: result.balance_before,
      balanceAfter: result.balance_after,
    };
  } catch (err: any) {
    console.error('[CreditBilling] chargeGenerationCredits exception:', err.message);
    await logError({
      errorMessage: err.message,
      errorType: 'database',
      module: 'prostudio',
      componentName: 'generationCreditService',
      callLocation: 'chargeGenerationCredits',
      pipelineStep: 'charge',
      context: { userId, briefId, sessionId },
    });
    return { success: false, error: 'EXCEPTION', message: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REFUND
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Atomically refund credits for a failed generation.
 * Supports full refund (default) and partial refund.
 *
 * - Locks billing event + wallet rows
 * - Prevents double-refund
 * - Returns credits to wallet
 * - Creates immutable refund transaction
 */
export async function refundGenerationCredits(params: {
  billingEventId: string;
  refundAmount?: number;
  reason?: string;
  platformsSucceeded?: number;
  platformsFailed?: number;
}): Promise<RefundResult> {
  const {
    billingEventId,
    refundAmount,
    reason = 'Generation failed',
    platformsSucceeded = 0,
    platformsFailed = 0,
  } = params;

  try {
    console.log('[CreditBilling] Refunding credits:', {
      billingEventId,
      refundAmount: refundAmount ?? 'full',
      reason,
    });

    const { data, error } = await db.rpc('refund_generation_credits', {
      p_billing_event_id: billingEventId,
      p_refund_amount: refundAmount ?? null,
      p_reason: reason,
      p_platforms_succeeded: platformsSucceeded,
      p_platforms_failed: platformsFailed,
    });

    if (error) {
      console.error('[CreditBilling] Refund RPC error:', error.message);
      await logError({
        errorMessage: error.message,
        errorType: 'database',
        module: 'prostudio',
        componentName: 'generationCreditService',
        callLocation: 'refundGenerationCredits',
        pipelineStep: 'rpc_call',
        context: { billingEventId },
      });
      return { success: false, error: 'RPC_ERROR', message: error.message };
    }

    const result = data as Record<string, any>;

    if (!result.success) {
      console.warn('[CreditBilling] Refund rejected:', result.error);
      return { success: false, error: result.error, message: result.message };
    }

    console.log('[CreditBilling] Refund success:', {
      refundAmount: result.refund_amount,
      balanceAfter: result.balance_after,
      newStatus: result.new_status,
    });

    return {
      success: true,
      transactionId: result.transaction_id,
      refundAmount: result.refund_amount,
      balanceBefore: result.balance_before,
      balanceAfter: result.balance_after,
      newStatus: result.new_status,
    };
  } catch (err: any) {
    console.error('[CreditBilling] refundGenerationCredits exception:', err.message);
    await logError({
      errorMessage: err.message,
      errorType: 'database',
      module: 'prostudio',
      componentName: 'generationCreditService',
      callLocation: 'refundGenerationCredits',
      pipelineStep: 'refund',
      context: { billingEventId },
    });
    return { success: false, error: 'EXCEPTION', message: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mark a billing event as completed after successful generation.
 */
export async function completeGenerationBilling(params: {
  billingEventId: string;
  platformsSucceeded: number;
  platformsFailed: number;
}): Promise<CompleteResult> {
  const { billingEventId, platformsSucceeded, platformsFailed } = params;

  try {
    const { data, error } = await db.rpc('complete_generation_billing', {
      p_billing_event_id: billingEventId,
      p_platforms_succeeded: platformsSucceeded,
      p_platforms_failed: platformsFailed,
    });

    if (error) {
      console.error('[CreditBilling] Complete RPC error:', error.message);
      return { success: false, error: 'RPC_ERROR' };
    }

    const result = data as Record<string, any>;
    return {
      success: result.success,
      error: result.error,
      billingEventId: result.billing_event_id,
      netCost: result.net_cost,
    };
  } catch (err: any) {
    console.error('[CreditBilling] completeGenerationBilling exception:', err.message);
    return { success: false, error: 'EXCEPTION' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTIMATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Estimate the cost of a generation without charging.
 * Returns the breakdown, whether the user has sufficient balance,
 * and the projected balance after charge.
 */
export async function estimateGenerationCost(params: {
  userId: string;
  calculationInput: CreditCalculationInput;
}): Promise<CreditEstimate> {
  const { userId, calculationInput } = params;

  const { estimatedCredits, breakdown } = calculateGenerationCredits(calculationInput);
  const wallet = await getWalletBalance(userId);

  return {
    totalCredits: estimatedCredits,
    breakdown,
    hasSufficientBalance: wallet.balance >= estimatedCredits,
    currentBalance: wallet.balance,
    balanceAfterCharge: wallet.balance - estimatedCredits,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the user's current wallet balance.
 * Auto-creates wallet with 0 balance if none exists.
 */
export async function getWalletBalance(userId: string): Promise<WalletBalance> {
  try {
    const { data, error } = await db.rpc('get_wallet_balance', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[CreditBilling] getWalletBalance error:', error.message);
      return { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0, lifetimeRefunded: 0, walletId: '' };
    }

    const result = data as Record<string, any>;
    return {
      balance: Number(result.balance) || 0,
      lifetimeEarned: Number(result.lifetime_earned) || 0,
      lifetimeSpent: Number(result.lifetime_spent) || 0,
      lifetimeRefunded: Number(result.lifetime_refunded) || 0,
      walletId: result.wallet_id || '',
    };
  } catch (err: any) {
    console.error('[CreditBilling] getWalletBalance exception:', err.message);
    return { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0, lifetimeRefunded: 0, walletId: '' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD CREDITS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add credits to a user's wallet (admin/purchase top-up).
 */
export async function addCredits(params: {
  userId: string;
  amount: number;
  type?: 'topup' | 'bonus' | 'adjustment';
  description?: string;
  referenceId?: string;
  referenceType?: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; error?: string; transactionId?: string; balanceAfter?: number }> {
  const {
    userId,
    amount,
    type = 'topup',
    description = 'Credit top-up',
    referenceId,
    referenceType,
    idempotencyKey,
  } = params;

  try {
    const { data, error } = await db.rpc('add_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_description: description,
      p_reference_id: referenceId ?? null,
      p_reference_type: referenceType ?? null,
      p_idempotency_key: idempotencyKey ?? null,
    });

    if (error) {
      console.error('[CreditBilling] addCredits error:', error.message);
      return { success: false, error: error.message };
    }

    const result = data as Record<string, any>;
    return {
      success: result.success,
      error: result.error,
      transactionId: result.transaction_id,
      balanceAfter: result.balance_after,
    };
  } catch (err: any) {
    console.error('[CreditBilling] addCredits exception:', err.message);
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTION HISTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get paginated transaction history for a user.
 */
export async function getTransactionHistory(
  userId: string,
  options?: { limit?: number; offset?: number; type?: string }
): Promise<CreditTransaction[]> {
  try {
    let query = db
      .from('credit_transactions')
      .select('id, type, amount, balance_before, balance_after, description, reference_id, reference_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(options?.offset ?? 0, (options?.offset ?? 0) + (options?.limit ?? 50) - 1);

    if (options?.type) {
      query = query.eq('type', options.type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[CreditBilling] getTransactionHistory error:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      balanceBefore: Number(row.balance_before),
      balanceAfter: Number(row.balance_after),
      description: row.description,
      referenceId: row.reference_id,
      referenceType: row.reference_type,
      createdAt: row.created_at,
    }));
  } catch (err: any) {
    console.error('[CreditBilling] getTransactionHistory exception:', err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING EVENT LOOKUP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get a single billing event by ID.
 */
export async function getBillingEvent(billingEventId: string): Promise<BillingEvent | null> {
  try {
    const { data, error } = await db
      .from('generation_billing_events')
      .select('*')
      .eq('id', billingEventId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      briefId: data.brief_id,
      generationSessionId: data.generation_session_id,
      creditsCharged: Number(data.credits_charged),
      creditsRefunded: Number(data.credits_refunded),
      netCost: Number(data.net_cost),
      status: data.status,
      platformCount: data.platform_count,
      platformsSucceeded: data.platforms_succeeded,
      platformsFailed: data.platforms_failed,
      renderEngine: data.render_engine,
      pricingSnapshot: data.pricing_snapshot || {},
      creditBreakdown: data.credit_breakdown || {},
      errorMessage: data.error_message,
      chargedAt: data.charged_at,
      completedAt: data.completed_at,
      refundedAt: data.refunded_at,
      createdAt: data.created_at,
    };
  } catch (err: any) {
    console.error('[CreditBilling] getBillingEvent exception:', err.message);
    return null;
  }
}

/**
 * Get billing events for a brief.
 */
export async function getBillingEventsForBrief(briefId: string): Promise<BillingEvent[]> {
  try {
    const { data, error } = await db
      .from('generation_billing_events')
      .select('*')
      .eq('brief_id', briefId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      briefId: row.brief_id,
      generationSessionId: row.generation_session_id,
      creditsCharged: Number(row.credits_charged),
      creditsRefunded: Number(row.credits_refunded),
      netCost: Number(row.net_cost),
      status: row.status,
      platformCount: row.platform_count,
      platformsSucceeded: row.platforms_succeeded,
      platformsFailed: row.platforms_failed,
      renderEngine: row.render_engine,
      pricingSnapshot: row.pricing_snapshot || {},
      creditBreakdown: row.credit_breakdown || {},
      errorMessage: row.error_message,
      chargedAt: row.charged_at,
      completedAt: row.completed_at,
      refundedAt: row.refunded_at,
      createdAt: row.created_at,
    }));
  } catch (err: any) {
    console.error('[CreditBilling] getBillingEventsForBrief exception:', err.message);
    return [];
  }
}
