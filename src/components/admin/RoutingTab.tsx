import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Plus, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AIModel, AIProvider } from "@/services/aiService";
import { activateProfile, blendedPer1M, createProfile, deleteProfile, getRoutingSnapshot, setClassRule, setTaskClass, setTaskOverride, type RoutingSnapshot } from "@/services/modelRoutingService";

const NONE = "__none__";

/**
 * Admin → AI Models → Routing. One active profile maps each class of work to
 * a model and its fallbacks; switching profiles moves every call at once.
 */
export function RoutingTab({ models, providers, keyStatus }: { models: AIModel[]; providers: AIProvider[]; keyStatus: Record<string, { has_key: boolean; key_hint: string | null }> }) {
  const [snap, setSnap] = useState<RoutingSnapshot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", slug: "", copy: true });

  const load = async () => {
    const s = await getRoutingSnapshot();
    setSnap(s);
    setSelected((cur) => cur ?? s.profiles.find((p) => p.is_active)?.id ?? s.profiles[0]?.id ?? null);
  };
  useEffect(() => { load(); }, []);

  const providerById = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);
  const usable = useMemo(() => models.filter((m) => m.is_enabled).map((m) => {
    const p = providerById.get(m.provider_id);
    const hasKey = !!(p && keyStatus[p.id]?.has_key);
    return { ...m, providerName: p?.name ?? "?", providerSlug: p?.slug ?? "", providerEnabled: !!(p?.is_enabled), hasKey, ready: !!(p?.is_enabled) && hasKey };
  }), [models, providerById, keyStatus]);
  const modelById = useMemo(() => new Map(usable.map((m) => [m.id, m])), [usable]);

  if (!snap) return <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" size={18} /></div>;
  const profile = snap.profiles.find((p) => p.id === selected) ?? null;
  const rulesFor = (classSlug: string) => snap.rules.find((r) => r.profile_id === profile?.id && r.class_slug === classSlug);
  const overrideFor = (t: string) => snap.overrides.find((o) => o.profile_id === profile?.id && o.task_type === t);

  const act = async (key: string, fn: () => Promise<{ success: boolean; error?: string }>, okMsg?: string) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (!r.success) { toast.error(r.error ?? "Something went wrong"); return false; }
    if (okMsg) toast(okMsg);
    await load();
    return true;
  };

  const modelLabel = (id: string | undefined) => { const m = id ? modelById.get(id) : null; return m ? `${m.name} · ${m.providerName}` : "—"; };
  const readiness = (id: string | undefined) => { const m = id ? modelById.get(id) : null; if (!m) return null; if (!m.providerEnabled) return "provider disabled"; if (!m.hasKey) return "no key"; return null; };

  return (
    <div className="space-y-6">
      {/* ── Profiles ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-ui text-[13px] font-semibold text-foreground">Routing profiles</h3>
            <p className="text-[12px] text-muted-foreground">A profile maps every class of work to a model. Activate one to move every AI call at once, for example open models in development and proprietary ones in production.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setNewForm({ name: "", slug: "", copy: true }); setNewOpen(true); }}><Plus size={14} className="mr-1" /> New profile</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {snap.profiles.map((p) => {
            const rules = snap.rules.filter((r) => r.profile_id === p.id);
            const unready = snap.classes.filter((c) => { const r = rules.find((x) => x.class_slug === c.slug); return !r || !modelById.get(r.model_id)?.ready; }).map((c) => c.name);
            return (
              <div key={p.id} onClick={() => setSelected(p.id)} className={`rounded-lg border p-3 cursor-pointer ${selected === p.id ? "border-primary bg-primary/5" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-ui text-[13px] font-medium text-foreground">{p.name}</p>
                  {p.is_active ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600"><Check size={12} /> active</span> : (
                    <Button size="sm" variant="outline" disabled={busy === `activate-${p.id}` || unready.length > 0} title={unready.length ? `Not ready: ${unready.join(", ")}` : undefined} onClick={(e) => { e.stopPropagation(); act(`activate-${p.id}`, () => activateProfile(p.id), `${p.name} is now live for every AI call`); }}>
                      {busy === `activate-${p.id}` ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} className="mr-1" />} Activate
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{p.description}</p>
                {unready.length > 0 && <p className="text-[11px] text-amber-600 mt-1">Not ready: {unready.join(", ")} need a model whose provider is enabled and has a key.</p>}
                {!p.is_active && (
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete profile "${p.name}"?`)) act(`del-${p.id}`, () => deleteProfile(p.id), "Profile deleted").then((ok) => { if (ok && selected === p.id) setSelected(null); }); }} className="mt-2 text-[11px] text-muted-foreground hover:text-destructive inline-flex items-center gap-1"><Trash2 size={11} /> delete</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {profile && (
        <>
          {/* ── Class rules ── */}
          <div>
            <h3 className="font-ui text-[13px] font-semibold text-foreground">Classes of work · {profile.name}{profile.is_active ? "" : " (not active)"}</h3>
            <p className="text-[12px] text-muted-foreground mb-2">Primary model and fallbacks per class. The gateway retries a provider once on rate limits or outages, then moves to the next fallback. Changes apply to the next call.</p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50"><tr>
                  <th className="text-left text-[11px] font-ui uppercase tracking-wider px-3 py-2">Class</th>
                  <th className="text-left text-[11px] font-ui uppercase tracking-wider px-3 py-2">Primary</th>
                  <th className="text-left text-[11px] font-ui uppercase tracking-wider px-3 py-2">Fallback 1</th>
                  <th className="text-left text-[11px] font-ui uppercase tracking-wider px-3 py-2">Fallback 2</th>
                  <th className="text-right text-[11px] font-ui uppercase tracking-wider px-3 py-2">≈ $/1M tokens</th>
                </tr></thead>
                <tbody>
                  {snap.classes.map((c) => {
                    const r = rulesFor(c.slug);
                    const fb = r?.fallback_model_ids ?? [];
                    const save = (primary: string, f1: string | undefined, f2: string | undefined) => act(`rule-${c.slug}`, () => setClassRule(profile.id, c.slug, primary, [f1, f2].filter((x): x is string => !!x && x !== NONE)));
                    const pm = r ? modelById.get(r.model_id) : null;
                    const cost = pm ? blendedPer1M(pm) : null;
                    const warn = readiness(r?.model_id);
                    const sel = (value: string | undefined, onChange: (v: string) => void, allowNone: boolean) => (
                      <Select value={value ?? (allowNone ? NONE : undefined)} onValueChange={onChange} disabled={busy === `rule-${c.slug}`}>
                        <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Choose a model" /></SelectTrigger>
                        <SelectContent>
                          {allowNone && <SelectItem value={NONE}>None</SelectItem>}
                          {usable.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {m.providerName}{m.ready ? "" : m.hasKey ? " (provider off)" : " (no key)"}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    );
                    return (
                      <tr key={c.slug} className="border-t border-border align-top">
                        <td className="px-3 py-2">
                          <p className="font-ui text-[13px] text-foreground">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground max-w-[26ch]">{c.description}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{snap.taskTypes.filter((t) => t.class_slug === c.slug).length} task types</p>
                        </td>
                        <td className="px-3 py-2 min-w-[200px]">{sel(r?.model_id, (v) => save(v, fb[0], fb[1]), false)}{warn && <p className="text-[11px] text-amber-600 mt-1">{warn}</p>}</td>
                        <td className="px-3 py-2 min-w-[200px]">{r ? sel(fb[0], (v) => save(r.model_id, v === NONE ? undefined : v, fb[1]), true) : <span className="text-[11px] text-muted-foreground">set a primary first</span>}</td>
                        <td className="px-3 py-2 min-w-[200px]">{r ? sel(fb[1], (v) => save(r.model_id, fb[0], v === NONE ? undefined : v), true) : null}</td>
                        <td className="px-3 py-2 text-right font-ui text-[12px] tabular-nums">{cost == null ? "—" : `$${cost.toFixed(2)}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Cost is a blended estimate from the model's own rates (3 input tokens per output token). Set rates under Billing → Pricing → Model rates.</p>
          </div>

          {/* ── Task types ── */}
          <div>
            <h3 className="font-ui text-[13px] font-semibold text-foreground">Task types</h3>
            <p className="text-[12px] text-muted-foreground mb-2">Every call names a task type. Move a task between classes, or pin it to one model inside this profile. New task types register themselves on first use.</p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50"><tr>
                  <th className="text-left text-[11px] font-ui uppercase tracking-wider px-3 py-2">Task type</th>
                  <th className="text-left text-[11px] font-ui uppercase tracking-wider px-3 py-2">Class</th>
                  <th className="text-left text-[11px] font-ui uppercase tracking-wider px-3 py-2">Routes to</th>
                  <th className="text-left text-[11px] font-ui uppercase tracking-wider px-3 py-2">Pin in {profile.name}</th>
                </tr></thead>
                <tbody>
                  {snap.classes.flatMap((c) => snap.taskTypes.filter((t) => t.class_slug === c.slug)).concat(snap.taskTypes.filter((t) => !t.class_slug)).map((t) => {
                    const ov = overrideFor(t.task_type);
                    const rule = t.class_slug ? rulesFor(t.class_slug) : undefined;
                    return (
                      <tr key={t.task_type} className="border-t border-border">
                        <td className="px-3 py-2">
                          <p className="font-mono text-[12px] text-foreground">{t.task_type}</p>
                          <p className="text-[11px] text-muted-foreground">{t.description}{t.last_seen_at ? ` · seen ${new Date(t.last_seen_at).toLocaleDateString()}` : ""}</p>
                        </td>
                        <td className="px-3 py-2 w-44">
                          <Select value={t.class_slug ?? undefined} onValueChange={(v) => act(`class-${t.task_type}`, () => setTaskClass(t.task_type, v))}>
                            <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Class" /></SelectTrigger>
                            <SelectContent>{snap.classes.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2 text-[12px] font-ui text-muted-foreground">{ov ? <span className="text-foreground">{modelLabel(ov.model_id)} <span className="text-muted-foreground">(pinned)</span></span> : modelLabel(rule?.model_id)}</td>
                        <td className="px-3 py-2 w-56">
                          <Select value={ov?.model_id ?? NONE} onValueChange={(v) => act(`pin-${t.task_type}`, () => setTaskOverride(profile.id, t.task_type, v === NONE ? null : v))}>
                            <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Follow the class</SelectItem>
                              {usable.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {m.providerName}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New routing profile</DialogTitle><DialogDescription>A complete set of class rules you can switch to at any time.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label htmlFor="rp-name">Name</Label><Input id="rp-name" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value, slug: newForm.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-") })} placeholder="Staging" /></div>
            <div><Label htmlFor="rp-slug">Slug</Label><Input id="rp-slug" value={newForm.slug} onChange={(e) => setNewForm({ ...newForm, slug: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-[12px] text-muted-foreground"><input type="checkbox" checked={newForm.copy} onChange={(e) => setNewForm({ ...newForm, copy: e.target.checked })} /> Start from {profile?.name ?? "the selected profile"}'s rules</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button disabled={busy === "new"} onClick={async () => { const ok = await act("new", async () => { const r = await createProfile({ name: newForm.name, slug: newForm.slug, copyFromProfileId: newForm.copy ? profile?.id : undefined }); if (r.success && r.profile) setSelected(r.profile.id); return r; }, "Profile created"); if (ok) setNewOpen(false); }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
