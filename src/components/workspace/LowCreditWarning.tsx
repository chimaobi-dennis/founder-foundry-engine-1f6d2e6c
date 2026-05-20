import { AlertTriangle, CreditCard } from 'lucide-react';

interface LowCreditWarningProps {
  available: number;
  estimatedCost?: number;
  onBuyCredits: () => void;
}

/**
 * Contextual low-credit warning bar for display in TopBar or sidebar.
 * Shows intelligent messages based on credit level relative to generation cost.
 */
export function LowCreditWarning({
  available,
  estimatedCost = 30,
  onBuyCredits,
}: LowCreditWarningProps) {
  const remaining = estimatedCost > 0 ? Math.floor(available / estimatedCost) : 0;

  if (available <= 0) {
    return (
      <button
        onClick={onBuyCredits}
        className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[11px] font-ui transition-colors bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15"
      >
        <AlertTriangle size={12} />
        <span className="flex-1 text-left">No credits — unable to generate</span>
        <CreditCard size={11} />
      </button>
    );
  }

  if (remaining <= 3) {
    return (
      <button
        onClick={onBuyCredits}
        className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[11px] font-ui transition-colors bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/15"
      >
        <AlertTriangle size={12} />
        <span className="flex-1 text-left">Running low — ~{remaining} generation{remaining !== 1 ? 's' : ''} left</span>
        <CreditCard size={11} />
      </button>
    );
  }

  return null;
}
