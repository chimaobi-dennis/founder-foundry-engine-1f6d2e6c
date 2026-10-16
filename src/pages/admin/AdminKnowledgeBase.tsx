import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, ChevronRight, Cpu, History, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ListSkeleton } from "@/components/ui/page-skeleton";
import { cn } from "@/lib/utils";
import { composePrompt, fillVars, PROMPT_REGISTRY, type PromptDef, type PromptExample, type PromptRow } from "@shared/prompts";
import { getAllSystemPrompts, getPromptVersionHistory, getRouteFor, listTaskClasses, restorePromptVersion, savePrompt, setTaskClass } from "@/services/aiService";

/**
 * Every prompt in Kinika, from the registry: the model flow it runs on, the
 * effective text (code default or the admin's override), further instructions
 * and training examples. Saving keeps history. Nothing here is hard-coded
 * elsewhere: the functions compose the same text through composePrompt.
 */

type Row = PromptRow & { id?: string; task_type: string; version?: number; updated_at?: string };
type Route = Awaited<ReturnType<typeof getRouteFor>>;

const GROUPS: PromptDef["group"][] = ["Kinika", "Workspace", "Agents", "Studio"];

export default function AdminKnowledgeBase() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [routes, setRoutes] = useState<Record<string, Route>>({});
  const [classes, setClasses] = useState<{ slug: string; name: string; description: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    const [{ data }, cls] = await Promise.all([getAllSystemPrompts(), listTaskClasses()]);
    const map: Record<string, Row> = {};
    for (const r of (data ?? []) as Row[]) map[r.task_type] = r;
    setRows(map); setClasses(cls);
    const taskTypes = [...new Set(PROMPT_REGISTRY.map((d) => d.taskType))];
    const found = await Promise.all(taskTypes.map(async (t) => [t, await getRouteFor(t)] as const));
    setRoutes(Object.fromEntries(found));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <ListSkeleton cards={4} rows={2} className="max-w-4xl" />;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-[26px] text-foreground mb-1">Prompts</h1>
        <p className="font-ui text-[13px] text-muted-foreground max-w-[70ch] leading-relaxed">
          Every prompt Kinika and the agents run on, with the model it goes to. Each has a code default; you can replace the base text, add instructions that take precedence, and attach examples of good work. Changes apply to the next call. History is kept per prompt.
        </p>
      </div>
      {GROUPS.map((g) => (
        <section key={g} className="mb-8">
          <h2 className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">{g}</h2>
          <div className="flex flex-col gap-2">
            {PROMPT_REGISTRY.filter((d) => d.group === g).map((def) => (
              <PromptCard key={def.key} def={def} row={rows[def.key]} route={routes[def.taskType]} classes={classes} open={open === def.key}
                onToggle={() => setOpen(open === def.key ? null : def.key)} onChanged={load} adminId={user?.id ?? ""} onEditRouting={() => navigate("/admin/product/ai-models")} />
            ))}
          </div>
        </section>
      ))}
      <p className="font-ui text-[12px] text-muted-foreground">Agents' own prompts (Researcher, Copywriter, Legal drafter and the rest) live on each agent: <button onClick={() => navigate("/admin/product/agents")} className="underline">Community agents</button>.</p>
    </div>
  );
}

function ModelFlow({ route, def, classes, onClassChange, onEditRouting }: { route?: Route; def: PromptDef; classes: { slug: string; name: string }[]; onClassChange: (slug: string) => Promise<void>; onEditRouting: () => void }) {
  const [busy, setBusy] = useState(false);
  const chain = route?.candidates ?? [];
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1.5"><Cpu size={11} /> Model flow · task type <code className="font-mono text-[10px] normal-case tracking-normal">{def.taskType}</code>{route?.profile ? ` · profile ${route.profile}` : ""}</span>
        <div className="flex items-center gap-2">
          <label className="font-ui text-[11px] text-muted-foreground">Class</label>
          <select disabled={busy} value={route?.class ?? ""} onChange={async (e) => { setBusy(true); await onClassChange(e.target.value); setBusy(false); }} className="h-7 rounded-md border border-border bg-card px-2 font-ui text-[12px]">
            <option value="">(none)</option>
            {classes.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <button onClick={onEditRouting} className="h-7 px-2.5 rounded-md border border-border bg-card font-ui text-[12px]">Update models</button>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap font-ui text-[12px]">
        {chain.length === 0 && <span className="text-[hsl(var(--brand-needs-you))]">No model is routed for this task type. Set a class, or add a rule under Update models.</span>}
        {chain.map((c, i) => (
          <span key={`${c.model_id}-${i}`} className="inline-flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground">→</span>}
            <span className={cn("px-2 py-0.5 rounded-md border", i === 0 ? "border-[hsl(var(--brand-blue-line))] bg-accent text-accent-foreground font-medium" : "border-border bg-card text-muted-foreground")} title={c.model_id}>{c.model_name} <span className="opacity-70">· {c.provider?.slug}</span></span>
          </span>
        ))}
        {chain.length > 1 && <span className="text-muted-foreground">(primary, then fallbacks)</span>}
      </div>
    </div>
  );
}

