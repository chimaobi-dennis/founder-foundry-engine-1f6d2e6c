import { Coins, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreditBalanceBadgeProps {
  balance: number;
  loading?: boolean;
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
}

/**
 * Displays the user's current credit balance.
 * Informational only — never trust frontend balance for charging.
 */
export function CreditBalanceBadge({
  balance,
  loading = false,
  variant = 'default',
  className,
}: CreditBalanceBadgeProps) {
  if (variant === 'inline') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-[12px] font-ui', className)}>
        <Coins size={12} className="text-amber-500" />
        {loading ? (
          <Loader2 size={10} className="animate-spin text-muted-foreground" />
        ) : (
          <span className="font-medium text-foreground">{balance.toLocaleString()}</span>
        )}
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/5',
          className
        )}
      >
        <Coins size={12} className="text-amber-500" />
        {loading ? (
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
        ) : (
          <span className="text-[12px] font-ui font-medium text-foreground">
            {balance.toLocaleString()}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Coins size={16} className="text-amber-500" />
        </div>
        <div>
          <p className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider">
            Your Balance
          </p>
          {loading ? (
            <div className="h-5 w-16 rounded bg-muted animate-pulse mt-0.5" />
          ) : (
            <p className="text-[18px] font-display font-semibold text-foreground leading-tight">
              {balance.toLocaleString()}
            </p>
          )}
        </div>
      </div>
      <span className="text-[11px] font-ui text-muted-foreground">credits</span>
    </div>
  );
}
