import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Coins, Lock, Loader2, ChevronRight, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCreditBalance } from '@/hooks/use-credit-balance';
import { getTransactionHistory, type CreditTransaction } from '@/services/generationCreditService';
import { getPurchaseHistory, type CreditPurchase } from '@/services/stripeService';
import { usePricingModal } from '@/contexts/PricingModalContext';
import { TransactionTimeline } from './TransactionTimeline';
import { CreditUsageGraph } from './CreditUsageGraph';
import { useNavigate } from 'react-router-dom';

interface BillingHubDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Right-side slideover billing panel.
 * Shows wallet balance, usage graph, recent transactions, recent purchases.
 * Balance is INFORMATIONAL ONLY.
 */
export function BillingHubDrawer({ open, onClose }: BillingHubDrawerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance, wallet, loading: walletLoading, refresh: refreshBalance } = useCreditBalance();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [purchases, setPurchases] = useState<CreditPurchase[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const { openPricingModal } = usePricingModal();
  const [activeTab, setActiveTab] = useState<'activity' | 'purchases'>('activity');

  useEffect(() => {
    if (!open || !user?.id) return;
    setLoadingTx(true);
    setLoadingPurchases(true);

    getTransactionHistory(user.id, { limit: 30 })
      .then(setTransactions)
      .catch(() => {})
      .finally(() => setLoadingTx(false));

    getPurchaseHistory({ limit: 10 })
      .then(setPurchases)
      .catch(() => {})
      .finally(() => setLoadingPurchases(false));
  }, [open, user?.id]);

  // Lock scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleBuyCredits = () => {
    openPricingModal({
      currentBalance: balance,
      onAfterClose: () => {
        refreshBalance();
        if (user?.id) {
          getTransactionHistory(user.id, { limit: 30 }).then(setTransactions);
          getPurchaseHistory({ limit: 10 }).then(setPurchases);
        }
      },
    });
  };

  if (!open) return null;

  const available = wallet?.availableBalance ?? 0;
  const reserved = wallet?.reservedBalance ?? 0;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[90] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 w-full max-w-[400px] bg-card border-l border-border shadow-2xl z-[91] flex flex-col"
        style={{ animation: 'slideInRight 250ms ease-out' }}
      >
        <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Coins size={14} className="text-primary" />
            </div>
            <div>
              <p className="font-display text-[15px] text-foreground font-medium">Billing Hub</p>
              <p className="text-[10px] font-ui text-muted-foreground">Credits & usage overview</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {/* Wallet summary */}
          <div className="px-5 py-4 border-b border-border">
            {walletLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-[10px] font-ui uppercase tracking-[0.1em] text-muted-foreground mb-1">
                  Available Balance
                </p>
                <p className="text-[32px] font-display font-bold text-foreground leading-none tracking-tight mb-2">
                  {available.toLocaleString()}
                </p>
                <div className="flex items-center gap-4">
                  {reserved > 0 && (
                    <div className="flex items-center gap-1 text-[11px] font-ui text-muted-foreground">
                      <Lock size={10} className="text-blue-400" />
                      {reserved} reserved
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[11px] font-ui text-muted-foreground">
                    <Coins size={10} className="text-primary/50" />
                    {(wallet?.balance ?? 0).toLocaleString()} total
                  </div>
                </div>
                <button
                  onClick={handleBuyCredits}
                  className="mt-3 w-full h-9 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors"
                >
                  <CreditCard size={13} />
                  Buy Credits
                </button>
              </>
            )}
          </div>

          {/* Usage graph */}
          {!loadingTx && transactions.length > 0 && (
            <div className="border-b border-border">
              <CreditUsageGraph transactions={transactions} />
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex px-5 pt-3 gap-1">
            {(['activity', 'purchases'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-1.5 rounded-md text-[11px] font-ui font-medium transition-colors"
                style={{
                  background: activeTab === tab ? 'hsl(var(--muted) / 0.4)' : 'transparent',
                  color: activeTab === tab ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                }}
              >
                {tab === 'activity' ? 'Recent Activity' : 'Purchases'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="pb-4">
            {activeTab === 'activity' ? (
              loadingTx ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : (
                <TransactionTimeline transactions={transactions} limit={10} />
              )
            ) : (
              loadingPurchases ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : purchases.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <CreditCard size={16} className="text-muted-foreground/30 mx-auto mb-1.5" />
                  <p className="text-[11px] font-ui text-muted-foreground">No purchases yet</p>
                </div>
              ) : (
                <div className="mt-1">
                  {purchases.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 px-5 py-2.5 hover:bg-muted/20 transition-colors"
                    >
                      <div className="w-6 h-6 rounded-md flex items-center justify-center bg-emerald-500/10">
                        <CreditCard size={11} className="text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-ui text-foreground">Credit Purchase</p>
                        <p className="text-[10px] font-ui text-muted-foreground">
                          ${p.priceUsd.toFixed(2)} · {p.creditsAmount} credits
                        </p>
                      </div>
                      <span className={`text-[10px] font-ui font-medium px-1.5 py-0.5 rounded ${
                        p.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                        p.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                        p.status === 'refunded' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex-shrink-0">
          <button
            onClick={() => { onClose(); navigate('/billing'); }}
            className="w-full flex items-center justify-center gap-1.5 text-[12px] font-ui text-muted-foreground hover:text-foreground transition-colors"
          >
            View full billing history
            <ChevronRight size={12} />
          </button>
        </div>

      </div>
    </>,
    document.body
  );
}
