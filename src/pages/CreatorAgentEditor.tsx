import { useEffect, useState } from "react";
import { FormSkeleton } from "@/components/ui/page-skeleton";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bot, Loader2, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/use-profile";
import { useToast } from "@/hooks/use-toast";
import { FadeIn } from "@/components/FadeIn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createMyAgent, getMyAgent, updateMyAgent, validateAgentInput, STATUS_LABEL, type CreatorAgentInput, type CreatorAgent } from "@/services/creatorAgentService";

const STAGES: { key: string; label: string }[] = [
  { key: "spark", label: "Spark" }, { key: "shape", label: "Shape" }, { key: "validate", label: "Validate" },
  { key: "brand", label: "Brand" }, { key: "launch", label: "Launch" }, { key: "grow", label: "Grow" },
];

const TIERS: { key: CreatorAgentInput["model_tier"]; label: string; blurb: string }[] = [
  { key: "fast", label: "Fast", blurb: "Cheapest. Classification, short rewrites, summaries." },
  { key: "standard", label: "Standard", blurb: "Most copy and briefs. The usual choice." },
  { key: "reasoning", label: "Reasoning", blurb: "Long, careful work. Costs founders the most per run." },
];

const EMPTY: CreatorAgentInput = { name: "", role: "", tagline: "", description: "", system_prompt: "", model_tier: "standard", unit_label: "item", suited_stages: [], per_run_credit_ceiling: 150 };

/**
 * /creator/agents/new and /creator/agents/:id — a creator writes an agent.
 * Founders see the name, tagline and description; the model sees the
 * instructions plus the brand context Kinika adds. Review happens in Admin.
 */
