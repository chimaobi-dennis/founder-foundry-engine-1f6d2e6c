/**
 * Generation Credit Service — Reservation-based billing for AI generation.
 *
 * Architecture:
 * - Stripe-style reserve → capture flow
 * - The irreversible billing moment is when external AI inference begins
 * - Before AI: reservation can be released (free)
 * - After AI: credits remain captured regardless of generation outcome
 * - All balance mutations happen server-side via Supabase RPC (plpgsql)
 * - Functions use SELECT ... FOR UPDATE to prevent race conditions
 * - Immutable ledger: transactions are never modified or deleted
 * - Idempotency keys prevent duplicate charges from tab spam / retries
 *
 * Reservation Flow:
 * 1. reserveGenerationCredits()   — lock credits (available → reserved)
 * 2. captureReservedCredits()     — convert reservation → deduction (at AI call)
 * 3. finalizeGenerationBilling()  — mark completed, release any uncaptured remainder
 * 4. releaseReservedCredits()     — cancel reservation (pre-cost failure only)
 *
 * Legacy API (still available):
 * - chargeGenerationCredits()     — atomic deduction (no reservation)
 * - refundGenerationCredits()     — atomic refund on failure
 * - completeGenerationBilling()   — mark billing event as completed
 * - estimateGenerationCost()      — preview cost (no mutations)
 * - getWalletBalance()            — current balance + reserved
 * - getTransactionHistory()       — paginated ledger
 * - getBillingEvent()             — single event lookup
 * - addCredits()                  — admin/purchase top-up
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
  reservedBalance: number;
  availableBalance: number;
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

export type BillingEventStatus =
  | 'initiated' | 'queued' | 'processing' | 'ai_called'
  | 'completed' | 'failed_pre_cost' | 'failed_post_cost'
  | 'partially_completed' | 'refunded' | 'partial_refund'
  | 'pending' | 'charged';

export interface BillingEvent {
  id: string;
  userId: string;
  briefId: string | null;
  generationSessionId: string | null;
  creditsCharged: number;
  creditsRefunded: number;
  creditsReserved: number;
  creditsCaptured: number;
  creditsReleased: number;
  netCost: number;
  status: BillingEventStatus;
  platformCount: number;
  platformsSucceeded: number;
  platformsFailed: number;
  renderEngine: string | null;
  pricingSnapshot: Record<string, unknown>;
  creditBreakdown: Record<string, unknown>;
  errorMessage: string | null;
  providerCostUsd: number | null;
  aiStartedAt: string | null;
  aiCompletedAt: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  aiTokensUsed: number | null;
  chargedAt: string | null;
  completedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
}

export interface CreditTransaction {
  id: string;
  type: 'charge' | 'refund' | 'topup' | 'bonus' | 'adjustment' | 'expiry' | 'reservation' | 'reservation_release' | 'reservation_capture';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
}

// ─── Reservation-specific result types ───

export interface ReserveResult {
  success: boolean;
  error?: string;
  message?: string;
  billingEventId?: string;
  transactionId?: string;
  creditsReserved?: number;
  balance?: number;
  availableAfter?: number;
  reservationExpiresAt?: string;
}

export interface CaptureResult {
  success: boolean;
  error?: string;
  message?: string;
  transactionId?: string;
  creditsCaptured?: number;
  totalCaptured?: number;
  balanceBefore?: number;
  balanceAfter?: number;
}

export interface ReleaseResult {
  success: boolean;
  error?: string;
  message?: string;
  transactionId?: string;
  creditsReleased?: number;
  newStatus?: string;
  balance?: number;
  availableAfter?: number;
}

export interface FinalizeResult {
  success: boolean;
  error?: string;
  billingEventId?: string;
  finalStatus?: string;
  creditsCaptured?: number;
  creditsReleased?: number;
  providerCostUsd?: number;
  netCost?: number;
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
      return { balance: 0, reservedBalance: 0, availableBalance: 0, lifetimeEarned: 0, lifetimeSpent: 0, lifetimeRefunded: 0, walletId: '' };
    }

    const result = data as Record<string, any>;
    const bal = Number(result.balance) || 0;
    const reserved = Number(result.reserved_balance) || 0;
    return {
      balance: bal,
      reservedBalance: reserved,
      availableBalance: bal - reserved,
      lifetimeEarned: Number(result.lifetime_earned) || 0,
      lifetimeSpent: Number(result.lifetime_spent) || 0,
      lifetimeRefunded: Number(result.lifetime_refunded) || 0,
      walletId: result.wallet_id || '',
    };
  } catch (err: any) {
    console.error('[CreditBilling] getWalletBalance exception:', err.message);
    return { balance: 0, reservedBalance: 0, availableBalance: 0, lifetimeEarned: 0, lifetimeSpent: 0, lifetimeRefunded: 0, walletId: '' };
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
// BILLING EVENT MAPPER
// ═══════════════════════════════════════════════════════════════════════════════

function mapBillingEvent(row: any): BillingEvent {
  return {
    id: row.id,
    userId: row.user_id,
    briefId: row.brief_id,
    generationSessionId: row.generation_session_id,
    creditsCharged: Number(row.credits_charged) || 0,
    creditsRefunded: Number(row.credits_refunded) || 0,
    creditsReserved: Number(row.credits_reserved) || 0,
    creditsCaptured: Number(row.credits_captured) || 0,
    creditsReleased: Number(row.credits_released) || 0,
    netCost: Number(row.net_cost) || 0,
    status: row.status,
    platformCount: row.platform_count,
    platformsSucceeded: row.platforms_succeeded,
    platformsFailed: row.platforms_failed,
    renderEngine: row.render_engine,
    pricingSnapshot: row.pricing_snapshot || {},
    creditBreakdown: row.credit_breakdown || {},
    errorMessage: row.error_message,
    providerCostUsd: row.provider_cost_usd != null ? Number(row.provider_cost_usd) : null,
    aiStartedAt: row.ai_started_at,
    aiCompletedAt: row.ai_completed_at,
    aiProvider: row.ai_provider,
    aiModel: row.ai_model,
    aiTokensUsed: row.ai_tokens_used != null ? Number(row.ai_tokens_used) : null,
    chargedAt: row.charged_at,
    completedAt: row.completed_at,
    refundedAt: row.refunded_at,
    createdAt: row.created_at,
  };
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

    return mapBillingEvent(data);
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

    return data.map(mapBillingEvent);
  } catch (err: any) {
    console.error('[CreditBilling] getBillingEventsForBrief exception:', err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESERVATION FLOW — Stripe-style authorize → capture
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Phase 1: Reserve credits for a generation session.
 * Locks credits in the wallet (available → reserved). No deduction yet.
 * Must be called BEFORE generation begins.
 */
