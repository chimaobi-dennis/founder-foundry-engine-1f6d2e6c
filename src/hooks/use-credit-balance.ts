import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { getWalletBalance, type WalletBalance } from '@/services/generationCreditService';

interface UseCreditBalanceReturn {
  balance: number;
  wallet: WalletBalance | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasSufficientCredits: (cost: number) => boolean;
}

/**
 * Hook to track the current user's credit balance.
 * Polls every 30s and exposes a manual refresh for post-generation updates.
 * Balance is INFORMATIONAL ONLY — actual charging is server-side atomic.
 */
export function useCreditBalance(): UseCreditBalanceReturn {
  const { user } = useAuth();
  const { activeBrand } = useBrand();
  // The credit pool belongs to the workspace owner; members spend from it.
  const billingUserId = activeBrand?.user_id ?? user?.id;
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!billingUserId) {
      setWallet(null);
      setLoading(false);
      return;
    }

    try {
      const w = await getWalletBalance(billingUserId);
      setWallet(w);
      setError(null);
    } catch (err: any) {
      console.error('[useCreditBalance] Failed to fetch:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [billingUserId]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchBalance();
  }, [fetchBalance]);

  // Poll every 30 seconds
  useEffect(() => {
    if (!billingUserId) return;
    const interval = setInterval(fetchBalance, 30_000);
    return () => clearInterval(interval);
  }, [billingUserId, fetchBalance]);

  const hasSufficientCredits = useCallback(
    (cost: number) => (wallet?.availableBalance ?? 0) >= cost,
    [wallet?.availableBalance]
  );

  return {
    balance: wallet?.availableBalance ?? 0,
    wallet,
    loading,
    error,
    refresh: fetchBalance,
    hasSufficientCredits,
  };
}
