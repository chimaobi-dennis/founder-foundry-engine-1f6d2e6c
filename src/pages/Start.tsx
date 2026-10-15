import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useBrand } from "@/hooks/use-brand";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { grantFreeTrialCredits } from "@/services/billingAdminService";
import { buildPlan } from "@/services/planService";
import { approveUnderstanding, draftUnderstanding, readTextFile, type BusinessKind, type Readback } from "@/services/understandingService";

/**
 * /start — the first run. Understanding comes before anything else:
 *   1 Tell Kinika about your business
 *   2 Give Kinika what it will read (or 2b: a loose goal, when just starting)
 *   3 Your business, as Kinika understands it (approve, edit, add more)
 *   4 What do you want to achieve? → Kinika writes the plan
 * Nothing else in Kinika is offered until step 3 is approved.
 */

type Step = 1 | 2 | 3 | 4;

const KINDS: Array<{ value: BusinessKind; label: string; hint: string }> = [
  { value: "starting", label: "Thinking of starting something", hint: "An idea, or not even that yet" },
  { value: "running", label: "Already running a business", hint: "A shop, a service, a product, a practice" },
  { value: "creator", label: "Creating content and an audience", hint: "Instagram, TikTok, YouTube, newsletter" },
  { value: "other", label: "Something else", hint: "Say it in your own words below" },
];

const HORIZONS = ["About 3 months", "This year", "No deadline"];
const DRAFT_KEY = "kinika.start.draft";

const CONF_STYLE: Record<string, string> = {
  sure: "bg-[hsl(var(--brand-good-soft))] text-[hsl(var(--brand-good))]",
  fairly_sure: "bg-[hsl(var(--brand-needs-you-soft))] text-[hsl(var(--brand-needs-you))]",
  guess: "bg-muted text-muted-foreground",
};
const CONF_LABEL: Record<string, string> = { sure: "sure", fairly_sure: "fairly sure", guess: "a guess, say if wrong" };

