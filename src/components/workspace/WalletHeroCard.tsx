import { Coins, Lock, CreditCard, TrendingDown, Sparkles } from 'lucide-react';
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

  // Calm, operational gradient — not alarming
  const gradient = isEmpty
    ? 'linear-gradient(145deg, hsl(20 15% 12%), hsl(20 10% 8%))'
    : isLow
      ? 'linear-gradient(145deg, hsl(38 35% 13%), hsl(35 25% 8%))'
      : 'linear-gradient(145deg, hsl(43 40% 12%), hsl(40 30% 7%))';

  return (
    <div className="mx-3 rounded-xl overflow-hidden">
      <div
        className="p-4 relative"
        style={{
          background: gradient,
          border: '0.5px solid hsl(var(--border) / 0.4)',
          borderRadius: '12px',
        }}
      >
        {/* Subtle decorative glow */}
        <div
          className="absolute top-0 right-0 w-24 h-24 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 70%)',
          }}
        />

        {/* Balance header */}
        <div className="flex items-start justify-between mb-3 relative">
          <div>
            <p className="text-[10px] font-ui uppercase tracking-[0.12em] text-muted-foreground/70 mb-1.5">
              Available Credits
            </p>
            {loading ? (
              <div className="space-y-1.5">
                <div className="h-7 w-24 rounded-md bg-muted/20 animate-pulse" />
                <div className="h-3 w-16 rounded bg-muted/15 animate-pulse" />
              </div>
            ) : (
              <p className="text-[30px] font-display font-bold text-foreground leading-none tracking-tight">
                {available.toLocaleString()}
              </p>
            )}
          </div>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'hsl(var(--primary) / 0.12)' }}>
            <Coins size={16} className="text-primary" />
          </div>
        </div>

        {/* Stats row */}
        {!loading && (
          <div className="flex items-center gap-3 mb-3">
            {reserved > 0 && (
              <div className="flex items-center gap-1 text-[11px] font-ui">
                <Lock size={9} className="text-blue-400/80" />
                <span className="text-muted-foreground">{reserved} reserved</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-[11px] font-ui">
              <TrendingDown size={9} className={isLow ? 'text-amber-400/80' : 'text-muted-foreground/50'} />
              <span className={isLow ? 'text-amber-300' : 'text-muted-foreground'}>
                ~{generationsRemaining} generation{generationsRemaining !== 1 ? 's' : ''} remaining
              </span>
            </div>
          </div>
        )}

        {/* Calm operational warnings */}
        {!loading && isLow && (
          <div className="mb-3 px-2.5 py-1.5 rounded-lg text-[11px] font-ui"
               style={{ background: 'hsl(38 50% 50% / 0.08)', border: '0.5px solid hsl(38 50% 50% / 0.15)', color: 'hsl(38 60% 65%)' }}>
            <Sparkles size={10} className="inline mr-1 -mt-0.5" />
            Credits running low — top up to keep creating.
          </div>
        )}
        {!loading && isEmpty && (
          <div className="mb-3 px-2.5 py-1.5 rounded-lg text-[11px] font-ui"
               style={{ background: 'hsl(20 30% 50% / 0.08)', border: '0.5px solid hsl(20 30% 50% / 0.15)', color: 'hsl(20 40% 65%)' }}>
            <Sparkles size={10} className="inline mr-1 -mt-0.5" />
            Purchase credits to start generating content.
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onBuyCredits}
            className="flex-1 h-[34px] rounded-lg bg-primary text-primary-foreground text-[12px] font-ui font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-all duration-200 active:scale-[0.98]"
          >
            <CreditCard size={12} />
            Buy Credits
          </button>
          <button
            onClick={onViewBilling}
            className="h-[34px] px-3.5 rounded-lg text-[12px] font-ui text-muted-foreground hover:text-foreground transition-all duration-200"
            style={{ background: 'hsl(var(--muted) / 0.15)', border: '0.5px solid hsl(var(--border) / 0.3)' }}
          >
            Billing
          </button>
        </div>
      </div>
    </div>
  );
}
