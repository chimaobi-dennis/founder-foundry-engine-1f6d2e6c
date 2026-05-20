import { useState, useEffect } from 'react';
import { X, Coins, Sparkles, Loader2, CreditCard, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCreditPackages, redirectToCheckout } from '@/services/stripeService';
import type { CreditPackage } from '@/services/stripeService';

interface CreditPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  currentBalance?: number;
}

/**
 * Modal for selecting a credit package and redirecting to Stripe Checkout.
 * Packages are fetched from the DB — amounts are NEVER trusted from frontend.
 */
export function CreditPurchaseModal({
  open,
  onClose,
  currentBalance,
}: CreditPurchaseModalProps) {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setError(null);
      getCreditPackages()
        .then(setPackages)
        .catch(() => setError('Failed to load packages'))
        .finally(() => setLoading(false));
    }
  }, [open]);

  if (!open) return null;

  const handlePurchase = async (pkg: CreditPackage) => {
    setPurchasing(pkg.id);
    setError(null);
    try {
      await redirectToCheckout(pkg.id);
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout');
      setPurchasing(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Coins size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg text-foreground">Buy Credits</h2>
              <p className="text-[12px] font-ui text-muted-foreground">
                Power your AI-generated campaigns
              </p>
            </div>
          </div>

          {currentBalance !== undefined && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border text-[12px] font-ui">
              <Coins size={12} className="text-muted-foreground" />
              <span className="text-muted-foreground">Current balance:</span>
              <span className="font-semibold text-foreground">{currentBalance.toLocaleString()} credits</span>
            </div>
          )}
        </div>

        {/* Packages */}
        <div className="px-6 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : error && packages.length === 0 ? (
            <div className="text-center py-8 text-destructive text-[13px] font-ui">
              {error}
            </div>
          ) : (
            <div className="grid gap-2">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing !== null}
                  className={cn(
                    'relative w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all text-left group',
                    'hover:border-primary/40 hover:bg-primary/5',
                    purchasing === pkg.id
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border bg-card',
                    purchasing !== null && purchasing !== pkg.id && 'opacity-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Sparkles size={16} className="text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-[14px] text-foreground">{pkg.name}</span>
                        {pkg.badge && (
                          <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-ui font-semibold uppercase tracking-wider">
                            {pkg.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[12px] font-ui text-muted-foreground mt-0.5">
                        <Coins size={10} />
                        {pkg.credits.toLocaleString()} credits
                        {pkg.description && (
                          <span className="ml-1 hidden sm:inline">— {pkg.description}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-semibold text-foreground">
                      ${pkg.priceUsd.toFixed(2)}
                    </span>
                    {purchasing === pkg.id ? (
                      <Loader2 size={16} className="animate-spin text-primary" />
                    ) : (
                      <CreditCard size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error message */}
        {error && packages.length > 0 && (
          <div className="px-6 pb-3">
            <p className="text-[12px] font-ui text-destructive text-center">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 pb-5">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-ui text-muted-foreground">
            <Check size={10} className="text-emerald-500" />
            Secure payment via Stripe
          </div>
        </div>
      </div>
    </div>
  );
}