export async function reserveGenerationCredits(params: {
  userId: string;
  briefId: string;
  sessionId: string;
  platformCount: number;
  renderEngine: string;
  calculationInput: CreditCalculationInput;
  reservationTtlMinutes?: number;
}): Promise<ReserveResult> {
  const { userId, briefId, sessionId, platformCount, renderEngine, calculationInput, reservationTtlMinutes = 30 } = params;

  try {
    const { estimatedCredits, breakdown } = calculateGenerationCredits(calculationInput);
    const idempotencyKey = generateIdempotencyKey(userId, briefId, sessionId);

    console.log('[CreditBilling] Reserving credits:', {
      userId, briefId, sessionId,
      credits: estimatedCredits,
      platformCount, renderEngine,
      ttlMinutes: reservationTtlMinutes,
    });

    const { data, error } = await db.rpc('reserve_generation_credits', {
      p_user_id: userId,
      p_brief_id: briefId,
      p_session_id: sessionId,
      p_credits: estimatedCredits,
      p_platform_count: platformCount,
      p_render_engine: renderEngine,
      p_pricing_snapshot: { source: 'calculateGenerationCredits', version: '2.0' },
      p_credit_breakdown: breakdown as any,
      p_idempotency_key: idempotencyKey,
      p_reservation_ttl_minutes: reservationTtlMinutes,
    });

    if (error) {
      console.error('[CreditBilling] Reserve RPC error:', error.message);
      await logError({
        errorMessage: error.message,
        errorType: 'database',
        module: 'prostudio',
        componentName: 'generationCreditService',
        callLocation: 'reserveGenerationCredits',
        pipelineStep: 'rpc_call',
        context: { userId, briefId, sessionId },
      });
      return { success: false, error: 'RPC_ERROR', message: error.message };
    }

    const result = data as Record<string, any>;

    if (!result.success) {
      console.warn('[CreditBilling] Reserve rejected:', result.error, result.message);
      return {
        success: false,
        error: result.error,
        message: result.message,
        balance: result.balance ?? result.available,
        creditsReserved: result.required,
      };
    }

    console.log('[CreditBilling] Reserve success:', {
      billingEventId: result.billing_event_id,
      creditsReserved: result.credits_reserved,
      availableAfter: result.available_after,
    });

    return {
      success: true,
      billingEventId: result.billing_event_id,
      transactionId: result.transaction_id,
      creditsReserved: result.credits_reserved,
      balance: result.balance,
      availableAfter: result.available_after,
      reservationExpiresAt: result.reservation_expires_at,
    };
  } catch (err: any) {
    console.error('[CreditBilling] reserveGenerationCredits exception:', err.message);
    await logError({
      errorMessage: err.message,
      errorType: 'database',
      module: 'prostudio',
      componentName: 'generationCreditService',
      callLocation: 'reserveGenerationCredits',
      pipelineStep: 'reserve',
      context: { userId, briefId, sessionId },
    });
    return { success: false, error: 'EXCEPTION', message: err.message };
  }
}

