import { CheckCircle2, XCircle, Loader2, Coins, RefreshCw, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';

type BillingStatus =
  | 'charging' | 'charged' | 'failed' | 'refunded'
  | 'reserving' | 'reserved' | 'capturing' | 'captured' | 'released'
  | null;

interface BillingStatusToastProps {
  status: BillingStatus;
  creditsCharged?: number;
  creditsRefunded?: number;
  creditsReserved?: number;
  balanceAfter?: number;
  errorMessage?: string;
  className?: string;
}

/**
 * Inline toast/banner showing billing lifecycle during generation.
 * Supports both legacy (charge/refund) and reservation (reserve/capture/release) flows.
 */
export function BillingStatusToast({
  status,
  creditsCharged,
  creditsRefunded,
  creditsReserved,
  balanceAfter,
  errorMessage,
  className,
}: BillingStatusToastProps) {
  if (!status) return null;

  const configs: Record<NonNullable<BillingStatus>, { icon: React.ReactNode; bg: string; text: string; message: string }> = {
    reserving: {
      icon: <Loader2 size={14} className="animate-spin text-primary" />,
      bg: 'bg-primary/5 border-primary/20',
      text: 'text-primary',
      message: 'Reserving credits...',
    },
    reserved: {
      icon: <Lock size={14} className="text-blue-500" />,
      bg: 'bg-blue-500/5 border-blue-500/20',
      text: 'text-blue-600 dark:text-blue-400',
      message: `${creditsReserved ?? 0} credits reserved`,
    },
    capturing: {
      icon: <Loader2 size={14} className="animate-spin text-amber-500" />,
      bg: 'bg-amber-500/5 border-amber-500/20',
      text: 'text-amber-600 dark:text-amber-400',
      message: 'Capturing credits — AI generation starting...',
    },
    captured: {
      icon: <CheckCircle2 size={14} className="text-emerald-500" />,
      bg: 'bg-emerald-500/5 border-emerald-500/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      message: `${creditsCharged ?? creditsReserved ?? 0} credits captured`,
    },
    released: {
      icon: <Unlock size={14} className="text-blue-400" />,
      bg: 'bg-blue-400/5 border-blue-400/20',
      text: 'text-blue-500 dark:text-blue-300',
      message: `${creditsReserved ?? 0} credits released`,
    },
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
      {balanceAfter !== undefined && (status === 'charged' || status === 'captured' || status === 'reserved') && (
        <span className="ml-auto flex items-center gap-1 text-muted-foreground">
          <Coins size={10} />
          {balanceAfter.toLocaleString()} remaining
        </span>
      )}
    </div>
  );
}

export type { BillingStatus };
