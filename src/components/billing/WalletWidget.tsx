import { Coins, CreditCard, Lock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WalletBalance } from '@/services/generationCreditService';

interface WalletWidgetProps {
  wallet: WalletBalance | null;
  loading?: boolean;
  onBuyCredits?: () => void;
  className?: string;
}

/**
 * Full wallet widget showing available balance, reserved, and a buy CTA.
 * Balance is INFORMATIONAL ONLY — never trust frontend balance for charging.
 */
export function WalletWidget({
  wallet,
  loading = false,
  onBuyCredits,
  className,
}: WalletWidgetProps) {
  const available = wallet?.availableBalance ?? 0;
  const reserved = wallet?.reservedBalance ?? 0;

  return (
    <div className={cn('rounded-xl border border-border bg-card p-5', className)}>
      {/* Balance */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Coins size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider">
              Available Credits
            </p>
            {loading ? (
              <div className="h-7 w-20 rounded bg-muted animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-display font-bold text-foreground leading-tight">
                {available.toLocaleString()}
              </p>
            )}
          </div>
        </div>
        {onBuyCredits && (
          <button
            onClick={onBuyCredits}
            className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground font-ui text-[12px] font-semibold flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
          >
            <CreditCard size={12} />
            Buy
          </button>
        )}
      </div>

      {/* Reserved indicator */}
      {!loading && reserved > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/15 text-[12px] font-ui">
          <Lock size={12} className="text-blue-500" />
          <span className="text-blue-600 dark:text-blue-400">
            {reserved.toLocaleString()} reserved in active generations
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-[12px] font-ui text-muted-foreground">
          <Loader2 size={12} className="animate-spin" />
          Loading wallet...
        </div>
      )}
    </div>
  );
}
