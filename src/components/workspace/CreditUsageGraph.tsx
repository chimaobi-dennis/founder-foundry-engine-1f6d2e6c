import type { CreditTransaction } from '@/services/generationCreditService';

interface CreditUsageGraphProps {
  transactions: CreditTransaction[];
  className?: string;
}

/**
 * Mini sparkline visualizing recent credit usage over the last 7 days.
 * Pure CSS — no chart library dependency.
 */
export function CreditUsageGraph({ transactions, className = '' }: CreditUsageGraphProps) {
  // Bucket charges into last 7 days
  const now = Date.now();
  const DAY = 86_400_000;
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const dayStart = now - (6 - i) * DAY;
    const dayEnd = dayStart + DAY;
    return transactions
      .filter((t) => {
        const ts = new Date(t.createdAt).getTime();
        return ts >= dayStart && ts < dayEnd && (t.type === 'charge' || t.type === 'reservation_capture');
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  });

  const max = Math.max(...buckets, 1);
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const todayIndex = new Date().getDay();
  const orderedLabels = Array.from({ length: 7 }, (_, i) => {
    const idx = (todayIndex - 6 + i + 7) % 7;
    return dayLabels[idx === 0 ? 6 : idx - 1];
  });

  const total = buckets.reduce((s, v) => s + v, 0);

  return (
    <div className={`px-4 py-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-ui uppercase tracking-[0.1em] text-muted-foreground">
          7-Day Usage
        </p>
        <p className="text-[11px] font-ui font-medium text-foreground">
          {total.toLocaleString()} credits
        </p>
      </div>
      <div className="flex items-end gap-[3px] h-[32px]">
        {buckets.map((val, i) => {
          const height = max > 0 ? Math.max(2, (val / max) * 100) : 2;
          const isToday = i === 6;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-sm transition-all duration-300"
                style={{
                  height: `${height}%`,
                  minHeight: '2px',
                  background: isToday
                    ? 'hsl(var(--primary))'
                    : val > 0
                      ? 'hsl(var(--primary) / 0.35)'
                      : 'hsl(var(--muted) / 0.3)',
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-[3px] mt-0.5">
        {orderedLabels.map((label, i) => (
          <p key={i} className="flex-1 text-center text-[8px] font-ui text-muted-foreground/50">
            {label}
          </p>
        ))}
      </div>
    </div>
  );
}
