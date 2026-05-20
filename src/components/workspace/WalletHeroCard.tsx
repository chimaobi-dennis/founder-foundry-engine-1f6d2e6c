import { Coins, Lock, CreditCard, TrendingDown, Loader2 } from 'lucide-react';
import type { WalletBalance } from '@/services/generationCreditService';

interface WalletHeroCardProps {
  wallet: WalletBalance | null;
  loading?: boolean;
  estimatedCost?: number;
  onBuyCredits: () => void;
  onViewBilling: () => void;
}

/**
 * Wallet-first hero card — emotional anchor of the Workspace Control Center.
 * Balance is INFORMATIONAL ONLY — never trusted for charging.
 */
export function WalletHeroCard({
  wallet,
  loading = false,
  estimatedCost = 30,
  onBuyCredits,
  onViewBilling,
}: WalletHeroCardProps) {
  const available = wallet?.availableBalance ?? 0;
  const reserved = wallet?.reservedBalance ?? 0;
  const generationsRemaining = estimatedCost > 0 ? Math.floor(available / estimatedCost) : 0;
  const isLow = available > 0 && generationsRemaining <= 3;
  const isEmpty = available === 0 && !loading;

  return (
    <div className="mx-3 rounded-xl overflow-hidden">
      {/* Gradient background */}
      <div
        className="p-4 relative"
        style={{
          background: isEmpty
            ? 'linear-gradient(135deg, hsl(0 30% 15%), hsl(0 20% 10%))'
            : isLow
              ? 'linear-gradient(135deg, hsl(35 60% 14%), hsl(30 40% 8%))'
              : 'linear-gradient(135deg, hsl(45 70% 14%), hsl(40 50% 8%))',
          border: '0.5px solid hsl(var(--border) / 0.5)',
          borderRadius: '12px',
        }}
      >
        {/* Balance */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] font-ui uppercase tracking-[0.1em] text-muted-foreground/80 mb-1">
              Available Credits
            </p>
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
                <span className="text-[12px] font-ui text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <p className="text-[28px] font-display font-bold text-foreground leading-none tracking-tight">
                {available.toLocaleString()}
              </p>
            )}
          </div>
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Coins size={16} className="text-primary" />
          </div>
        </div>

        {/* Stats row */}
        {!loading && (
          <div className="flex items-center gap-4 mb-3.5">
            {reserved > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] font-ui">
                <Lock size={10} className="text-blue-400" />
                <span className="text-muted-foreground">{reserved} reserved</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[11px] font-ui">
              <TrendingDown size={10} className={isLow ? 'text-amber-400' : 'text-muted-foreground/60'} />
              <span className={isLow ? 'text-amber-400' : 'text-muted-foreground'}>
                ~{generationsRemaining} generations
              </span>
            </div>
          </div>
        )}

        {/* Low credit warning */}
        {!loading && isLow && (
          <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-ui text-amber-400">
            Running low on credits — buy more to keep creating.
          </div>
        )}
        {!loading && isEmpty && (
          <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] font-ui text-red-400">
            No credits remaining. Purchase credits to generate content.
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onBuyCredits}
            className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors"
          >
            <CreditCard size={12} />
            Buy Credits
          </button>
          <button
            onClick={onViewBilling}
            className="h-8 px-3 rounded-lg border border-border/50 text-[12px] font-ui text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            Billing
          </button>
        </div>
      </div>
    </div>
  );
}
