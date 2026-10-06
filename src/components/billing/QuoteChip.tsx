import { Coins, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface QuoteChipProps {
  /** Credits we expect to charge */
  estimate: number;
  /** Upper bound for metered actions; equals estimate when fixed */
  max?: number;
  mode?: 'fixed' | 'metered';
  balance: number;
  balanceLoading?: boolean;
  /** Retail value in USD, shown when provided */
  retailUsd?: number;
  /** Lines for the hover breakdown */
  breakdown?: { label: string; value: string }[];
  /** Called when the founder clicks the chip in the "top up" state */
  onTopUp?: () => void;
  className?: string;
}

/**
 * Compact, live cost quote. Sits next to the action button.
 *   fixed:    "12 credits · 988 after"
 *   metered:  "~35 credits, up to 60 · 940 after"
 *   short:    "Top up to run · need 22 more"
 */
export function QuoteChip({
  estimate,
  max,
  mode = 'fixed',
  balance,
  balanceLoading = false,
  retailUsd,
  breakdown,
  onTopUp,
  className,
}: QuoteChipProps) {
  const ceiling = mode === 'metered' && max != null ? max : estimate;
  const shortfall = balanceLoading ? 0 : Math.max(0, ceiling - balance);
  const insufficient = shortfall > 0;
  const balanceAfter = balance - estimate;

  const label = insufficient
    ? `Top up to run · need ${shortfall} more`
    : mode === 'metered' && max != null && max !== estimate
      ? `~${estimate} credits, up to ${max}`
      : `${estimate} credit${estimate === 1 ? '' : 's'}`;

  const chip = (
    <button
      type="button"
      onClick={insufficient ? onTopUp : undefined}
      aria-label={insufficient ? `Insufficient credits. ${label}` : `Estimated cost ${label}`}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-ui transition-colors',
        insufficient
          ? 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 cursor-pointer'
          : 'border-primary/30 bg-primary/5 text-foreground cursor-default',
        className
      )}
    >
      <Coins size={13} className={insufficient ? 'text-destructive' : 'text-primary'} />
      <span className="font-medium tabular-nums">{label}</span>
      {!insufficient && !balanceLoading && (
        <span className="text-muted-foreground tabular-nums">· {balanceAfter} after</span>
      )}
      {retailUsd != null && !insufficient && (
        <span className="text-muted-foreground tabular-nums">· ${retailUsd.toFixed(2)}</span>
      )}
      {breakdown && breakdown.length > 0 && <Info size={12} className="text-muted-foreground" />}
    </button>
  );

  if (!breakdown || breakdown.length === 0) return chip;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px]">
          <div className="space-y-1 text-[12px] font-ui">
            {breakdown.map((line, i) => (
              <div key={i} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{line.label}</span>
                <span className="tabular-nums">{line.value}</span>
              </div>
            ))}
            {mode === 'metered' && (
              <p className="pt-1 text-muted-foreground">
                Metered: the upper bound is reserved, you pay what the run uses, the rest is returned.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default QuoteChip;
