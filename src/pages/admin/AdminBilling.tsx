import { useState, useEffect } from 'react';
import { FadeIn } from '@/components/FadeIn';
import {
  Coins, DollarSign, Users, TrendingUp, CreditCard,
  Package, Settings, Gift, BarChart3, Loader2, Plus,
  Pencil, Trash2, Check, X, Save, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  getBillingAnalytics,
  listCreditPackages,
  createCreditPackage,
  updateCreditPackage,
  deleteCreditPackage,
  getBillingSettings,
  updateBillingSettings,
  grantCreditsToUser,
  getAllPurchases,
  type BillingAnalytics,
  type CreditPackageRow,
  type BillingSettings,
} from '@/services/billingAdminService';
import PricingAdmin from './billing/PricingAdmin';

// ═══════════════════════════════════════════════════════════════
// ADMIN BILLING DASHBOARD
// ═══════════════════════════════════════════════════════════════

export default function AdminBilling() {
  const [activeSection, setActiveSection] = useState<'analytics' | 'packages' | 'pricing' | 'settings' | 'grants'>('analytics');

  const sections = [
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
    { id: 'packages' as const, label: 'Packages', icon: Package },
    { id: 'pricing' as const, label: 'Pricing', icon: DollarSign },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
    { id: 'grants' as const, label: 'Grants', icon: Gift },
  ];

  return (
    <FadeIn>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-display font-semibold" style={{ color: '#0B1220' }}>
            Billing Management
          </h1>
          <p className="text-[13px] font-ui" style={{ color: '#5B6472' }}>
            Revenue analytics, credit packages, pricing, and manual grants.
          </p>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #DDE3EC' }}>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-ui transition-colors',
                activeSection === s.id
                  ? 'font-medium'
                  : ''
              )}
              style={{
                background: activeSection === s.id ? '#F0F3F7' : 'transparent',
                color: activeSection === s.id ? '#0B1220' : '#5B6472',
              }}
            >
              <s.icon size={14} />
              {s.label}
            </button>
          ))}
        </div>

        {activeSection === 'analytics' && <AnalyticsSection />}
        {activeSection === 'packages' && <PackagesSection />}
        {activeSection === 'pricing' && <PricingSection />}
        {activeSection === 'settings' && <SettingsSection />}
        {activeSection === 'grants' && <GrantsSection />}
      </div>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════

