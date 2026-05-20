import { Zap, ArrowUpRight, ArrowDownRight, Gift, RefreshCw, Lock, Unlock, CreditCard } from 'lucide-react';
import type { CreditTransaction } from '@/services/generationCreditService';

interface TransactionTimelineProps {
  transactions: CreditTransaction[];
  limit?: number;
  className?: string;
}

const TYPE_CONFIG: Record<string, { icon: typeof Zap; color: string; label: string }> = {
  charge:              { icon: Zap,            color: 'text-red-400',    label: 'Generation' },
  refund:              { icon: RefreshCw,      color: 'text-emerald-400', label: 'Refund' },
  topup:               { icon: CreditCard,     color: 'text-emerald-400', label: 'Purchase' },
  bonus:               { icon: Gift,           color: 'text-primary',     label: 'Bonus' },
  adjustment:          { icon: ArrowUpRight,   color: 'text-blue-400',    label: 'Adjustment' },
  expiry:              { icon: ArrowDownRight, color: 'text-muted-foreground', label: 'Expired' },
  reservation:         { icon: Lock,           color: 'text-blue-400',    label: 'Reserved' },
  reservation_release: { icon: Unlock,         color: 'text-emerald-400', label: 'Released' },
  reservation_capture: { icon: Zap,            color: 'text-amber-400',   label: 'Captured' },
};

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

/**
 * Compact transaction timeline for the control center and billing hub.
 */
export function TransactionTimeline({
  transactions,
  limit = 5,
  className = '',
}: TransactionTimelineProps) {
  const visible = transactions.slice(0, limit);

  if (visible.length === 0) {
    return (
      <div className={`px-4 py-6 text-center ${className}`}>
        <Zap size={16} className="text-muted-foreground/30 mx-auto mb-1.5" />
        <p className="text-[11px] font-ui text-muted-foreground">No recent activity</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {visible.map((tx, i) => {
        const config = TYPE_CONFIG[tx.type] || TYPE_CONFIG.charge;
        const isPositive = tx.amount > 0;
        const Icon = config.icon;

        return (
          <div
            key={tx.id}
            className="flex items-center gap-2.5 px-4 py-2 hover:bg-muted/20 transition-colors"
          >
            <div className="relative">
              <div className="w-6 h-6 rounded-md flex items-center justify-center bg-muted/20">
                <Icon size={11} className={config.color} />
              </div>
              {i < visible.length - 1 && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-px h-2 bg-border/50" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-ui text-foreground leading-tight">
                {tx.description || config.label}
              </p>
              <p className="text-[10px] font-ui text-muted-foreground/70">{timeAgo(tx.createdAt)}</p>
            </div>
            <p className={`text-[12px] font-ui font-medium tabular-nums ${isPositive ? 'text-emerald-400' : 'text-foreground'}`}>
              {isPositive ? '+' : ''}{tx.amount.toLocaleString()}
            </p>
          </div>
        );
      })}
    </div>
  );
}