export default function CreatorAgentEditor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<CreatorAgentInput>(EMPTY);
  const [existing, setExisting] = useState<CreatorAgent | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const isCreatorOrAdmin = profile?.role === "creator" || profile?.role === "admin";

  useEffect(() => {
    if (!id) return;
    getMyAgent(id).then((a) => {
      if (a) {
        setExisting(a);
        setForm({ name: a.name, role: a.role, tagline: a.tagline ?? "", description: a.description ?? "", system_prompt: a.system_prompt, model_tier: a.model_tier, unit_label: a.unit_label, suited_stages: a.suited_stages ?? [], per_run_credit_ceiling: a.per_run_credit_ceiling });
      }
      setLoading(false);
    });
  }, [id]);

  if (!isCreatorOrAdmin) return <div className="flex-1 flex items-center justify-center p-8"><p className="text-muted-foreground font-ui text-sm">You don't have access to Creator Studio.</p></div>;
  if (loading) return <FormSkeleton />;

  const set = <K extends keyof CreatorAgentInput>(k: K, v: CreatorAgentInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const problem = validateAgentInput(form);
  const reviewed = existing?.status === "published" || existing?.status === "unpublished";

  const save = async (submit: boolean) => {
    if (!user) return;
    setBusy(submit ? "submit" : "save");
    const r = id ? await updateMyAgent(id, user.id, form, submit) : await createMyAgent(user.id, form, submit);
    setBusy(null);
    if (!r.success) { toast({ title: "Not saved", description: r.error, variant: "destructive" }); return; }
    toast({ title: submit ? "Submitted for review" : "Saved", description: submit ? "An admin will look at it. You'll see the status on Creator Studio." : undefined });
    if (!id && r.agent) navigate(`/creator/agents/${r.agent.id}`, { replace: true });
    else if (r.agent) setExisting(r.agent);
  };

  return (
    <FadeIn>
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
        <button onClick={() => navigate("/creator")} className="inline-flex items-center gap-1.5 text-[12px] font-ui text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Creator Studio</button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl text-foreground flex items-center gap-2"><Bot size={20} className="text-primary" /> {id ? "Edit agent" : "New agent"}</h1>
            <p className="font-ui text-[13px] text-muted-foreground mt-1 max-w-prose">Founders hire your agent onto their team and brief it like any other. Kinika adds their Brand DNA and Mentor history to your instructions on every run, quotes the credits first, and pays you {existing?.revenue_share_pct ?? 30}% of what it earns.</p>
          </div>
          {existing && <Badge variant="outline" className="text-[11px]">{STATUS_LABEL[existing.status]}</Badge>}
        </div>

        {existing?.admin_notes && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 font-ui text-[12px] text-foreground"><span className="text-amber-600 font-medium">From the reviewer:</span> {existing.admin_notes}</div>
        )}
        {reviewed && <p className="font-ui text-[12px] text-muted-foreground">This agent has been reviewed. Changing its name, instructions, tier or description sends it back for review; founders keep the version they hired until it's published again.</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label htmlFor="ag-name" className="text-[12px]">Name</Label><Input id="ag-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Newsletter Writer" className="mt-1" /></div>
          <div><Label htmlFor="ag-role" className="text-[12px]">Role</Label><Input id="ag-role" value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="Email copywriter" className="mt-1" /></div>
        </div>
        <div><Label htmlFor="ag-tagline" className="text-[12px]">Tagline</Label><Input id="ag-tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="Weekly newsletters founders actually send." className="mt-1" maxLength={90} /></div>
        <div><Label htmlFor="ag-desc" className="text-[12px]">What it does (founders read this)</Label><Textarea id="ag-desc" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Turns a brief and the brand's voice into a ready-to-send newsletter: subject lines, preview text, body, one call to action." className="mt-1" /></div>
        <div>
          <Label htmlFor="ag-prompt" className="text-[12px]">Instructions (the model reads this)</Label>
          <Textarea id="ag-prompt" rows={12} value={form.system_prompt} onChange={(e) => set("system_prompt", e.target.value)} placeholder={"You are the Newsletter Writer on a founder's team. You write in the brand voice from the brand context you are given…\n\nReturn ONLY a JSON object: { \"items\": [ { \"title\": \"subject line\", \"body\": \"…\" } ], \"summary\": \"one sentence\" }"} className="mt-1 font-mono text-[12px]" />
          <p className="font-ui text-[11px] text-muted-foreground mt-1">Kinika appends the brand context and asks for JSON with an <code>items</code> list of <code>title</code> and <code>body</code>. Don't ask the model to ignore the brand or to contact anything outside the task; reviewers reject that.</p>
        </div>

        <div>
          <Label className="text-[12px]">Model tier</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
            {TIERS.map((t) => (
              <button key={t.key} type="button" onClick={() => set("model_tier", t.key)} className={`text-left rounded-lg border p-3 ${form.model_tier === t.key ? "border-primary bg-primary/10" : "border-border"}`}>
                <p className="font-ui text-[13px] text-foreground">{t.label}</p>
                <p className="font-ui text-[11px] text-muted-foreground">{t.blurb}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label htmlFor="ag-unit" className="text-[12px]">Unit of work (quoted per unit)</Label><Input id="ag-unit" value={form.unit_label} onChange={(e) => set("unit_label", e.target.value)} placeholder="newsletter" className="mt-1" /></div>
          <div><Label htmlFor="ag-ceiling" className="text-[12px]">Credit ceiling per run (10–300)</Label><Input id="ag-ceiling" type="number" min={10} max={300} value={form.per_run_credit_ceiling} onChange={(e) => set("per_run_credit_ceiling", Number(e.target.value))} className="mt-1" /></div>
        </div>

        <div>
          <Label className="text-[12px]">Journey stages it suits (Mentor recommends it there)</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {STAGES.map((s) => {
              const on = form.suited_stages.includes(s.key);
              return <button key={s.key} type="button" onClick={() => set("suited_stages", on ? form.suited_stages.filter((x) => x !== s.key) : [...form.suited_stages, s.key])} className={`px-2.5 py-1 rounded-full text-[11px] font-ui border ${on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}>{s.label}</button>;
            })}
          </div>
        </div>

        {problem && <p className="font-ui text-[12px] text-amber-600">{problem}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => save(false)} disabled={!!busy || !!problem} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-[12px] font-ui disabled:opacity-50">{busy === "save" ? <Loader2 size={12} className="animate-spin" /> : null} {reviewed ? "Save (goes back to review)" : "Save draft"}</button>
          {!reviewed && (
            <button onClick={() => save(true)} disabled={!!busy || !!problem} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui font-medium disabled:opacity-50">{busy === "submit" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} {existing?.status === "pending_review" ? "Resubmit for review" : "Submit for review"}</button>
          )}
        </div>
      </div>
    </FadeIn>
  );
}