function PromptCard({ def, row, route, classes, open, onToggle, onChanged, adminId, onEditRouting }: {
  def: PromptDef; row?: Row; route?: Route; classes: { slug: string; name: string }[]; open: boolean; onToggle: () => void; onChanged: () => Promise<void>; adminId: string; onEditRouting: () => void;
}) {
  const customised = !!(row && (row.system_prompt?.trim() || row.instructions?.trim() || (row.examples ?? []).length));
  const [base, setBase] = useState(row?.system_prompt ?? "");
  const [instructions, setInstructions] = useState(row?.instructions ?? "");
  const [examples, setExamples] = useState<PromptExample[]>(row?.examples ?? []);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showEffective, setShowEffective] = useState(false);
  const [history, setHistory] = useState<{ id: string; version: number; edit_note: string | null; created_at: string }[] | null>(null);
  useEffect(() => { setBase(row?.system_prompt ?? ""); setInstructions(row?.instructions ?? ""); setExamples(row?.examples ?? []); }, [row?.id, row?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const vars = def.variables ?? {};
  const defaultText = useMemo(() => def.defaultText(), [def]);
  const effective = useMemo(() => composePrompt(def, { system_prompt: base, instructions, examples, is_active: true }, vars), [def, base, instructions, examples, vars]);
  const dirty = base !== (row?.system_prompt ?? "") || instructions !== (row?.instructions ?? "") || JSON.stringify(examples) !== JSON.stringify(row?.examples ?? []);

  const save = async () => {
    setSaving(true);
    const r = await savePrompt(def.key, { system_prompt: base.trim() || null, instructions: instructions.trim() || null, examples: examples.filter((e) => e.input?.trim() || e.output?.trim()) }, note.trim(), adminId);
    setSaving(false);
    if (!r.success) { toast.error(r.error ?? "Could not save"); return; }
    toast("Saved; the next call uses it"); setNote(""); await onChanged();
  };
  const loadHistory = async () => { const { data } = await getPromptVersionHistory(def.key as never); setHistory(data ?? []); };

  return (
    <div className="rounded-xl border border-border bg-card">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        {open ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-ui text-[14px] font-semibold">{def.name}</span>
            <span className={cn("font-ui text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded", customised ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{customised ? `customised · v${row?.version ?? 1}` : "code default"}</span>
            {(row?.examples ?? []).length > 0 && <span className="font-ui text-[10px] text-muted-foreground">{(row?.examples ?? []).length} example{(row?.examples ?? []).length === 1 ? "" : "s"}</span>}
          </div>
          <p className="font-ui text-[12px] text-muted-foreground mt-0.5">{def.description}</p>
        </div>
        <span className="hidden md:inline font-ui text-[11px] text-muted-foreground shrink-0">{route?.candidates?.[0]?.model_name ?? "no model"}{route?.class ? ` · ${route.class}` : ""}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-border pt-4">
          <p className="font-ui text-[12px] text-muted-foreground">Used by: {def.usedBy}</p>
          <ModelFlow route={route} def={def} classes={classes} onEditRouting={onEditRouting} onClassChange={async (slug) => { if (!slug) return; if (await setTaskClass(def.taskType, slug)) { toast("Class updated"); await onChanged(); } else toast.error("Could not update the class"); }} />

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-ui text-[12px] font-medium">Base prompt {base.trim() ? "(your override)" : "(code default shown; edit to override)"}</label>
              {base.trim() && <button onClick={() => setBase("")} className="font-ui text-[11px] underline inline-flex items-center gap-1"><RotateCcw size={11} /> Back to the code default</button>}
            </div>
            <Textarea value={base.trim() ? base : defaultText} onChange={(e) => setBase(e.target.value === defaultText ? "" : e.target.value)} rows={Math.min(18, Math.max(6, (base || defaultText).split("\n").length + 1))} className="font-mono text-[12px] leading-relaxed" />
            {Object.keys(vars).length > 0 && <p className="font-ui text-[11px] text-muted-foreground">Placeholders filled at run time: {Object.keys(vars).map((k) => `{{${k}}}`).join(", ")}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-ui text-[12px] font-medium">Further instructions <span className="font-normal text-muted-foreground">(appended; take precedence over the base)</span></label>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} placeholder="Always answer in the founder's language. Never suggest paid ads for a business under six months old." className="text-[13px]" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="font-ui text-[12px] font-medium">Training examples <span className="font-normal text-muted-foreground">(input → the output you want; up to 8 are sent)</span></label>
              <button onClick={() => setExamples((x) => [...x, { input: "", output: "", note: "" }])} className="font-ui text-[12px] inline-flex items-center gap-1"><Plus size={12} /> Add example</button>
            </div>
            {examples.length === 0 && <p className="font-ui text-[12px] text-muted-foreground">None yet. A good example is a real input and the answer you would have wanted.</p>}
            {examples.map((ex, i) => (
              <div key={i} className="rounded-lg border border-border p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input value={ex.note ?? ""} onChange={(e) => setExamples((x) => x.map((y, j) => j === i ? { ...y, note: e.target.value } : y))} placeholder="Short note: what this example teaches" className="h-8 text-[12px]" />
                  <button onClick={() => setExamples((x) => x.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive" aria-label="Remove example"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Textarea value={ex.input} onChange={(e) => setExamples((x) => x.map((y, j) => j === i ? { ...y, input: e.target.value } : y))} rows={5} placeholder="Input" className="font-mono text-[12px]" />
                  <Textarea value={ex.output} onChange={(e) => setExamples((x) => x.map((y, j) => j === i ? { ...y, output: e.target.value } : y))} rows={5} placeholder="The output you want" className="font-mono text-[12px]" />
                </div>
              </div>
            ))}
          </div>

          {def.contract && (
            <div className="flex flex-col gap-1.5">
              <label className="font-ui text-[12px] font-medium">Contract <span className="font-normal text-muted-foreground">(fixed; the code that reads the answer depends on it)</span></label>
              <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">{def.contract}</pre>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <button onClick={() => setShowEffective((v) => !v)} className="self-start font-ui text-[12px] underline">{showEffective ? "Hide" : "Show"} the exact text the model receives (sample values)</button>
            {showEffective && <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed max-h-[420px] overflow-y-auto">{fillVars(effective, vars)}</pre>}
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed and why (kept in history)" className="h-9 text-[12px] max-w-sm" />
            <Button disabled={!dirty || saving} onClick={save} className="h-9">{saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save prompt</Button>
            <Button variant="outline" onClick={loadHistory} className="h-9"><History size={13} /> History</Button>
            {row?.updated_at && <span className="font-ui text-[11px] text-muted-foreground">Last saved {new Date(row.updated_at).toLocaleString()}</span>}
          </div>
          {history && (
            <div className="rounded-lg border border-border p-3 flex flex-col gap-1.5">
              <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">History</span>
              {history.length === 0 && <span className="font-ui text-[12px] text-muted-foreground">No earlier versions.</span>}
              {history.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 font-ui text-[12px]">
                  <span>v{v.version} · {new Date(v.created_at).toLocaleString()} · {v.edit_note ?? ""}</span>
                  <button onClick={async () => { const r = await restorePromptVersion(v.id, adminId); if (r.success) { toast("Restored"); setHistory(null); await onChanged(); } else toast.error(r.error ?? "Could not restore"); }} className="underline">Restore</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
