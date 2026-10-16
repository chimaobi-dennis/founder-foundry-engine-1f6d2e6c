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
import { listAgents, type Agent } from "@/services/agentService";
import { supabase } from "@/integrations/supabase/client";
import { getAllSystemPrompts, getPromptVersionHistory, getRouteFor, listTaskClasses, restorePromptVersion, savePrompt, setTaskClass } from "@/services/aiService";

/**
 * Every prompt in Kinika, from the registry: the model flow it runs on, the
 * text the model receives, further instructions and training examples.
 * The code keeps no prompt text: a prompt that is not set here fails with a
 * clear error, and the agents' own prompts are edited here too.
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
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    const [{ data }, cls, ag] = await Promise.all([getAllSystemPrompts(), listTaskClasses(), listAgents()]);
    setAgents(ag);
    const map: Record<string, Row> = {};
    for (const r of (data ?? []) as Row[]) map[r.task_type] = r;
    setRows(map); setClasses(cls);
    const taskTypes = [...new Set([...PROMPT_REGISTRY.map((d) => d.taskType), ...ag.map((a) => `agent_${a.slug}`)])];
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
          Every prompt Kinika and the agents run on, with the model it goes to. Nothing is kept in code: what you see here is exactly what the model receives. Edit the text, add instructions that take precedence, attach examples of good work. A prompt that is not set stops its feature with a clear error. Changes apply to the next call; history is kept per prompt.
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
      <section className="mb-8">
        <h2 className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Agents' own prompts</h2>
        <div className="flex flex-col gap-2">
          {agents.map((a) => (
            <AgentPromptCard key={a.id} agent={a} route={routes[`agent_${a.slug}`]} open={open === `agent:${a.slug}`} onToggle={() => setOpen(open === `agent:${a.slug}` ? null : `agent:${a.slug}`)} onChanged={load} onEditRouting={() => navigate("/admin/product/ai-models")} />
          ))}
        </div>
        <p className="font-ui text-[12px] text-muted-foreground mt-2">Pricing, output shape and the rest of an agent's definition: <button onClick={() => navigate("/admin/product/agents")} className="underline">Community agents</button>.</p>
      </section>
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
  const isSet = !!row?.system_prompt?.trim();
  const customised = !!(row && ((row.version ?? 1) > 1 || row.instructions?.trim() || (row.examples ?? []).length));
  const [base, setBase] = useState(row?.system_prompt ?? "");
  const [instructions, setInstructions] = useState(row?.instructions ?? "");
  const [examples, setExamples] = useState<PromptExample[]>(row?.examples ?? []);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showEffective, setShowEffective] = useState(false);
  const [history, setHistory] = useState<{ id: string; version: number; edit_note: string | null; created_at: string }[] | null>(null);
  useEffect(() => { setBase(row?.system_prompt ?? ""); setInstructions(row?.instructions ?? ""); setExamples(row?.examples ?? []); }, [row?.id, row?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const vars = def.variables ?? {};
  const effective = useMemo(() => { try { return composePrompt(def, { system_prompt: base, instructions, examples, is_active: true }, vars); } catch { return ""; } }, [def, base, instructions, examples, vars]);
  const dirty = base !== (row?.system_prompt ?? "") || instructions !== (row?.instructions ?? "") || JSON.stringify(examples) !== JSON.stringify(row?.examples ?? []);

  const save = async () => {
    setSaving(true);
    if (!base.trim()) { toast.error("The prompt text cannot be empty."); setSaving(false); return; }
    const r = await savePrompt(def.key, { system_prompt: base.trim(), instructions: instructions.trim() || null, examples: examples.filter((e) => e.input?.trim() || e.output?.trim()) }, note.trim(), adminId);
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
            <span className={cn("font-ui text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded", !isSet ? "bg-[hsl(var(--brand-needs-you-soft))] text-[hsl(var(--brand-needs-you))]" : customised ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{!isSet ? "not set" : `v${row?.version ?? 1}`}</span>
            {def.fixed && <span className="font-ui text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title="Code that reads the answer depends on this text's shape">contract</span>}
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

          {!isSet && <p className="font-ui text-[12px] text-[hsl(var(--brand-needs-you))]">This prompt is not set. Its feature fails with "Prompt is not set" until you save text here.</p>}
          {def.fixed && <p className="font-ui text-[12px] text-muted-foreground">The code that reads the model's answer depends on the shape this text asks for. Change wording freely; keep the shape.</p>}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-ui text-[12px] font-medium">Prompt text</label>
              {dirty && <button onClick={() => { setBase(row?.system_prompt ?? ""); setInstructions(row?.instructions ?? ""); setExamples(row?.examples ?? []); }} className="font-ui text-[11px] underline inline-flex items-center gap-1"><RotateCcw size={11} /> Discard changes</button>}
            </div>
            <Textarea value={base} onChange={(e) => setBase(e.target.value)} rows={Math.min(18, Math.max(6, base.split("\n").length + 1))} placeholder="What the model is told" className="font-mono text-[12px] leading-relaxed" />
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

          <div className="flex flex-col gap-1.5">
            <button onClick={() => setShowEffective((v) => !v)} className="self-start font-ui text-[12px] underline">{showEffective ? "Hide" : "Show"} the exact text the model receives (sample values)</button>
            {showEffective && <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed max-h-[420px] overflow-y-auto">{effective ? fillVars(effective, vars) : "(nothing: the prompt text is empty)"}</pre>}
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

/** An agent's own system prompt, edited in place on the agents table. Its model flow is the agent_<slug> task type. */
function AgentPromptCard({ agent, route, open, onToggle, onChanged, onEditRouting }: { agent: Agent; route?: Route; open: boolean; onToggle: () => void; onChanged: () => Promise<void>; onEditRouting: () => void }) {
  const [text, setText] = useState(agent.system_prompt ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setText(agent.system_prompt ?? ""); }, [agent.system_prompt]);
  const dirty = text !== (agent.system_prompt ?? "");
  const save = async () => {
    if (!text.trim()) { toast.error("An agent needs a prompt."); return; }
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("agents").update({ system_prompt: text.trim(), updated_at: new Date().toISOString() }).eq("id", agent.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast(`${agent.name} updated; the next run uses it`); await onChanged();
  };
  const chain = route?.candidates ?? [];
  return (
    <div className="rounded-xl border border-border bg-card">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        {open ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap"><span className="font-ui text-[14px] font-semibold">{agent.name}</span><span className="font-ui text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">agent · {agent.action_type}</span></div>
          <p className="font-ui text-[12px] text-muted-foreground mt-0.5">{agent.tagline ?? ""}</p>
        </div>
        <span className="hidden md:inline font-ui text-[11px] text-muted-foreground shrink-0">{chain[0]?.model_name ?? "no model"}{route?.class ? ` · ${route.class}` : ""}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-border pt-4">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1.5"><Cpu size={11} /> Model flow · task type <code className="font-mono text-[10px] normal-case tracking-normal">agent_{agent.slug}</code> · tier {agent.model_tier}</span>
              <button onClick={onEditRouting} className="h-7 px-2.5 rounded-md border border-border bg-card font-ui text-[12px]">Update models</button>
            </div>
            <div className="flex items-center gap-2 flex-wrap font-ui text-[12px]">
              {chain.length === 0 && <span className="text-[hsl(var(--brand-needs-you))]">No model is routed for this agent yet; it resolves by tier at run time.</span>}
              {chain.map((c, i) => (<span key={`${c.model_id}-${i}`} className="inline-flex items-center gap-2">{i > 0 && <span className="text-muted-foreground">→</span>}<span className={cn("px-2 py-0.5 rounded-md border", i === 0 ? "border-[hsl(var(--brand-blue-line))] bg-accent text-accent-foreground font-medium" : "border-border bg-card text-muted-foreground")}>{c.model_name} <span className="opacity-70">· {c.provider?.slug}</span></span></span>))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-ui text-[12px] font-medium">System prompt <span className="font-normal text-muted-foreground">(the brand context is appended at run time)</span></label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(22, Math.max(8, text.split("\n").length + 1))} className="font-mono text-[12px] leading-relaxed" />
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Button disabled={!dirty || saving} onClick={save} className="h-9">{saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save prompt</Button>
            {dirty && <button onClick={() => setText(agent.system_prompt ?? "")} className="font-ui text-[12px] underline">Discard changes</button>}
          </div>
        </div>
      )}
    </div>
  );
}