export default function Start() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { brands, activeBrand, switchBrand, createNewBrand, refreshBrands, isLoading: brandsLoading } = useBrand();
  const { refetch: refetchProfile } = useProfile();

  const [step, setStep] = useState<Step>(1);
  const [brandId, setBrandId] = useState<string | null>(params.get("brand"));
  const [kind, setKind] = useState<BusinessKind>("running");
  const [text, setText] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [chatUrl, setChatUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [documents, setDocuments] = useState<Array<{ name: string; text: string }>>([]);
  const [readback, setReadback] = useState<Readback | null>(null);
  const [sourcesRead, setSourcesRead] = useState<{ site: boolean; chat: boolean; documents: number } | null>(null);
  const [goal, setGoal] = useState("");
  const [ownGoal, setOwnGoal] = useState("");
  const [horizon, setHorizon] = useState(HORIZONS[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const firstSectionRef = useRef<HTMLTextAreaElement | null>(null);

  // The draft survives a refresh until the brand is understood.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.kind) setKind(d.kind);
        if (d.text) setText(d.text);
        if (d.websiteUrl) setWebsiteUrl(d.websiteUrl);
      }
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ kind, text, websiteUrl })); } catch { /* storage unavailable */ }
  }, [kind, text, websiteUrl]);

  // Which brand this run is for: the one in the URL, else the active one if it is not yet understood, else a new one.
  useEffect(() => {
    if (brandsLoading || brandId) return;
    if (params.get("new") !== "1") {
      const candidate = activeBrand ?? brands[0];
      if (candidate && !(candidate as { understanding_approved_at?: string | null }).understanding_approved_at) { setBrandId(candidate.id); return; }
      if (candidate && params.get("review") === "1") { setBrandId(candidate.id); return; }
    }
    // created on first Continue, so an abandoned visit leaves nothing behind
  }, [brandsLoading, brandId, activeBrand, brands, params]);

  const canContinue = text.trim().length >= 20;
  const isStarting = kind === "starting";

  const ensureBrand = async (): Promise<string | null> => {
    if (brandId) return brandId;
    const name = params.get("name") || "Untitled Project";
    const b = await createNewBrand(name);
    if (!b) { toast.error("Could not create your workspace. Try again."); return null; }
    setBrandId(b.id);
    await switchBrand(b.id);
    return b.id;
  };

  const draft = async () => {
    setBusy("draft");
    const id = await ensureBrand();
    if (!id) { setBusy(null); return; }
    const r = await draftUnderstanding(id, { text: text.trim(), kind, websiteUrl: websiteUrl.trim() || undefined, chatUrl: chatUrl.trim() || undefined, pasted: pasted.trim() || undefined, documents: documents.map((d) => d.text) });
    setBusy(null);
    if (!r.success) { toast.error(r.error); return; }
    setReadback(r.readback);
    setSourcesRead(r.sourcesRead);
    setGoal(r.readback.goals[0] ?? "");
    setStep(3);
  };

  const approve = async () => {
    if (!readback || !brandId) return;
    const chosen = (ownGoal.trim() || goal).trim();
    setBusy("approve");
    const r = await approveUnderstanding(brandId, readback, chosen || undefined, chosen ? horizon : undefined, { site: !!sourcesRead?.site, chat: !!sourcesRead?.chat, documents: sourcesRead?.documents ?? 0, pasted: !!pasted.trim() });
    if (!r.success) { setBusy(null); toast.error(r.error); return; }
    // The profile's own onboarding is this flow now; trial credits are granted once.
    if (user) {
      await supabase.from("profiles").update({ onboarding_completed: true, brand_status: kind === "starting" ? "have_idea" : "in_progress", updated_at: new Date().toISOString() }).eq("id", user.id);
      await grantFreeTrialCredits(user.id).catch(() => null);
    }
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* storage unavailable */ }
    // The plan is written while the founder watches the building screen; the
    // profile and brand list refresh afterwards, right before the plan opens.
    setBusy("plan");
    const p = await buildPlan(brandId, undefined, "auto");
    if (!p.success) toast.error(p.error ?? "Kinika could not write the plan yet; you can from the plan page.");
    await Promise.all([refetchProfile(), refreshBrands()]);
    navigate("/plan", { replace: true });
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: Array<{ name: string; text: string }> = [];
    for (const f of Array.from(files).slice(0, 5)) {
      const t = await readTextFile(f);
      if (t) next.push({ name: f.name, text: t });
      else toast(`${f.name}: only text, Markdown, CSV and JSON are read here for now.`);
    }
    setDocuments((d) => [...d, ...next].slice(0, 5));
  };

  const updateSection = (key: string, value: string) => {
    setReadback((rb) => rb ? { ...rb, sections: rb.sections.map((s) => s.key === key ? { ...s, value } : s) } : rb);
  };

  const steps = useMemo(() => [
    { n: 1 as Step, label: "Your business" },
    { n: 2 as Step, label: isStarting ? "Getting started" : "What Kinika will read" },
    { n: 3 as Step, label: "What Kinika understood" },
    { n: 4 as Step, label: "Your goal" },
  ], [isStarting]);

  const Stepper = () => (
    <nav aria-label="Steps" className="flex items-center justify-center gap-1.5 flex-wrap px-6 pt-4">
      {steps.map((s, i) => {
        const cur = s.n === step;
        const reachable = s.n < step || (s.n === 2 && canContinue) || (s.n >= 3 && !!readback);
        return (
          <span key={s.n} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="w-6 h-px bg-border" />}
            <button type="button" disabled={!reachable && !cur} onClick={() => reachable && setStep(s.n)} aria-current={cur ? "step" : undefined}
              className={cn("inline-flex items-center gap-2 h-9 px-3 rounded-lg font-ui text-[13px] border", cur ? "bg-accent border-[hsl(var(--brand-blue-line))] text-accent-foreground font-medium" : "border-transparent text-muted-foreground disabled:opacity-60")}>
              <span className={cn("w-5 h-5 rounded-full inline-flex items-center justify-center text-[11px] font-semibold", cur ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground")}>{s.n}</span>
              {s.label}
            </button>
          </span>
        );
      })}
    </nav>
  );

  const Back = ({ to }: { to: Step | "signin" }) => (
    <button type="button" onClick={() => to === "signin" ? navigate(-1) : setStep(to)} className="inline-flex items-center gap-2 h-12 px-4 rounded-xl border border-border bg-card font-ui text-[14px] text-foreground">
      <ArrowLeft size={16} /> Back
    </button>
  );

  return (
    <div className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-background text-foreground flex flex-col" style={{ WebkitOverflowScrolling: "touch" }}>
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-border">
        <span className="font-display text-[22px]">Kinika</span>
        <span className="font-ui text-[12px] tracking-[0.18em] uppercase text-muted-foreground">{busy === "plan" ? "Writing your plan" : <>Getting to know your business · {Math.min(step, 3)} of 3</>}</span>
      </header>
      {busy !== "plan" && <Stepper />}

      <main className="flex-1 flex justify-center px-4 md:px-6 py-10 md:py-14">
        {/* ── Kinika is writing the plan ── */}
        {busy === "plan" && (
          <div className="w-full max-w-[560px] flex flex-col gap-6 self-center" role="status" aria-live="polite">
            <span className="inline-flex items-center gap-2 font-ui text-[12px] tracking-[0.18em] uppercase text-[hsl(var(--brand-good))]"><Check size={14} /> Kinika knows your business</span>
            <h1 className="font-display text-[32px] md:text-[38px] leading-[1.1] inline-flex items-center gap-3"><Loader2 size={26} className="animate-spin text-primary shrink-0" /> Kinika is writing your plan</h1>
            <p className="font-ui text-[15px] leading-relaxed text-muted-foreground max-w-[52ch]">{(ownGoal.trim() || goal) ? <>Towards: <strong className="text-foreground font-medium">{ownGoal.trim() || goal}</strong>, {horizon.toLowerCase()}.</> : "Based on what Kinika understood."} This takes about half a minute.</p>
            <ol className="flex flex-col gap-2.5 font-ui text-[14px] text-muted-foreground">
              {["Two to five targets you can check off", "The tasks under each, and which an agent could do", "The roles Kinika would hire for them"].map((t, i) => (
                <li key={t} className="flex items-center gap-3"><span className="w-6 h-6 rounded-full border border-border inline-flex items-center justify-center text-[11px] font-semibold text-foreground shrink-0">{i + 1}</span>{t}</li>
              ))}
            </ol>
          </div>
        )}

        {/* ── 1 · Tell Kinika about your business ── */}
        {busy !== "plan" && step === 1 && (
          <div className="w-full max-w-[720px] flex flex-col gap-7">
            <div className="flex flex-col gap-3">
              <h1 className="font-display text-[36px] md:text-[44px] leading-[1.1]">Tell Kinika about your business.</h1>
              <p className="font-ui text-[16px] leading-relaxed text-muted-foreground max-w-[58ch]">Kinika works for shops, services, creators, consultants and people who are just getting started. It begins by understanding what you do; everything it makes for you later comes from that.</p>
            </div>
            <fieldset className="m-0 p-0 border-0 flex flex-col gap-2.5">
              <legend className="font-ui text-[13px] font-medium mb-1">Where are you right now?</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {KINDS.map((k) => (
                  <label key={k.value} className={cn("flex gap-3 items-start p-3.5 rounded-xl border bg-card cursor-pointer", kind === k.value ? "border-primary border-2 bg-accent" : "border-border")}>
                    <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="mt-1 accent-primary" />
                    <span className="flex flex-col gap-0.5"><span className="font-ui text-[14px] font-medium">{k.label}</span><span className="font-ui text-[12px] text-muted-foreground">{k.hint}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-2">
              <label htmlFor="about" className="font-ui text-[13px] font-medium">What do you do, or want to do?</label>
              <Textarea id="about" rows={5} value={text} onChange={(e) => setText(e.target.value)} autoFocus
                placeholder="A few sentences is plenty. For example: I run a small bakery in Växjö; weekends are full, weekdays are quiet. Or: I make short cooking videos and want to turn them into an income." className="text-[15px] leading-relaxed" />
              <span className="font-ui text-[12px] text-muted-foreground">Write it the way you would tell a friend. Kinika asks for anything else it needs on the next page.</span>
            </div>
            <div className="flex items-center gap-4 flex-wrap pt-1">
              <Back to="signin" />
              <button type="button" disabled={!canContinue} onClick={() => setStep(2)} className="inline-flex items-center h-12 px-6 rounded-xl bg-primary text-primary-foreground font-ui text-[15px] font-medium disabled:opacity-50">Continue</button>
            </div>
          </div>
        )}

        {/* ── 2 · What Kinika will read  /  2b · Getting started ── */}
        {busy !== "plan" && step === 2 && !isStarting && (
          <div className="w-full max-w-[760px] flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h1 className="font-display text-[34px] md:text-[40px] leading-[1.12]">Help Kinika understand your business.</h1>
              <p className="font-ui text-[16px] leading-relaxed text-muted-foreground max-w-[60ch]">Give Kinika anything that shows what you sell, who buys it and how you sound. It reads these once; on the next page it shows you what it understood and you correct it.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card">
                <label htmlFor="site" className="font-ui text-[14px] font-medium">Your website</label>
                <Input id="site" type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://" />
                <span className="font-ui text-[12px] text-muted-foreground">Kinika reads the pages, not your analytics.</span>
              </div>
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card">
                <label htmlFor="chat" className="font-ui text-[14px] font-medium">A conversation you already had about it</label>
                <Input id="chat" type="url" value={chatUrl} onChange={(e) => setChatUrl(e.target.value)} placeholder="Paste a ChatGPT, Claude or Gemini share link" />
                <span className="font-ui text-[12px] text-muted-foreground">If you already explained your business to an assistant, Kinika picks up where that left off.</span>
              </div>
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-dashed border-[hsl(var(--brand-blue-line))] bg-card">
                <span className="font-ui text-[14px] font-medium">Documents</span>
                <label className="inline-flex items-center justify-center h-10 rounded-lg border border-border bg-muted font-ui text-[13px] cursor-pointer">
                  Upload notes, a menu, a price list (text, Markdown, CSV)
                  <input type="file" multiple accept=".txt,.md,.csv,.json,text/*" className="sr-only" onChange={(e) => onFiles(e.target.files)} />
                </label>
                {documents.length > 0 && <span className="font-ui text-[12px] text-muted-foreground">{documents.map((d) => d.name).join(", ")}</span>}
              </div>
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card">
                <span className="font-ui text-[14px] font-medium">Your inbox, Slack and channels</span>
                <span className="font-ui text-[12px] text-muted-foreground leading-relaxed">Email, Slack, Instagram and TikTok connect from Kinika's team once your plan exists. Shopify, WordPress, Notion and GitHub can be connected there today.</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="more" className="font-ui text-[13px] font-medium">Or just tell Kinika more</label>
              <Textarea id="more" rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Anything the sources would not show: what sells best, who your regulars are, what you have tried, what you refuse to do." />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <Back to={1} />
              <button type="button" disabled={busy === "draft"} onClick={draft} className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-ui text-[15px] font-medium disabled:opacity-60">
                {busy === "draft" ? <Loader2 size={16} className="animate-spin" /> : null}{busy === "draft" ? "Kinika is reading" : "Show me what Kinika understood"}
              </button>
              <button type="button" disabled={busy === "draft"} onClick={draft} className="font-ui text-[13px] text-muted-foreground underline">Skip; use what I wrote</button>
            </div>
          </div>
        )}

        {busy !== "plan" && step === 2 && isStarting && (
          <div className="w-full max-w-[720px] flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <p className="font-ui text-[12px] tracking-[0.18em] uppercase text-accent-foreground">Thinking of starting something</p>
              <h1 className="font-display text-[34px] md:text-[40px] leading-[1.12]">Let us get you started.</h1>
              <p className="font-ui text-[16px] leading-relaxed text-muted-foreground max-w-[60ch]">That is enough to begin. Kinika will read it back to you, then propose a road from where you are to a business: find the problem, shape the smallest offer, get the first customers, then the brand. You change anything.</p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="own" className="font-ui text-[13px] font-medium">What would "it worked" look like for you?</label>
              <Input id="own" value={ownGoal} onChange={(e) => setOwnGoal(e.target.value)} placeholder="A few restaurants paying me monthly for more bookings, by spring" />
              <span className="font-ui text-[12px] text-muted-foreground">Loose is fine. Kinika turns it into checkable targets and revises as you learn.</span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <Back to={1} />
              <button type="button" disabled={busy === "draft"} onClick={draft} className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-ui text-[15px] font-medium disabled:opacity-60">
                {busy === "draft" ? <Loader2 size={16} className="animate-spin" /> : null}{busy === "draft" ? "Kinika is reading" : "Show me what Kinika understood"}
              </button>
            </div>
          </div>
        )}

        {/* ── 3 · Your business, as Kinika understands it ── */}
        {busy !== "plan" && step === 3 && readback && (
          <div className="w-full max-w-[800px] flex flex-col gap-6">
            <div className="flex flex-col gap-2.5">
              <h1 className="font-display text-[32px] md:text-[38px] leading-[1.12]">Here is what Kinika understood. Is it right?</h1>
              <p className="font-ui text-[15px] leading-relaxed text-muted-foreground max-w-[62ch]">Read it the way a new employee would describe your business on day one. Fix anything in place; add what is missing. Everything Kinika does for you starts from this page.</p>
            </div>
            <section aria-label="Kinika's understanding" className="bg-card border border-border rounded-2xl flex flex-col">
              <div className="flex items-baseline justify-between gap-4 flex-wrap px-6 py-5 border-b border-border">
                <div className="flex flex-col gap-1">
                  <span className="font-ui text-[11px] tracking-[0.18em] uppercase text-accent-foreground">{[readback.descriptor, readback.kind, readback.stage_key].filter(Boolean).join(" · ")}</span>
                  <input aria-label="Business name" value={readback.name} onChange={(e) => setReadback({ ...readback, name: e.target.value })} className="font-display text-[26px] bg-transparent outline-none border-b border-transparent focus:border-border" />
                </div>
                {sourcesRead && <span className="font-ui text-[12px] text-muted-foreground">From your words{sourcesRead.site ? ", your site" : ""}{sourcesRead.chat ? ", your conversation" : ""}{sourcesRead.documents ? `, ${sourcesRead.documents} document${sourcesRead.documents === 1 ? "" : "s"}` : ""}</span>}
              </div>
              {readback.sections.map((s, i) => (
                <div key={s.key} className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_auto] gap-2 md:gap-4 items-start px-6 py-4 border-b border-border">
                  <label htmlFor={`sec-${s.key}`} className="font-ui text-[13px] font-medium pt-1">{s.label}</label>
                  <Textarea id={`sec-${s.key}`} ref={i === 0 ? firstSectionRef : undefined} rows={2} value={s.value} onChange={(e) => updateSection(s.key, e.target.value)} className="text-[14px] leading-relaxed bg-transparent border-transparent focus:border-border px-2 py-1 -mx-2 resize-none" />
                  <span className={cn("font-ui text-[11px] px-2 py-1 rounded-full whitespace-nowrap", CONF_STYLE[s.confidence])}>{CONF_LABEL[s.confidence]} · {s.source}</span>
                </div>
              ))}
              {readback.not_known.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-2 md:gap-4 items-start px-6 py-4">
                  <span className="font-ui text-[13px] font-medium text-muted-foreground pt-1">Not yet known</span>
                  <p className="font-ui text-[14px] leading-relaxed text-muted-foreground">{readback.not_known.join(" · ")}</p>
                </div>
              )}
            </section>
            <div className="flex items-center gap-3 flex-wrap">
              <Back to={2} />
              <button type="button" onClick={() => setStep(4)} className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-ui text-[15px] font-medium"><Check size={16} /> Yes, that is my business</button>
              <button type="button" onClick={() => firstSectionRef.current?.focus()} className="h-12 px-4 rounded-xl border border-border bg-card font-ui text-[14px]">Something is wrong</button>
              <span className="font-ui text-[12px] text-muted-foreground ml-auto">Edit any line. Kinika keeps your version.</span>
            </div>
          </div>
        )}

        {/* ── 4 · What do you want to achieve? ── */}
        {busy !== "plan" && step === 4 && readback && (
          <div className="w-full max-w-[720px] flex flex-col gap-7">
            <div className="flex flex-col gap-3">
              <span className="inline-flex items-center gap-2 font-ui text-[12px] tracking-[0.18em] uppercase text-[hsl(var(--brand-good))]"><Check size={14} /> Kinika knows your business</span>
              <h1 className="font-display text-[36px] md:text-[42px] leading-[1.1]">What do you want to achieve?</h1>
              <p className="font-ui text-[16px] leading-relaxed text-muted-foreground max-w-[58ch]">Pick one of these, or say it your own way. It does not have to be precise; Kinika sharpens it into targets you can check off, and you can change direction any time.</p>
            </div>
            {readback.goals.length > 0 && (
              <fieldset className="m-0 p-0 border-0 flex flex-col gap-2.5">
                <legend className="font-ui text-[13px] font-medium mb-1">From what Kinika understood, these would make sense</legend>
                {readback.goals.map((g) => (
                  <label key={g} className={cn("flex gap-3.5 items-start p-4 rounded-xl border bg-card cursor-pointer", goal === g && !ownGoal.trim() ? "border-primary border-2 bg-accent" : "border-border")}>
                    <input type="radio" name="goal" checked={goal === g && !ownGoal.trim()} onChange={() => { setGoal(g); setOwnGoal(""); }} className="mt-1 accent-primary" />
                    <span className="font-ui text-[15px] font-medium">{g}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <div className="flex flex-col gap-2">
              <label htmlFor="own-goal" className="font-ui text-[13px] font-medium">Or in your own words</label>
              <Textarea id="own-goal" rows={2} value={ownGoal} onChange={(e) => setOwnGoal(e.target.value)} placeholder="'Earn enough to hire a full-time baker' is a fine goal." />
            </div>
            <div className="flex items-center gap-2.5 flex-wrap font-ui text-[13px] text-muted-foreground">
              <span>By when?</span>
              {HORIZONS.map((h) => (
                <button key={h} type="button" onClick={() => setHorizon(h)} className={cn("h-9 px-3 rounded-full border font-ui text-[13px]", horizon === h ? "bg-primary border-primary text-primary-foreground" : "border-border bg-card text-foreground")}>{h}</button>
              ))}
            </div>
            <div className="flex items-center gap-4 flex-wrap pt-1">
              <Back to={3} />
              <button type="button" disabled={!!busy} onClick={approve} className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-ui text-[15px] font-medium disabled:opacity-60">
                {busy ? <Loader2 size={16} className="animate-spin" /> : null}{busy === "plan" ? "Kinika is writing your plan" : busy === "approve" ? "Saving" : "Write my plan"}
              </button>
              <span className="font-ui text-[12px] text-muted-foreground">Next: targets and tasks, and the roles Kinika would hire.</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
