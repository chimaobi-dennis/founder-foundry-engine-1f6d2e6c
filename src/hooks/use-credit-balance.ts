import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!user?.id) {
      setWallet(null);
      setLoading(false);
      return;
    }

    try {
      const w = await getWalletBalance(user.id);
      setWallet(w);
      setError(null);
    } catch (err: any) {
      console.error('[useCreditBalance] Failed to fetch:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchBalance();
  }, [fetchBalance]);

  // Poll every 30 seconds
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(fetchBalance, 30_000);
    return () => clearInterval(interval);
  }, [user?.id, fetchBalance]);

  const hasSufficientCredits = useCallback(
    (cost: number) => (wallet?.balance ?? 0) >= cost,
    [wallet?.balance]
  );

  return {
    balance: wallet?.balance ?? 0,
    wallet,
    loading,
    error,
    refresh: fetchBalance,
    hasSufficientCredits,
  };
}
