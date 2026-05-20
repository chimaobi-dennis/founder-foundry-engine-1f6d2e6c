import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FadeIn } from '@/components/FadeIn';
import {
  Coins, CreditCard, History, TrendingUp, Loader2, CheckCircle2,
  ArrowUpRight, ArrowDownRight, Clock, RefreshCw, ShoppingBag,
  Lock, Unlock, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCreditBalance } from '@/hooks/use-credit-balance';
import { getPurchaseHistory, type CreditPurchase } from '@/services/stripeService';
import { getTransactionHistory, type CreditTransaction } from '@/services/generationCreditService';
import { CreditPurchaseModal } from '@/components/billing/CreditPurchaseModal';

// ═══════════════════════════════════════════════════════════════
// BILLING PAGE
// ═══════════════════════════════════════════════════════════════

export default function Billing() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { balance, wallet, loading: balanceLoading, refresh: refreshBalance } = useCreditBalance();
  const [purchases, setPurchases] = useState<CreditPurchase[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'purchases'>('transactions');

  // Handle Stripe return
  useEffect(() => {
    const purchaseStatus = searchParams.get('purchase');
    if (purchaseStatus === 'success') {
      toast({
        title: 'Purchase successful!',
        description: 'Your credits have been added to your wallet.',
      });
      refreshBalance();
    } else if (purchaseStatus === 'cancelled') {
      toast({
        title: 'Purchase cancelled',
        description: 'No charges were made.',
        variant: 'destructive',
      });
    }
  }, [searchParams, refreshBalance]);

  // Load data
  useEffect(() => {
    if (!user?.id) return;

    getPurchaseHistory({ limit: 20 })
      .then(setPurchases)
      .finally(() => setLoadingPurchases(false));

    getTransactionHistory(user.id, { limit: 50 })
      .then(setTransactions)
      .finally(() => setLoadingTransactions(false));
  }, [user?.id]);

  // Refresh after purchase
  const handlePurchaseModalClose = () => {
    setShowPurchaseModal(false);
    refreshBalance();
    if (!user?.id) return;
    getPurchaseHistory({ limit: 20 }).then(setPurchases);
    getTransactionHistory(user.id, { limit: 50 }).then(setTransactions);
  };

  return (
    <FadeIn>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold text-foreground">Billing & Credits</h1>
            <p className="text-[13px] font-ui text-muted-foreground mt-1">
              Manage your credits, view transactions, and purchase more.
            </p>
          </div>
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-ui text-[13px] font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <CreditCard size={15} />
            Buy Credits
          </button>
        </div>

        {/* Wallet Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Available Balance */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Coins size={16} className="text-amber-500" />
              </div>
              <span className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider">Available</span>
            </div>
            {balanceLoading ? (
              <div className="h-8 w-24 rounded bg-muted animate-pulse" />
            ) : (
              <p className="text-3xl font-display font-bold text-foreground">{balance.toLocaleString()}</p>
            )}
            <p className="text-[11px] font-ui text-muted-foreground mt-1">credits</p>
          </div>

          {/* Reserved */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Lock size={16} className="text-blue-500" />
              </div>
              <span className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider">Reserved</span>
            </div>
            {balanceLoading ? (
              <div className="h-8 w-20 rounded bg-muted animate-pulse" />
            ) : (
              <p className="text-3xl font-display font-bold text-foreground">
                {(wallet?.reservedBalance ?? 0).toLocaleString()}
              </p>
            )}
            <p className="text-[11px] font-ui text-muted-foreground mt-1">in active generations</p>
          </div>

          {/* Lifetime */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp size={16} className="text-emerald-500" />
              </div>
              <span className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider">Lifetime</span>
            </div>
            {balanceLoading ? (
              <div className="h-8 w-20 rounded bg-muted animate-pulse" />
            ) : (
              <div className="flex items-baseline gap-3">
                <div>
                  <p className="text-lg font-display font-semibold text-foreground">
                    {(wallet?.lifetimeEarned ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] font-ui text-muted-foreground">earned</p>
                </div>
                <div>
                  <p className="text-lg font-display font-semibold text-foreground">
                    {(wallet?.lifetimeSpent ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] font-ui text-muted-foreground">spent</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab('transactions')}
            className={cn(
              'px-4 py-2.5 text-[13px] font-ui font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'transactions'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <History size={14} className="inline mr-1.5 -mt-0.5" />
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={cn(
              'px-4 py-2.5 text-[13px] font-ui font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'purchases'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <ShoppingBag size={14} className="inline mr-1.5 -mt-0.5" />
            Purchases
          </button>
        </div>

        {/* Transaction History */}
        {activeTab === 'transactions' && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loadingTransactions ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-16">
                <History size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-[13px] font-ui text-muted-foreground">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {transactions.map((txn) => (
                  <TransactionRow key={txn.id} txn={txn} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Purchase History */}
        {activeTab === 'purchases' && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loadingPurchases ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : purchases.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingBag size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-[13px] font-ui text-muted-foreground">No purchases yet</p>
                <button
                  onClick={() => setShowPurchaseModal(true)}
                  className="mt-3 text-[12px] font-ui text-primary hover:underline"
                >
                  Buy your first credits
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {purchases.map((purchase) => (
                  <PurchaseRow key={purchase.id} purchase={purchase} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Purchase Modal */}
      <CreditPurchaseModal
        open={showPurchaseModal}
        onClose={handlePurchaseModalClose}
        currentBalance={balance}
      />
    </FadeIn>
  );
}

// ═══════════════════════════════════════════════════════════════
// TRANSACTION ROW
// ═══════════════════════════════════════════════════════════════

const TXN_ICONS: Record<string, { icon: typeof Coins; color: string; bg: string }> = {
  charge: { icon: ArrowDownRight, color: 'text-red-400', bg: 'bg-red-500/10' },
  refund: { icon: RefreshCw, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  topup: { icon: ArrowUpRight, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  bonus: { icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  adjustment: { icon: RefreshCw, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  reservation: { icon: Lock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  reservation_release: { icon: Unlock, color: 'text-blue-300', bg: 'bg-blue-400/10' },
  reservation_capture: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  expiry: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/30' },
};

function TransactionRow({ txn }: { txn: CreditTransaction }) {
  const config = TXN_ICONS[txn.type] ?? TXN_ICONS.adjustment;
  const Icon = config.icon;
  const isPositive = txn.amount > 0;

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', config.bg)}>
        <Icon size={14} className={config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-ui text-foreground truncate">
          {txn.description || formatTxnType(txn.type)}
        </p>
        <p className="text-[11px] font-ui text-muted-foreground">
          {new Date(txn.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <div className="text-right">
        <p className={cn('text-[14px] font-display font-semibold', isPositive ? 'text-emerald-500' : 'text-foreground')}>
          {isPositive ? '+' : ''}{txn.amount.toLocaleString()}
        </p>
        <p className="text-[10px] font-ui text-muted-foreground">
          bal: {txn.balanceAfter.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function formatTxnType(type: string): string {
  const map: Record<string, string> = {
    charge: 'Generation charge',
    refund: 'Credit refund',
    topup: 'Credit purchase',
    bonus: 'Bonus credits',
    adjustment: 'Balance adjustment',
    reservation: 'Credit reservation',
    reservation_release: 'Reservation released',
    reservation_capture: 'Credits captured',
    expiry: 'Credits expired',
  };
  return map[type] || type;
}

// ═══════════════════════════════════════════════════════════════
// PURCHASE ROW
// ═══════════════════════════════════════════════════════════════

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Completed', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  pending: { label: 'Pending', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  failed: { label: 'Failed', color: 'text-destructive', bg: 'bg-destructive/10' },
  refunded: { label: 'Refunded', color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

function PurchaseRow({ purchase }: { purchase: CreditPurchase }) {
  const status = STATUS_STYLES[purchase.status] ?? STATUS_STYLES.pending;

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <ShoppingBag size={14} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-ui text-foreground">{purchase.packageName}</p>
        <p className="text-[11px] font-ui text-muted-foreground">
          {new Date(purchase.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          {' · '}${purchase.priceUsd.toFixed(2)}
        </p>
      </div>
      <div className="text-right flex items-center gap-3">
        <div>
          <p className="text-[14px] font-display font-semibold text-foreground">
            {purchase.creditsGranted > 0 ? `+${purchase.creditsGranted.toLocaleString()}` : purchase.creditsAmount.toLocaleString()}
          </p>
          <p className="text-[10px] font-ui text-muted-foreground">credits</p>
        </div>
        <span className={cn('text-[10px] font-ui font-medium px-2 py-0.5 rounded-full', status.bg, status.color)}>
          {status.label}
        </span>
      </div>
    </div>
  );
}
