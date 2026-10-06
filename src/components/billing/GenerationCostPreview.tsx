import { Coins, AlertTriangle, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreditBreakdown } from '@/utils/calculateGenerationCredits';

interface GenerationCostPreviewProps {
  credits: number;
  breakdown: CreditBreakdown;
  balance: number;
  balanceLoading?: boolean;
  selectedPlatformCount: number;
  layoutComplexity: string;
  creativeMode: string;
  aiFreedom: number;
  selectedAssets: string[];
  className?: string;
}

/**
 * Shows the estimated generation cost with a live breakdown.
 * Highlights insufficient balance state.
 */
export function GenerationCostPreview({
  credits,
  breakdown,
  balance,
  balanceLoading = false,
  selectedPlatformCount,
  layoutComplexity,
  creativeMode,
  aiFreedom,
  selectedAssets,
  className,
}: GenerationCostPreviewProps) {
  const insufficient = !balanceLoading && balance < credits;
  const balanceAfter = balance - credits;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''));

  return (
    <div
      className={cn(
        'rounded-xl border p-5 transition-colors',
        insufficient
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-primary/30 bg-primary/5',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Coins size={16} className={insufficient ? 'text-destructive' : 'text-primary'} />
        <h3 className="font-ui text-[13px] font-medium text-foreground">Credit Estimate</h3>
        {insufficient && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-ui text-destructive">
            <AlertTriangle size={12} />
            Insufficient
          </span>
        )}
      </div>

      <div className="space-y-2 text-[12px] font-ui">
        {/* Platform base cost */}
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Platforms ({selectedPlatformCount})
          </span>
          <span className="text-foreground">{selectedPlatformCount} credits</span>
        </div>

        {/* Complexity multiplier */}
        {breakdown.complexityMultiplier !== 1 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Complexity ({layoutComplexity})
            </span>
            <span className="text-foreground">×{fmt(breakdown.complexityMultiplier)}</span>
          </div>
        )}

        {/* AI visuals */}
        {selectedAssets.includes('ai_generated') && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">AI visuals</span>
            <span className="text-foreground">×{fmt(breakdown.aiVisualsMultiplier)}</span>
          </div>
        )}

        {/* SVG generation */}
        {selectedAssets.includes('svg_graphics') && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">SVG generation</span>
            <span className="text-foreground">+{fmt(breakdown.svgCost)}</span>
          </div>
        )}

        {/* Experimental mode */}
        {creativeMode === 'experimental' && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Experimental mode</span>
            <span className="text-foreground">×{fmt(breakdown.experimentalMultiplier)}</span>
          </div>
        )}

        {/* High AI freedom */}
        {breakdown.aiFreedomMultiplier !== 1 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">High AI freedom</span>
            <span className="text-foreground">×{fmt(breakdown.aiFreedomMultiplier)}</span>
          </div>
        )}

        {/* Divider + Total */}
        <div className="border-t border-primary/20 pt-2 mt-2">
          <div className="flex justify-between">
            <span className="font-medium text-foreground">Total</span>
            <span
              className={cn(
                'font-display text-xl',
                insufficient ? 'text-destructive' : 'text-primary'
              )}
            >
              {credits} credits
            </span>
          </div>
        </div>

        {/* Balance after charge */}
        {!balanceLoading && (
          <div className="flex justify-between pt-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingDown size={10} />
              After generation
            </span>
            <span
              className={cn(
                'font-medium',
                balanceAfter < 0 ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {balanceAfter < 0 ? '−' : ''}{Math.abs(balanceAfter)} credits
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
