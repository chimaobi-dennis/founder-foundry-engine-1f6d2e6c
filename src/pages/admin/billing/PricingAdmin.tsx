import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Plus, Trash2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  listGenerationPricing,
  updateGenerationPricing,
  createGenerationPricing,
  getCreditEconomicsSetting,
  updateCreditEconomicsSetting,
  listModelRates,
  upsertModelRate,
  deleteModelRate,
  getCogsDaily,
  type GenerationPricingRow,
  type CreditEconomicsSetting,
  type ModelRateRow,
  type CogsDay,
  type PricingMode,
  type ModelTier,
} from '@/services/billingAdminService';
import { invalidatePricingCache } from '@/services/pricingService';

// Admin palette, matching AdminBilling.tsx
const C = {
  text: '#F5F0E8',
  muted: '#6B7A8D',
  gold: '#D4A017',
  panel: '#0D1520',
  line: '#1A2A3A',
  field: '#1A2530',
  fieldLine: '#2A3A4A',
  good: '#4ADE80',
  bad: '#F87171',
};

const inputStyle = { background: C.field, border: `0.5px solid ${C.fieldLine}`, color: C.text };
const inputClass = 'w-full mt-1 px-3 py-2 rounded-lg text-[13px] font-ui';
const labelClass = 'text-[11px] font-ui';

