import { useEffect, useState, useCallback } from 'react';
import { getCreditPackages, type CreditPackage } from '@/services/stripeService';

interface UseCreditPackagesReturn {
  packages: CreditPackage[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches active credit packages / subscription plans from the service layer.
 * Sorted by sort_order ASC. Returns empty array on failure.
 */
export function useCreditPackages(enabled: boolean = true): UseCreditPackagesReturn {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pkgs = await getCreditPackages();
      setPackages(pkgs);
    } catch (err: any) {
      setError(err?.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
  }, [enabled, load]);

  return { packages, loading, error, refresh: load };
}
