import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, Loader2, Plus, Trash2, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AIModel, AIProvider } from "@/services/aiService";
import { listModelRates, type ModelRateRow } from "@/services/billingAdminService";
import { activateProfile, addTaskType, blendedPer1M, createProfile, deleteProfile, deleteTaskType, getRoutingSnapshot, setClassRule, setTaskClass, setTaskRoute, type RoutingSnapshot } from "@/services/modelRoutingService";

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
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ taskType: "", classSlug: "writing", description: "" });
  const [adding, setAdding] = useState<string | null>(null);
  const [rates, setRates] = useState<ModelRateRow[]>([]);

  const load = async () => {
    const [s, r] = await Promise.all([getRoutingSnapshot(), listModelRates()]);
    setSnap(s);
    setRates(r.filter((x) => x.is_active));
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
  // Blended $/1M: the model_rates row when there is one, else the model's own per-1k fields.
  const costOf = (m: { providerSlug: string; model_id: string; cost_per_1k_input: number | null; cost_per_1k_output: number | null } | null | undefined) => {
    if (!m) return null;
    const rate = rates.find((r) => r.provider_slug === m.providerSlug && r.model_id === m.model_id);
    if (rate) return (Number(rate.input_per_1m) * 3 + Number(rate.output_per_1m)) / 4;
    return blendedPer1M(m);
  };

  if (!snap) return <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-[#8A96A3]" size={18} /></div>;
  const profile = snap.profiles.find((p) => p.id === selected) ?? null;
  const rulesFor = (classSlug: string) => snap.rules.find((r) => r.profile_id === profile?.id && r.class_slug === classSlug);
  const routeFor = (t: string) => snap.routes.find((o) => o.profile_id === profile?.id && o.task_type === t);

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
            <h3 className="font-ui text-[13px] font-semibold text-[#F5F0E6]">Routing profiles</h3>
            <p className="text-[12px] text-[#8A96A3]">A profile maps every class of work to a model. Activate one to move every AI call at once, for example open models in development and proprietary ones in production.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setNewForm({ name: "", slug: "", copy: true }); setNewOpen(true); }}><Plus size={14} className="mr-1" /> New profile</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {snap.profiles.map((p) => {
            const rules = snap.rules.filter((r) => r.profile_id === p.id);
            const unready = snap.classes.filter((c) => { const r = rules.find((x) => x.class_slug === c.slug); return !r || !modelById.get(r.model_id)?.ready; }).map((c) => c.name);
            return (
              <div key={p.id} onClick={() => setSelected(p.id)} className={`rounded-lg border p-3 cursor-pointer ${selected === p.id ? "border-[#D4A017] bg-[#D4A017]/10" : "border-[#1A2A3A]"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-ui text-[13px] font-medium text-[#F5F0E6]">{p.name}</p>
                  {p.is_active ? <span className="inline-flex items-center gap-1 text-[11px] text-[#4ADE80]"><Check size={12} /> active</span> : (
                    <Button size="sm" variant="outline" disabled={busy === `activate-${p.id}` || unready.length > 0} title={unready.length ? `Not ready: ${unready.join(", ")}` : undefined} onClick={(e) => { e.stopPropagation(); act(`activate-${p.id}`, () => activateProfile(p.id), `${p.name} is now live for every AI call`); }}>
                      {busy === `activate-${p.id}` ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} className="mr-1" />} Activate
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-[#8A96A3] mt-1">{p.description}</p>
                {unready.length > 0 && <p className="text-[11px] text-[#D4A017] mt-1">Not ready: {unready.join(", ")} need a model whose provider is enabled and has a key.</p>}
                {!p.is_active && (
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete profile "${p.name}"?`)) act(`del-${p.id}`, () => deleteProfile(p.id), "Profile deleted").then((ok) => { if (ok && selected === p.id) setSelected(null); }); }} className="mt-2 text-[11px] text-[#8A96A3] hover:text-destructive inline-flex items-center gap-1"><Trash2 size={11} /> delete</button>
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
            <h3 className="font-ui text-[13px] font-semibold text-[#F5F0E6]">Classes of work · {profile.name}{profile.is_active ? "" : " (not active)"}</h3>
            <p className="text-[12px] text-[#8A96A3] mb-2">The default list for every task type in a class that has no models of its own. The gateway retries a provider once on rate limits or outages, then moves to the next fallback. Changes apply to the next call.</p>
            <div className="border border-[#1A2A3A] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#0D1520]"><tr>
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
                    const cost = costOf(pm);
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
                      <tr key={c.slug} className="border-t border-[#1A2A3A] align-top">
                        <td className="px-3 py-2">
                          <p className="font-ui text-[13px] text-[#F5F0E6]">{c.name}</p>
                          <p className="text-[11px] text-[#8A96A3] max-w-[26ch]">{c.description}</p>
                          <p className="text-[10px] text-[#8A96A3] mt-1">{snap.taskTypes.filter((t) => t.class_slug === c.slug).length} task types</p>
                        </td>
                        <td className="px-3 py-2 min-w-[200px]">{sel(r?.model_id, (v) => save(v, fb[0], fb[1]), false)}{warn && <p className="text-[11px] text-[#D4A017] mt-1">{warn}</p>}</td>
                        <td className="px-3 py-2 min-w-[200px]">{r ? sel(fb[0], (v) => save(r.model_id, v === NONE ? undefined : v, fb[1]), true) : <span className="text-[11px] text-[#8A96A3]">set a primary first</span>}</td>
                        <td className="px-3 py-2 min-w-[200px]">{r ? sel(fb[1], (v) => save(r.model_id, fb[0], v === NONE ? undefined : v), true) : null}</td>
                        <td className="px-3 py-2 text-right font-ui text-[12px] tabular-nums">{cost == null || cost === 0 ? <span className="text-[#D4A017]" title="No rate on file: add one under Billing → Pricing → Model rates">no rate</span> : `$${cost.toFixed(2)}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-[#8A96A3] mt-1">Cost is a blended estimate from the model's own rates (3 input tokens per output token). Set rates under Billing → Pricing → Model rates.</p>
          </div>

          {/* ── Task types ── */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <h3 className="font-ui text-[13px] font-semibold text-[#F5F0E6]">Task types · {profile.name}</h3>
                <p className="text-[12px] text-[#8A96A3]">Every call names a task type. Give a task its own models here, in the order to try them; a task with none follows its class. Add your own task types and call the gateway with that name.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setTaskForm({ taskType: "", classSlug: "writing", description: "" }); setTaskOpen(true); }}><Plus size={14} className="mr-1" /> New task type</Button>
            </div>
            <div className="border border-[#1A2A3A] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#0D1520]"><tr>
                  <th className="text-left text-[11px] font-ui uppercase tracking-wider px-3 py-2">Task type</th>
                  <th className="text-left text-[11px] font-ui uppercase tracking-wider px-3 py-2">Class</th>
                  <th className="text-left text-[11px] font-ui uppercase tracking-wider px-3 py-2">Models, in order</th>
                </tr></thead>
                <tbody>
                  {snap.classes.flatMap((c) => snap.taskTypes.filter((t) => t.class_slug === c.slug)).concat(snap.taskTypes.filter((t) => !t.class_slug)).map((t) => {
                    const route = routeFor(t.task_type);
                    const ids = route?.model_ids ?? [];
                    const rule = t.class_slug ? rulesFor(t.class_slug) : undefined;
                    const key = `route-${t.task_type}`;
                    const save = (next: string[]) => act(key, () => setTaskRoute(profile.id, t.task_type, next));
                    return (
                      <tr key={t.task_type} className="border-t border-[#1A2A3A] align-top">
                        <td className="px-3 py-2">
                          <p className="font-mono text-[12px] text-[#F5F0E6]">{t.task_type}</p>
                          <p className="text-[11px] text-[#8A96A3]">{t.description}{t.last_seen_at ? ` · seen ${new Date(t.last_seen_at).toLocaleDateString()}` : ""}</p>
                          {!t.is_system && <button onClick={() => { if (confirm(`Remove task type "${t.task_type}"? Calls using it will fall back to system_ai.`)) act(`del-${t.task_type}`, () => deleteTaskType(t.task_type), "Task type removed"); }} className="mt-1 text-[11px] text-[#8A96A3] hover:text-destructive inline-flex items-center gap-1"><Trash2 size={11} /> remove</button>}
                        </td>
                        <td className="px-3 py-2 w-40">
                          <Select value={t.class_slug ?? undefined} onValueChange={(v) => act(`class-${t.task_type}`, () => setTaskClass(t.task_type, v))}>
                            <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Class" /></SelectTrigger>
                            <SelectContent>{snap.classes.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          {ids.length === 0 ? (
                            <p className="text-[12px] font-ui text-[#8A96A3] mb-1">Follows the {snap.classes.find((c) => c.slug === t.class_slug)?.name ?? "class"} list: {modelLabel(rule?.model_id)}{(rule?.fallback_model_ids?.length ?? 0) > 0 ? ` → ${rule!.fallback_model_ids.map((id) => modelLabel(id)).join(" → ")}` : ""}</p>
                          ) : (
                            <ol className="space-y-1 mb-1">
                              {ids.map((id, i) => {
                                const warn = readiness(id);
                                return (
                                  <li key={id} className="flex items-center gap-2 text-[12px] font-ui">
                                    <span className="w-4 text-[#8A96A3]">{i + 1}.</span>
                                    <span className="text-[#F5F0E6]">{modelLabel(id)}</span>
                                    {warn && <span className="text-[#D4A017] text-[11px]">({warn})</span>}
                                    <span className="ml-auto inline-flex items-center gap-1">
                                      <button disabled={i === 0 || busy === key} onClick={() => { const n = [...ids]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; save(n); }} className="text-[#8A96A3] hover:text-[#F5F0E6] disabled:opacity-30" aria-label="Move up"><ArrowUp size={12} /></button>
                                      <button disabled={i === ids.length - 1 || busy === key} onClick={() => { const n = [...ids]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; save(n); }} className="text-[#8A96A3] hover:text-[#F5F0E6] disabled:opacity-30" aria-label="Move down"><ArrowDown size={12} /></button>
                                      <button disabled={busy === key} onClick={() => save(ids.filter((x) => x !== id))} className="text-[#8A96A3] hover:text-destructive" aria-label="Remove"><X size={12} /></button>
                                    </span>
                                  </li>
                                );
                              })}
                            </ol>
                          )}
                          <div className="flex items-center gap-2">
                            <Select value={adding === t.task_type ? undefined : ""} onValueChange={(v) => { setAdding(null); if (v && !ids.includes(v)) save([...ids, v]); }}>
                              <SelectTrigger className="h-8 text-[12px] w-72"><SelectValue placeholder={ids.length ? "Add a fallback…" : "Add a model for this task…"} /></SelectTrigger>
                              <SelectContent>
                                {usable.filter((m) => !ids.includes(m.id)).map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {m.providerName}{m.ready ? "" : m.hasKey ? " (provider off)" : " (no key)"}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {ids.length > 0 && <button onClick={() => save([])} className="text-[11px] text-[#8A96A3] hover:text-[#F5F0E6] underline">follow the class instead</button>}
                          </div>
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

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New task type</DialogTitle><DialogDescription>Code calls the gateway with this name as its taskType. It starts by following its class; give it its own models above.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label htmlFor="tt-name">Name</Label><Input id="tt-name" value={taskForm.taskType} onChange={(e) => setTaskForm({ ...taskForm, taskType: e.target.value })} placeholder="email_subject_lines" /><p className="text-[11px] text-[#8A96A3] mt-1">Lowercase letters, digits and underscores.</p></div>
            <div><Label htmlFor="tt-class">Class</Label>
              <Select value={taskForm.classSlug} onValueChange={(v) => setTaskForm({ ...taskForm, classSlug: v })}><SelectTrigger id="tt-class" className="h-9"><SelectValue /></SelectTrigger><SelectContent>{snap.classes.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label htmlFor="tt-desc">What it is for</Label><Input id="tt-desc" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Subject lines for the newsletter agent" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>Cancel</Button>
            <Button disabled={busy === "task"} onClick={async () => { const ok = await act("task", () => addTaskType(taskForm), "Task type added"); if (ok) setTaskOpen(false); }}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New routing profile</DialogTitle><DialogDescription>A complete set of class rules you can switch to at any time.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label htmlFor="rp-name">Name</Label><Input id="rp-name" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value, slug: newForm.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-") })} placeholder="Staging" /></div>
            <div><Label htmlFor="rp-slug">Slug</Label><Input id="rp-slug" value={newForm.slug} onChange={(e) => setNewForm({ ...newForm, slug: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-[12px] text-[#8A96A3]"><input type="checkbox" checked={newForm.copy} onChange={(e) => setNewForm({ ...newForm, copy: e.target.checked })} /> Start from {profile?.name ?? "the selected profile"}'s rules</label>
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