/**
 * Phase 2: Capture reserved credits — called when AI inference BEGINS.
 * This is the irreversible billing moment. Credits move from reserved → spent.
 * After capture, credits are NOT refunded even if generation fails.
 */
export async function captureReservedCredits(params: {
  billingEventId: string;
  captureAmount?: number;
  aiProvider?: string;
  aiModel?: string;
}): Promise<CaptureResult> {
  const { billingEventId, captureAmount, aiProvider, aiModel } = params;

  try {
    console.log('[CreditBilling] Capturing reservation:', {
      billingEventId,
      captureAmount: captureAmount ?? 'full',
      aiProvider, aiModel,
    });

    const { data, error } = await db.rpc('capture_reserved_credits', {
      p_billing_event_id: billingEventId,
      p_capture_amount: captureAmount ?? null,
      p_ai_provider: aiProvider ?? null,
      p_ai_model: aiModel ?? null,
    });

    if (error) {
      console.error('[CreditBilling] Capture RPC error:', error.message);
      await logError({
        errorMessage: error.message,
        errorType: 'database',
        module: 'prostudio',
        componentName: 'generationCreditService',
        callLocation: 'captureReservedCredits',
        pipelineStep: 'rpc_call',
        context: { billingEventId },
      });
      return { success: false, error: 'RPC_ERROR', message: error.message };
    }

    const result = data as Record<string, any>;

    if (!result.success) {
      console.warn('[CreditBilling] Capture rejected:', result.error);
      return { success: false, error: result.error, message: result.message };
    }

    console.log('[CreditBilling] Capture success:', {
      creditsCaptured: result.credits_captured,
      totalCaptured: result.total_captured,
      balanceAfter: result.balance_after,
    });

    return {
      success: true,
      transactionId: result.transaction_id,
      creditsCaptured: result.credits_captured,
      totalCaptured: result.total_captured,
      balanceBefore: result.balance_before,
      balanceAfter: result.balance_after,
    };
  } catch (err: any) {
    console.error('[CreditBilling] captureReservedCredits exception:', err.message);
    await logError({
      errorMessage: err.message,
      errorType: 'database',
      module: 'prostudio',
      componentName: 'generationCreditService',
      callLocation: 'captureReservedCredits',
      pipelineStep: 'capture',
      context: { billingEventId },
    });
    return { success: false, error: 'EXCEPTION', message: err.message };
  }
}

/**
 * Release reserved credits — cancel reservation BEFORE AI inference.
 * Only valid for pre-cost failures (validation errors, prompt failures, etc).
 * Credits return to available balance.
 */
