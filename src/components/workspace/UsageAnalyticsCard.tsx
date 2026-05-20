import { Activity, Zap, ArrowUpRight } from 'lucide-react';
import type { WalletBalance } from '@/services/generationCreditService';

interface UsageAnalyticsCardProps {
  wallet: WalletBalance | null;
  recentGenerations?: number;
  estimatedCost?: number;
  className?: string;
}

/**
 * Compact usage analytics card — lifetime stats + recent generation count.
 * Balance is INFORMATIONAL ONLY.
 */
export function UsageAnalyticsCard({
  wallet,
  recentGenerations = 0,
  estimatedCost = 30,
  className = '',
}: UsageAnalyticsCardProps) {
  const spent = wallet?.lifetimeSpent ?? 0;
  const earned = wallet?.lifetimeEarned ?? 0;
  const refunded = wallet?.lifetimeRefunded ?? 0;

  const stats = [
    { label: 'Lifetime Earned', value: earned.toLocaleString(), icon: ArrowUpRight, color: 'text-emerald-400' },
    { label: 'Total Spent', value: spent.toLocaleString(), icon: Zap, color: 'text-primary' },
    { label: 'Generations', value: recentGenerations > 0 ? recentGenerations.toLocaleString() : '—', icon: Activity, color: 'text-blue-400' },
  ];

  return (
    <div className={`mx-3 ${className}`}>
      <div className="grid grid-cols-3 gap-1">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center py-2.5 px-1 rounded-lg"
            style={{ background: 'hsl(var(--muted) / 0.15)', border: '0.5px solid hsl(var(--border) / 0.3)' }}
          >
            <s.icon size={12} className={`${s.color} mb-1`} />
            <p className="text-[13px] font-display font-semibold text-foreground leading-none">
              {s.value}
            </p>
            <p className="text-[8px] font-ui uppercase tracking-[0.08em] text-muted-foreground mt-0.5">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
