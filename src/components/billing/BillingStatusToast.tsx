import { CheckCircle2, XCircle, Loader2, Coins, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type BillingStatus = 'charging' | 'charged' | 'failed' | 'refunded' | null;

interface BillingStatusToastProps {
  status: BillingStatus;
  creditsCharged?: number;
  creditsRefunded?: number;
  balanceAfter?: number;
  errorMessage?: string;
  className?: string;
}

/**
 * Inline toast/banner showing billing lifecycle during generation.
 * Renders contextually below the generate button or in a status area.
 */
export function BillingStatusToast({
  status,
  creditsCharged,
  creditsRefunded,
  balanceAfter,
  errorMessage,
  className,
}: BillingStatusToastProps) {
  if (!status) return null;

  const configs = {
    charging: {
      icon: <Loader2 size={14} className="animate-spin text-primary" />,
      bg: 'bg-primary/5 border-primary/20',
      text: 'text-primary',
      message: 'Charging credits...',
    },
    charged: {
      icon: <CheckCircle2 size={14} className="text-emerald-500" />,
      bg: 'bg-emerald-500/5 border-emerald-500/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      message: `${creditsCharged ?? 0} credits charged`,
    },
    failed: {
      icon: <XCircle size={14} className="text-destructive" />,
      bg: 'bg-destructive/5 border-destructive/20',
      text: 'text-destructive',
      message: errorMessage || 'Credit charge failed',
    },
    refunded: {
      icon: <RefreshCw size={14} className="text-amber-500" />,
      bg: 'bg-amber-500/5 border-amber-500/20',
      text: 'text-amber-600 dark:text-amber-400',
      message: `${creditsRefunded ?? 0} credits refunded`,
    },
  };

  const config = configs[status];

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-ui transition-all animate-in fade-in slide-in-from-top-1 duration-200',
        config.bg,
        className
      )}
    >
      {config.icon}
      <span className={config.text}>{config.message}</span>
      {balanceAfter !== undefined && status === 'charged' && (
        <span className="ml-auto flex items-center gap-1 text-muted-foreground">
          <Coins size={10} />
          {balanceAfter.toLocaleString()} remaining
        </span>
      )}
    </div>
  );
}

export type { BillingStatus };