export async function releaseReservedCredits(params: {
  billingEventId: string;
  reason?: string;
  releaseAmount?: number;
}): Promise<ReleaseResult> {
  const { billingEventId, reason = 'Pre-cost failure', releaseAmount } = params;

  try {
    console.log('[CreditBilling] Releasing reservation:', {
      billingEventId, reason,
      releaseAmount: releaseAmount ?? 'all',
    });

    const { data, error } = await db.rpc('release_reserved_credits', {
      p_billing_event_id: billingEventId,
      p_reason: reason,
      p_release_amount: releaseAmount ?? null,
    });

    if (error) {
      console.error('[CreditBilling] Release RPC error:', error.message);
      await logError({
        errorMessage: error.message,
        errorType: 'database',
        module: 'prostudio',
        componentName: 'generationCreditService',
        callLocation: 'releaseReservedCredits',
        pipelineStep: 'rpc_call',
        context: { billingEventId },
      });
      return { success: false, error: 'RPC_ERROR', message: error.message };
    }

    const result = data as Record<string, any>;

    if (!result.success) {
      console.warn('[CreditBilling] Release rejected:', result.error);
      return { success: false, error: result.error, message: result.message };
    }

    console.log('[CreditBilling] Release success:', {
      creditsReleased: result.credits_released,
      newStatus: result.new_status,
      availableAfter: result.available_after,
    });

    return {
      success: true,
      transactionId: result.transaction_id,
      creditsReleased: result.credits_released,
      newStatus: result.new_status,
      balance: result.balance,
      availableAfter: result.available_after,
    };
  } catch (err: any) {
    console.error('[CreditBilling] releaseReservedCredits exception:', err.message);
    await logError({
      errorMessage: err.message,
      errorType: 'database',
      module: 'prostudio',
      componentName: 'generationCreditService',
      callLocation: 'releaseReservedCredits',
      pipelineStep: 'release',
      context: { billingEventId },
    });
    return { success: false, error: 'EXCEPTION', message: err.message };
  }
}

/**
 * Phase 3: Finalize billing after generation completes.
 * Releases any uncaptured reservation remainder and sets final status.
 * Records provider cost and AI metadata.
 */
export async function finalizeGenerationBilling(params: {
  billingEventId: string;
  platformsSucceeded?: number;
  platformsFailed?: number;
  providerCostUsd?: number;
  aiTokensUsed?: number;
}): Promise<FinalizeResult> {
  const {
    billingEventId,
    platformsSucceeded = 0,
    platformsFailed = 0,
    providerCostUsd,
    aiTokensUsed,
  } = params;

  try {
    console.log('[CreditBilling] Finalizing billing:', {
      billingEventId, platformsSucceeded, platformsFailed,
      providerCostUsd, aiTokensUsed,
    });

    const { data, error } = await db.rpc('finalize_generation_billing', {
      p_billing_event_id: billingEventId,
      p_platforms_succeeded: platformsSucceeded,
      p_platforms_failed: platformsFailed,
      p_provider_cost_usd: providerCostUsd ?? null,
      p_ai_tokens_used: aiTokensUsed ?? null,
    });

    if (error) {
      console.error('[CreditBilling] Finalize RPC error:', error.message);
      return { success: false, error: 'RPC_ERROR' };
    }

    const result = data as Record<string, any>;

    console.log('[CreditBilling] Finalize success:', {
      finalStatus: result.final_status,
      creditsCaptured: result.credits_captured,
      creditsReleased: result.credits_released,
      netCost: result.net_cost,
    });

    return {
      success: result.success,
      error: result.error,
      billingEventId: result.billing_event_id,
      finalStatus: result.final_status,
      creditsCaptured: result.credits_captured,
      creditsReleased: result.credits_released,
      providerCostUsd: result.provider_cost_usd,
      netCost: result.net_cost,
    };
  } catch (err: any) {
    console.error('[CreditBilling] finalizeGenerationBilling exception:', err.message);
    return { success: false, error: 'EXCEPTION' };
  }
}

/**
 * Update billing event status to an intermediate state (queued, processing).
 */
export async function updateBillingStatus(
  billingEventId: string,
  newStatus: 'queued' | 'processing'
): Promise<void> {
  try {
    await db.rpc('update_billing_status', {
      p_billing_event_id: billingEventId,
      p_new_status: newStatus,
    });
  } catch (err: any) {
    console.error('[CreditBilling] updateBillingStatus exception:', err.message);
  }
}