function AnalyticsSection() {
  const [analytics, setAnalytics] = useState<BillingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBillingAnalytics()
      .then(setAnalytics)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin" style={{ color: '#5B6472' }} />
      </div>
    );
  }

  if (!analytics) return null;

  const cards = [
    { label: 'Total Revenue', value: `$${analytics.totalRevenue.toFixed(2)}`, icon: DollarSign, color: '#157347' },
    { label: 'Credits Sold', value: analytics.totalCreditsGranted.toLocaleString(), icon: Coins, color: '#1E4ED8' },
    { label: 'Credits Consumed', value: analytics.totalCreditsSpent.toLocaleString(), icon: TrendingUp, color: '#B42318' },
    { label: 'Active Wallets', value: analytics.activeWallets.toLocaleString(), icon: Users, color: '#1E4ED8' },
    { label: 'Purchases', value: analytics.completedPurchases.toLocaleString(), icon: CreditCard, color: '#6D28D9' },
    { label: 'Avg Balance', value: analytics.averageBalance.toLocaleString(), icon: BarChart3, color: '#0F766E' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl p-5"
          style={{ background: '#FFFFFF', border: '1px solid #DDE3EC' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <card.icon size={14} style={{ color: card.color }} />
            <span className="text-[11px] font-ui uppercase tracking-wider" style={{ color: '#5B6472' }}>
              {card.label}
            </span>
          </div>
          <p className="text-2xl font-display font-bold" style={{ color: '#0B1220' }}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PACKAGES CRUD
// ═══════════════════════════════════════════════════════════════

function PackagesSection() {
  const [packages, setPackages] = useState<CreditPackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    listCreditPackages().then(setPackages).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this package?')) return;
    const ok = await deleteCreditPackage(id);
    if (ok) {
      toast({ title: 'Package deleted' });
      load();
    } else {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: '#5B6472' }} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-display font-semibold" style={{ color: '#0B1220' }}>Credit Packages</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-ui font-medium"
          style={{ background: '#F0F3F7', border: '1px solid #C9D2DE', color: '#1E4ED8' }}
        >
          <Plus size={12} /> Add Package
        </button>
      </div>

      {showCreate && (
        <PackageForm
          onSave={async (data) => {
            const result = await createCreditPackage(data);
            if (result) {
              toast({ title: 'Package created' });
              setShowCreate(false);
              load();
            }
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="space-y-2">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: '#FFFFFF', border: '1px solid #DDE3EC' }}
          >
            <div className="flex items-center gap-3">
              <Package size={14} style={{ color: '#1E4ED8' }} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-ui font-medium" style={{ color: '#0B1220' }}>{pkg.name}</span>
                  {pkg.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-ui font-semibold uppercase" style={{ background: '#1E4ED8', color: '#FFFFFF' }}>
                      {pkg.badge}
                    </span>
                  )}
                  {!pkg.active && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-ui" style={{ background: '#F5C2C2', color: '#B42318' }}>Inactive</span>
                  )}
                </div>
                <span className="text-[11px] font-ui" style={{ color: '#5B6472' }}>
                  {pkg.credits} credits · ${Number(pkg.price_usd).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleDelete(pkg.id)}
                className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={13} style={{ color: '#B42318' }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PackageForm({ onSave, onCancel }: {
  onSave: (data: { name: string; credits: number; price_usd: number; description?: string; badge?: string; sort_order?: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [credits, setCredits] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');
  const [badge, setBadge] = useState('');

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#FFFFFF', border: '1px solid #C9D2DE' }}>
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Package name" value={name} onChange={e => setName(e.target.value)}
          className="px-3 py-2 rounded-lg text-[13px] font-ui" style={{ background: '#F0F3F7', border: '1px solid #C9D2DE', color: '#0B1220' }} />
        <input placeholder="Badge (optional)" value={badge} onChange={e => setBadge(e.target.value)}
          className="px-3 py-2 rounded-lg text-[13px] font-ui" style={{ background: '#F0F3F7', border: '1px solid #C9D2DE', color: '#0B1220' }} />
        <input placeholder="Credits" type="number" value={credits} onChange={e => setCredits(e.target.value)}
          className="px-3 py-2 rounded-lg text-[13px] font-ui" style={{ background: '#F0F3F7', border: '1px solid #C9D2DE', color: '#0B1220' }} />
        <input placeholder="Price USD" type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
          className="px-3 py-2 rounded-lg text-[13px] font-ui" style={{ background: '#F0F3F7', border: '1px solid #C9D2DE', color: '#0B1220' }} />
      </div>
      <input placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-[13px] font-ui" style={{ background: '#F0F3F7', border: '1px solid #C9D2DE', color: '#0B1220' }} />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-[12px] font-ui" style={{ color: '#5B6472' }}>Cancel</button>
        <button
          onClick={() => name && credits && price && onSave({
            name, credits: Number(credits), price_usd: Number(price),
            description: desc || undefined, badge: badge || undefined,
          })}
          className="px-3 py-1.5 rounded-lg text-[12px] font-ui font-medium flex items-center gap-1"
          style={{ background: '#1E4ED8', color: '#FFFFFF' }}
        >
          <Save size={12} /> Create
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PRICING
// ═══════════════════════════════════════════════════════════════

function PricingSection() {
  return <PricingAdmin />;
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════

function SettingsSection() {
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BillingSettings>({
    stripe_live_mode: false,
    free_trial_credits: 10,
    max_retry_count: 3,
    default_generation_cost: 1,
  });

  useEffect(() => {
    getBillingSettings().then((s) => {
      setSettings(s);
      setForm(s);
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateBillingSettings(form);
    setSaving(false);
    if (result) {
      setSettings(result);
      toast({ title: 'Settings saved' });
    } else {
      toast({ title: 'Failed to save', variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: '#5B6472' }} /></div>;
  }

  const fields: { key: keyof BillingSettings; label: string; type: 'number' | 'toggle'; desc: string }[] = [
    { key: 'stripe_live_mode', label: 'Stripe Live Mode', type: 'toggle', desc: 'Use live Stripe keys (production)' },
    { key: 'free_trial_credits', label: 'Free Trial Credits', type: 'number', desc: 'Credits given to new users' },
    { key: 'max_retry_count', label: 'Max Retry Count', type: 'number', desc: 'Max generation retries allowed' },
    { key: 'default_generation_cost', label: 'Default Generation Cost', type: 'number', desc: 'Base credit cost per generation' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-[15px] font-display font-semibold" style={{ color: '#0B1220' }}>Platform Settings</h2>
      <div className="space-y-3">
        {fields.map((field) => (
          <div
            key={field.key}
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: '#FFFFFF', border: '1px solid #DDE3EC' }}
          >
            <div>
              <span className="text-[13px] font-ui font-medium" style={{ color: '#0B1220' }}>{field.label}</span>
              <p className="text-[11px] font-ui" style={{ color: '#5B6472' }}>{field.desc}</p>
            </div>
            {field.type === 'toggle' ? (
              <button
                onClick={() => setForm(f => ({ ...f, [field.key]: !f[field.key] }))}
                className="w-10 h-6 rounded-full transition-colors relative"
                style={{
                  background: form[field.key] ? '#157347' : '#C9D2DE',
                }}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full transition-all"
                  style={{
                    background: '#0B1220',
                    left: form[field.key] ? '22px' : '4px',
                  }}
                />
              </button>
            ) : (
              <input
                type="number"
                value={form[field.key] as number}
                onChange={e => setForm(f => ({ ...f, [field.key]: Number(e.target.value) }))}
                className="w-20 px-2 py-1 rounded-lg text-[13px] font-ui text-right"
                style={{ background: '#F0F3F7', border: '1px solid #C9D2DE', color: '#0B1220' }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-[13px] font-ui font-medium flex items-center gap-1.5"
          style={{ background: '#1E4ED8', color: '#FFFFFF' }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Settings
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GRANTS
// ═══════════════════════════════════════════════════════════════

function GrantsSection() {
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [grantType, setGrantType] = useState<'manual_adjustment' | 'credit_purchase' | 'refund'>('manual_adjustment');
  const [description, setDescription] = useState('');
  const [granting, setGranting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; balanceAfter?: number } | null>(null);

  const handleGrant = async () => {
    if (!userId || !amount) return;
    setGranting(true);
    setResult(null);
    const res = await grantCreditsToUser({
      userId,
      amount: Number(amount),
      type: grantType,
      description: description || undefined,
    });
    setGranting(false);
    setResult(res);
    if (res.success) {
      toast({ title: `Granted ${amount} credits` });
      setAmount('');
      setDescription('');
    } else {
      toast({ title: res.error || 'Grant failed', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-[15px] font-display font-semibold" style={{ color: '#0B1220' }}>Manual Credit Grant</h2>
      <div className="rounded-xl p-5 space-y-4" style={{ background: '#FFFFFF', border: '1px solid #DDE3EC' }}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-ui" style={{ color: '#5B6472' }}>User ID</label>
            <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="UUID"
              className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] font-ui" style={{ background: '#F0F3F7', border: '1px solid #C9D2DE', color: '#0B1220' }} />
          </div>
          <div>
            <label className="text-[11px] font-ui" style={{ color: '#5B6472' }}>Credits</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="100"
              className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] font-ui" style={{ background: '#F0F3F7', border: '1px solid #C9D2DE', color: '#0B1220' }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-ui" style={{ color: '#5B6472' }}>Type</label>
            <select value={grantType} onChange={e => setGrantType(e.target.value as any)}
              className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] font-ui" style={{ background: '#F0F3F7', border: '1px solid #C9D2DE', color: '#0B1220' }}>
              <option value="manual_adjustment">Manual adjustment</option>
              <option value="credit_purchase">Credit purchase</option>
              <option value="refund">Refund</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-ui" style={{ color: '#5B6472' }}>Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional note"
              className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] font-ui" style={{ background: '#F0F3F7', border: '1px solid #C9D2DE', color: '#0B1220' }} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          {result && (
            <span className={cn('text-[12px] font-ui', result.success ? '' : '')} style={{ color: result.success ? '#157347' : '#B42318' }}>
              {result.success
                ? `Granted! Balance: ${result.balanceAfter?.toLocaleString()}`
                : 'Grant failed'}
            </span>
          )}
          <button
            onClick={handleGrant}
            disabled={granting || !userId || !amount}
            className="ml-auto px-4 py-2 rounded-lg text-[13px] font-ui font-medium flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: '#1E4ED8', color: '#FFFFFF' }}
          >
            {granting ? <Loader2 size={13} className="animate-spin" /> : <Gift size={13} />} Grant Credits
          </button>
        </div>
      </div>
    </div>
  );
}
