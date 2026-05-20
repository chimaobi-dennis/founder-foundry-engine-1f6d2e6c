import { AlertTriangle, Coins, X, ExternalLink } from 'lucide-react';

interface InsufficientCreditsModalProps {
  open: boolean;
  onClose: () => void;
  balance: number;
  required: number;
  onBuyCredits?: () => void;
}

/**
 * Modal shown when user tries to generate with insufficient credits.
 * Provides clear messaging and upgrade/buy CTA.
 */
export function InsufficientCreditsModal({
  open,
  onClose,
  balance,
  required,
  onBuyCredits,
}: InsufficientCreditsModalProps) {
  if (!open) return null;

  const deficit = required - balance;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle size={20} className="text-destructive" />
            </div>
            <div>
              <h2 className="font-display text-lg text-foreground">Insufficient Credits</h2>
              <p className="text-[12px] font-ui text-muted-foreground">
                You need more credits to generate this campaign
              </p>
            </div>
          </div>
        </div>

        {/* Balance breakdown */}
        <div className="px-6 pb-4">
          <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-3">
            <div className="flex justify-between text-[13px] font-ui">
              <span className="text-muted-foreground">Your balance</span>
              <span className="font-medium text-foreground">{balance.toLocaleString()} credits</span>
            </div>
            <div className="flex justify-between text-[13px] font-ui">
              <span className="text-muted-foreground">Generation cost</span>
              <span className="font-medium text-foreground">{required.toLocaleString()} credits</span>
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex justify-between text-[13px] font-ui">
                <span className="text-destructive font-medium">Shortfall</span>
                <span className="text-destructive font-display text-lg font-semibold">
                  {deficit.toLocaleString()} credits
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2">
          <button
            onClick={() => {
              onBuyCredits?.();
              onClose();
            }}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-ui text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Coins size={16} />
            Buy Credits
            <ExternalLink size={12} className="opacity-60" />
          </button>
          <button
            onClick={onClose}
            className="w-full h-10 rounded-xl border border-border text-foreground font-ui text-[13px] hover:bg-muted/50 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Hint */}
        <div className="px-6 pb-4">
          <p className="text-[11px] font-ui text-muted-foreground text-center">
            You can reduce costs by selecting fewer platforms or using simpler settings
          </p>
        </div>
      </div>
    </div>
  );
}