function Panel({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl" style={{ background: C.panel, border: `0.5px solid ${C.line}` }}>
      <div className="flex items-start justify-between gap-3 px-4 py-3" style={{ borderBottom: `0.5px solid ${C.line}` }}>
        <div>
          <h3 className="text-[14px] font-display font-semibold" style={{ color: C.text }}>{title}</h3>
          {subtitle && <p className="text-[12px] font-ui" style={{ color: C.muted }}>{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SaveButton({ saving, onClick, label = 'Save' }: { saving: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-3 py-1.5 rounded-lg text-[12px] font-ui font-medium flex items-center gap-1 disabled:opacity-60"
      style={{ background: C.gold, color: '#0D1B2A' }}
    >
      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {label}
    </button>
  );
}

const money = (v: number, d = 2) => `$${v.toFixed(d)}`;

// ═══════════════════════════════════════════════════════════════
// PRICING ADMIN — economics, rules, rates, COGS
// ═══════════════════════════════════════════════════════════════

export default function PricingAdmin() {
  const [econ, setEcon] = useState<CreditEconomicsSetting | null>(null);
  const [rules, setRules] = useState<GenerationPricingRow[]>([]);
  const [rates, setRates] = useState<ModelRateRow[]>([]);
  const [cogs, setCogs] = useState<CogsDay[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const [e, r, m, c] = await Promise.all([
      getCreditEconomicsSetting(),
      listGenerationPricing(),
      listModelRates(),
      getCogsDaily(30),
    ]);
    setEcon(e);
    setRules(r);
    setRates(m);
    setCogs(c);
    invalidatePricingCache();
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  if (loading || !econ) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin" style={{ color: C.muted }} />
      </div>
    );
  }

  const creditCogs = econ.cogs_multiplier > 0 ? econ.retail_usd_per_credit / econ.cogs_multiplier : econ.retail_usd_per_credit;

  return (
    <div className="space-y-4">
      <EconomicsPanel econ={econ} onSaved={(e) => { setEcon(e); invalidatePricingCache(); }} />
      <CogsPanel days={cogs} econ={econ} onRefresh={reload} />
      <RulesPanel rules={rules} creditCogs={creditCogs} retailPerCredit={econ.retail_usd_per_credit} onChanged={reload} />
      <RatesPanel rates={rates} onChanged={reload} />
    </div>
  );
}

// ─── Credit economics ──────────────────────────────────────

function EconomicsPanel({ econ, onSaved }: { econ: CreditEconomicsSetting; onSaved: (e: CreditEconomicsSetting) => void }) {
  const [form, setForm] = useState(econ);
  const [saving, setSaving] = useState(false);
  const creditCogs = form.cogs_multiplier > 0 ? form.retail_usd_per_credit / form.cogs_multiplier : form.retail_usd_per_credit;
  const grossOnCredits = form.cogs_multiplier > 0 ? 1 - 1 / form.cogs_multiplier : 0;

  const save = async () => {
    setSaving(true);
    const result = await updateCreditEconomicsSetting(form);
    setSaving(false);
    if (result) {
      toast({ title: 'Credit economics saved' });
      onSaved(result);
    } else {
      toast({ title: 'Failed to save', variant: 'destructive' });
    }
  };

  return (
    <Panel
      title="Credit economics"
      subtitle="What a credit sells for, and the markup on provider cost. Every quote and metered capture reads these."
      right={<SaveButton saving={saving} onClick={save} />}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className={labelClass} style={{ color: C.muted }}>Retail price per credit ($)</label>
          <input type="number" step="0.001" min="0.001" value={form.retail_usd_per_credit}
            onChange={(e) => setForm({ ...form, retail_usd_per_credit: Number(e.target.value) })}
            className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={{ color: C.muted }}>COGS multiplier (×)</label>
          <input type="number" step="0.5" min="1" value={form.cogs_multiplier}
            onChange={(e) => setForm({ ...form, cogs_multiplier: Number(e.target.value) })}
            className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={{ color: C.muted }}>Metered overage</label>
          <select value={form.metered_overage_policy}
            onChange={(e) => setForm({ ...form, metered_overage_policy: e.target.value as CreditEconomicsSetting['metered_overage_policy'] })}
            className={inputClass} style={inputStyle}>
            <option value="pause">Pause the run and ask</option>
            <option value="bill_through">Bill through to the reservation cap</option>
          </select>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ background: C.field }}>
          <div className={labelClass} style={{ color: C.muted }}>Derived</div>
          <div className="text-[13px] font-ui" style={{ color: C.text }}>
            1 credit costs you <span style={{ color: C.gold }}>{money(creditCogs, 4)}</span>
          </div>
          <div className="text-[12px] font-ui" style={{ color: C.muted }}>
            {(grossOnCredits * 100).toFixed(0)}% gross on credits before Stripe and infra
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ─── COGS vs credits captured ──────────────────────────────

function CogsPanel({ days, econ, onRefresh }: { days: CogsDay[]; econ: CreditEconomicsSetting; onRefresh: () => Promise<void> }) {
  const [refreshing, setRefreshing] = useState(false);
  const totals = useMemo(() => days.reduce(
    (a, d) => ({
      calls: a.calls + d.calls,
      cost: a.cost + d.cost_usd,
      captured: a.captured + d.credits_captured,
      retail: a.retail + d.retail_usd,
    }),
    { calls: 0, cost: 0, captured: 0, retail: 0 }
  ), [days]);
  const margin = totals.retail > 0 ? (totals.retail - totals.cost) / totals.retail : null;
  const activeDays = days.filter((d) => d.calls > 0 || d.credits_captured > 0);
  const maxBar = Math.max(1, ...days.map((d) => Math.max(d.cost_usd, d.retail_usd)));

  return (
    <Panel
      title="Provider cost vs credits captured · last 30 days"
      subtitle="Cost comes from ai_usage_log (real tokens × model rates). Retail is credits captured × the retail price."
      right={
        <button
          onClick={async () => { setRefreshing(true); await onRefresh(); setRefreshing(false); }}
          className="px-3 py-1.5 rounded-lg text-[12px] font-ui flex items-center gap-1"
          style={{ background: C.field, color: C.text, border: `0.5px solid ${C.fieldLine}` }}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="AI calls" value={totals.calls.toLocaleString()} />
        <Stat label="Provider cost" value={money(totals.cost)} color={C.bad} />
        <Stat label="Credits captured" value={`${Math.round(totals.captured).toLocaleString()} · ${money(totals.retail)}`} color={C.good} />
        <Stat
          label="Gross margin on usage"
          value={margin == null ? '—' : `${(margin * 100).toFixed(0)}%`}
          color={margin == null ? C.muted : margin >= 0.7 ? C.good : margin >= 0.5 ? C.gold : C.bad}
          hint={`target ≥ ${((1 - 1 / econ.cogs_multiplier) * 100).toFixed(0)}% from the multiplier`}
        />
      </div>

      {activeDays.length === 0 ? (
        <p className="text-[13px] font-ui" style={{ color: C.muted }}>
          No usage logged yet. Once the ai-gateway serves a call, each day appears here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] font-ui" style={{ color: C.text }}>
            <thead>
              <tr style={{ color: C.muted }}>
                <th className="text-left py-1 pr-3 font-normal">Day</th>
                <th className="text-right py-1 px-2 font-normal">Calls</th>
                <th className="text-right py-1 px-2 font-normal">Cost</th>
                <th className="text-right py-1 px-2 font-normal">Captured</th>
                <th className="text-right py-1 px-2 font-normal">Retail</th>
                <th className="text-left py-1 pl-3 font-normal w-[40%]">Cost (red) vs retail (green)</th>
              </tr>
            </thead>
            <tbody>
              {[...activeDays].reverse().map((d) => (
                <tr key={d.day} style={{ borderTop: `0.5px solid ${C.line}` }}>
                  <td className="py-1 pr-3 tabular-nums">{d.day}</td>
                  <td className="py-1 px-2 text-right tabular-nums">{d.calls}</td>
                  <td className="py-1 px-2 text-right tabular-nums">{money(d.cost_usd, 3)}</td>
                  <td className="py-1 px-2 text-right tabular-nums">{Math.round(d.credits_captured)}</td>
                  <td className="py-1 px-2 text-right tabular-nums">{money(d.retail_usd)}</td>
                  <td className="py-1 pl-3">
                    <div className="space-y-0.5">
                      <div style={{ height: 4, width: `${(d.cost_usd / maxBar) * 100}%`, background: C.bad, borderRadius: 2 }} />
                      <div style={{ height: 4, width: `${(d.retail_usd / maxBar) * 100}%`, background: C.good, borderRadius: 2 }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Stat({ label, value, color, hint }: { label: string; value: string; color?: string; hint?: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: C.field }}>
      <div className={labelClass} style={{ color: C.muted }}>{label}</div>
      <div className="text-[15px] font-ui font-medium tabular-nums" style={{ color: color ?? C.text }}>{value}</div>
      {hint && <div className="text-[11px] font-ui" style={{ color: C.muted }}>{hint}</div>}
    </div>
  );
}

// ─── Pricing rules ─────────────────────────────────────────

function RulesPanel({ rules, creditCogs, retailPerCredit, onChanged }: { rules: GenerationPricingRow[]; creditCogs: number; retailPerCredit: number; onChanged: () => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newBase, setNewBase] = useState('1');

  const add = async () => {
    if (!newKey.trim() || !newName.trim()) return;
    const row = await createGenerationPricing({
      pricing_key: newKey.trim(),
      display_name: newName.trim(),
      base_cost: Number(newBase) || 0,
      per_platform_cost: 0,
      complexity_multipliers: {},
      feature_multipliers: {},
      model_multipliers: {},
    });
    if (row) {
      toast({ title: 'Rule created' });
      setAdding(false); setNewKey(''); setNewName(''); setNewBase('1');
      await onChanged();
    } else {
      toast({ title: 'Failed to create rule', variant: 'destructive' });
    }
  };

  return (
    <Panel
      title="Pricing rules"
      subtitle="One row per action. Fixed rules quote an exact number; metered rules quote a range and reserve the maximum."
      right={
        <button onClick={() => setAdding((v) => !v)} className="px-3 py-1.5 rounded-lg text-[12px] font-ui flex items-center gap-1"
          style={{ background: C.field, color: C.text, border: `0.5px solid ${C.fieldLine}` }}>
          <Plus size={12} /> New rule
        </button>
      }
    >
      {adding && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 p-3 rounded-lg" style={{ background: C.field }}>
          <div><label className={labelClass} style={{ color: C.muted }}>Key</label>
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="agent_newsletter" className={inputClass} style={inputStyle} /></div>
          <div><label className={labelClass} style={{ color: C.muted }}>Display name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Newsletter issue" className={inputClass} style={inputStyle} /></div>
          <div><label className={labelClass} style={{ color: C.muted }}>Base credits</label>
            <input type="number" value={newBase} onChange={(e) => setNewBase(e.target.value)} className={inputClass} style={inputStyle} /></div>
          <div className="flex items-end"><SaveButton saving={false} onClick={add} label="Create" /></div>
        </div>
      )}
      <div className="space-y-2">
        {rules.map((r) => <RuleCard key={r.id} rule={r} creditCogs={creditCogs} retailPerCredit={retailPerCredit} onChanged={onChanged} />)}
        {rules.length === 0 && <p className="text-[13px] font-ui" style={{ color: C.muted }}>No pricing rules yet.</p>}
      </div>
    </Panel>
  );
}

function RuleCard({ rule, creditCogs, retailPerCredit, onChanged }: { rule: GenerationPricingRow; creditCogs: number; retailPerCredit: number; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    display_name: rule.display_name,
    description: rule.description ?? '',
    base_cost: String(rule.base_cost),
    per_platform_cost: String(rule.per_platform_cost),
    pricing_mode: (rule.pricing_mode ?? 'fixed') as PricingMode,
    model_tier: (rule.model_tier ?? '') as ModelTier | '',
    range_factor: String(rule.range_factor ?? 1),
    cogs_estimate_usd: rule.cogs_estimate_usd == null ? '' : String(rule.cogs_estimate_usd),
    unit_label: rule.unit_label ?? '',
    is_active: rule.is_active,
    complexity: JSON.stringify(rule.complexity_multipliers ?? {}, null, 0),
    feature: JSON.stringify(rule.feature_multipliers ?? {}, null, 0),
    model: JSON.stringify(rule.model_multipliers ?? {}, null, 0),
  });

  const impliedCredits = f.cogs_estimate_usd && creditCogs > 0 ? Math.ceil(Number(f.cogs_estimate_usd) / creditCogs) : null;
  const baseNum = Number(f.base_cost) || 0;
  // Gross margin on this action: (credits × retail − COGS) ÷ (credits × retail)
  const impliedMargin = f.cogs_estimate_usd && baseNum > 0 && retailPerCredit > 0
    ? 1 - Number(f.cogs_estimate_usd) / (baseNum * retailPerCredit)
    : null;

  const parseJson = (s: string, label: string): Record<string, number> | null => {
    try {
      const v = JSON.parse(s || '{}');
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch { /* fallthrough */ }
    toast({ title: `${label} must be a JSON object`, variant: 'destructive' });
    return null;
  };

  const save = async () => {
    const complexity = parseJson(f.complexity, 'Complexity multipliers');
    const feature = parseJson(f.feature, 'Feature multipliers');
    const model = parseJson(f.model, 'Model multipliers');
    if (!complexity || !feature || !model) return;
    setSaving(true);
    const result = await updateGenerationPricing(rule.id, {
      display_name: f.display_name,
      description: f.description || null,
      base_cost: Number(f.base_cost) || 0,
      per_platform_cost: Number(f.per_platform_cost) || 0,
      pricing_mode: f.pricing_mode,
      model_tier: f.model_tier || null,
      range_factor: Number(f.range_factor) || 1,
      cogs_estimate_usd: f.cogs_estimate_usd === '' ? null : Number(f.cogs_estimate_usd),
      unit_label: f.unit_label || null,
      is_active: f.is_active,
      complexity_multipliers: complexity,
      feature_multipliers: feature,
      model_multipliers: model,
    });
    setSaving(false);
    if (result) {
      toast({ title: 'Rule saved' });
      await onChanged();
    } else {
      toast({ title: 'Failed to save rule', variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: C.field, border: `0.5px solid ${C.fieldLine}` }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-3 py-2.5 text-left">
        <div className="min-w-0">
          <span className="text-[13px] font-ui font-medium" style={{ color: C.text }}>{rule.display_name}</span>
          <span className="ml-2 text-[11px] font-mono" style={{ color: C.muted }}>{rule.pricing_key}</span>
          {!rule.is_active && <span className="ml-2 text-[10px] uppercase font-ui px-1.5 py-0.5 rounded" style={{ background: C.panel, color: C.muted }}>inactive</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[12px] font-ui tabular-nums" style={{ color: C.gold }}>
            {rule.base_cost} base{rule.per_platform_cost ? ` · ${rule.per_platform_cost}/platform` : ''}
          </span>
          <span className="text-[10px] uppercase font-ui px-1.5 py-0.5 rounded" style={{ background: C.panel, color: rule.pricing_mode === 'metered' ? C.gold : C.muted }}>
            {rule.pricing_mode ?? 'fixed'}{rule.model_tier ? ` · ${rule.model_tier}` : ''}
          </span>
          {open ? <ChevronUp size={14} style={{ color: C.muted }} /> : <ChevronDown size={14} style={{ color: C.muted }} />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3" style={{ borderTop: `0.5px solid ${C.fieldLine}` }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
            <Field label="Display name"><input value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} className={inputClass} style={inputStyle} /></Field>
            <Field label="Unit label"><input value={f.unit_label} onChange={(e) => setF({ ...f, unit_label: e.target.value })} placeholder="post, product, run" className={inputClass} style={inputStyle} /></Field>
            <Field label="Base credits"><input type="number" step="1" value={f.base_cost} onChange={(e) => setF({ ...f, base_cost: e.target.value })} className={inputClass} style={inputStyle} /></Field>
            <Field label="Per-platform credits"><input type="number" step="0.1" value={f.per_platform_cost} onChange={(e) => setF({ ...f, per_platform_cost: e.target.value })} className={inputClass} style={inputStyle} /></Field>
            <Field label="Pricing mode">
              <select value={f.pricing_mode} onChange={(e) => setF({ ...f, pricing_mode: e.target.value as PricingMode })} className={inputClass} style={inputStyle}>
                <option value="fixed">Fixed (exact quote)</option>
                <option value="metered">Metered (range, reserve max)</option>
              </select>
            </Field>
            <Field label="Model tier">
              <select value={f.model_tier} onChange={(e) => setF({ ...f, model_tier: e.target.value as ModelTier | '' })} className={inputClass} style={inputStyle}>
                <option value="">—</option>
                <option value="fast">fast</option>
                <option value="standard">standard</option>
                <option value="reasoning">reasoning</option>
              </select>
            </Field>
            <Field label="Range factor (metered max ÷ estimate)"><input type="number" step="0.1" min="1" value={f.range_factor} onChange={(e) => setF({ ...f, range_factor: e.target.value })} className={inputClass} style={inputStyle} /></Field>
            <Field label="COGS estimate ($ per unit)"><input type="number" step="0.0001" value={f.cogs_estimate_usd} onChange={(e) => setF({ ...f, cogs_estimate_usd: e.target.value })} className={inputClass} style={inputStyle} /></Field>
          </div>
          {impliedCredits != null && (
            <p className="text-[12px] font-ui" style={{ color: C.muted }}>
              At the current multiplier this COGS implies <span style={{ color: C.gold }}>{impliedCredits} credits</span>;
              the rule charges {baseNum}
              {impliedMargin != null && <> ({impliedMargin >= 0 ? '' : '−'}{Math.abs(impliedMargin * 100).toFixed(0)}% gross on this action)</>}.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Complexity multipliers (JSON)"><textarea rows={2} value={f.complexity} onChange={(e) => setF({ ...f, complexity: e.target.value })} className={`${inputClass} font-mono text-[12px]`} style={inputStyle} /></Field>
            <Field label="Feature multipliers (JSON)"><textarea rows={2} value={f.feature} onChange={(e) => setF({ ...f, feature: e.target.value })} className={`${inputClass} font-mono text-[12px]`} style={inputStyle} /></Field>
            <Field label="Model multipliers (JSON)"><textarea rows={2} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} className={`${inputClass} font-mono text-[12px]`} style={inputStyle} /></Field>
          </div>
          <Field label="Description"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={inputClass} style={inputStyle} /></Field>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[12px] font-ui" style={{ color: C.text }}>
              <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Active
            </label>
            <SaveButton saving={saving} onClick={save} />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass} style={{ color: C.muted }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Model rates ───────────────────────────────────────────

const emptyRate = { provider_slug: '', model_id: '', display_name: '', input_per_1m: '', output_per_1m: '', cache_read_per_1m: '', cache_write_per_1m: '' };

function RatesPanel({ rates, onChanged }: { rates: ModelRateRow[]; onChanged: () => Promise<void> }) {
  const [draft, setDraft] = useState(emptyRate);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft.provider_slug.trim() || !draft.model_id.trim()) {
      toast({ title: 'Provider slug and model id are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const row = await upsertModelRate({
      provider_slug: draft.provider_slug.trim(),
      model_id: draft.model_id.trim(),
      display_name: draft.display_name.trim() || null,
      input_per_1m: Number(draft.input_per_1m) || 0,
      output_per_1m: Number(draft.output_per_1m) || 0,
      cache_read_per_1m: draft.cache_read_per_1m === '' ? null : Number(draft.cache_read_per_1m),
      cache_write_per_1m: draft.cache_write_per_1m === '' ? null : Number(draft.cache_write_per_1m),
      is_active: true,
      source: 'admin',
    });
    setSaving(false);
    if (row) {
      toast({ title: 'Rate saved' });
      setDraft(emptyRate);
      await onChanged();
    } else {
      toast({ title: 'Failed to save rate', variant: 'destructive' });
    }
  };

  const remove = async (r: ModelRateRow) => {
    if (await deleteModelRate(r.id)) {
      toast({ title: `Removed ${r.model_id}` });
      await onChanged();
    }
  };

  return (
    <Panel title="Model rates" subtitle="Provider list price per 1M tokens. The gateway uses the row matching the provider slug and model id; cache tiers fall back to the input rate.">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] font-ui" style={{ color: C.text }}>
          <thead>
            <tr style={{ color: C.muted }}>
              <th className="text-left py-1 pr-2 font-normal">Provider</th>
              <th className="text-left py-1 px-2 font-normal">Model id</th>
              <th className="text-left py-1 px-2 font-normal">Name</th>
              <th className="text-right py-1 px-2 font-normal">In</th>
              <th className="text-right py-1 px-2 font-normal">Out</th>
              <th className="text-right py-1 px-2 font-normal">Cache read</th>
              <th className="text-right py-1 px-2 font-normal">Cache write</th>
              <th className="py-1 pl-2"></th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} style={{ borderTop: `0.5px solid ${C.line}` }}>
                <td className="py-1.5 pr-2 font-mono">{r.provider_slug}</td>
                <td className="py-1.5 px-2 font-mono">{r.model_id}</td>
                <td className="py-1.5 px-2">{r.display_name ?? ''}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{money(r.input_per_1m)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{money(r.output_per_1m)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{r.cache_read_per_1m == null ? '—' : money(r.cache_read_per_1m)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{r.cache_write_per_1m == null ? '—' : money(r.cache_write_per_1m)}</td>
                <td className="py-1.5 pl-2 text-right">
                  <button onClick={() => remove(r)} aria-label={`Remove ${r.model_id}`} className="p-1 rounded" style={{ color: C.muted }}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: `0.5px solid ${C.line}` }}>
              <td className="py-1.5 pr-2"><input value={draft.provider_slug} onChange={(e) => setDraft({ ...draft, provider_slug: e.target.value })} placeholder="anthropic" className="w-28 px-2 py-1 rounded text-[12px] font-mono" style={inputStyle} /></td>
              <td className="py-1.5 px-2"><input value={draft.model_id} onChange={(e) => setDraft({ ...draft, model_id: e.target.value })} placeholder="claude-sonnet-5-5" className="w-40 px-2 py-1 rounded text-[12px] font-mono" style={inputStyle} /></td>
              <td className="py-1.5 px-2"><input value={draft.display_name} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} placeholder="Name" className="w-32 px-2 py-1 rounded text-[12px]" style={inputStyle} /></td>
              {(['input_per_1m', 'output_per_1m', 'cache_read_per_1m', 'cache_write_per_1m'] as const).map((k) => (
                <td key={k} className="py-1.5 px-2"><input type="number" step="0.01" value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className="w-20 px-2 py-1 rounded text-[12px] text-right" style={inputStyle} /></td>
              ))}
              <td className="py-1.5 pl-2 text-right"><SaveButton saving={saving} onClick={save} label="Add" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] font-ui mt-2" style={{ color: C.muted }}>
        Adding a rate for a provider + model that already exists replaces it.
      </p>
    </Panel>
  );
}
