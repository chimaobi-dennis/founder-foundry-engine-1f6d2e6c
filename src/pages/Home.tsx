import { Button } from "@/components/ui/button";
import {
  MessageCircle, Camera, Megaphone, Calendar, FileText, Film,
  ArrowRight, ArrowUpRight, Folder, AlertCircle, Layers, Shield,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useProfile } from "@/hooks/use-profile";
import { useBrand } from "@/contexts/BrandContext";
import { HomeSkeleton } from "@/components/skeletons/PageSkeletons";
import { FadeIn } from "@/components/FadeIn";
import { getOrCreateConversation, getMessages } from "@/services/mentorService";
import { getLibraryAssets, type Asset } from "@/services/assetService";
import { getCalendarPostsForRange, type CalendarPost } from "@/services/calendarService";
import { getBrandStageData, getAllStageFields, type StageField } from "@/services/journeyDataService";

// ── Helpers ────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function relativeDays(iso: string | null | undefined): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "a week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n).trim() + "…" : s;
}

const PLATFORM_DOT: Record<string, string> = {
  instagram: "bg-pink-500",
  facebook: "bg-blue-500",
  twitter: "bg-sky-400",
  x: "bg-foreground",
  linkedin: "bg-blue-700",
  tiktok: "bg-foreground",
  youtube: "bg-red-500",
  pinterest: "bg-red-600",
};
const platformDot = (p?: string) => PLATFORM_DOT[(p || "").toLowerCase()] || "bg-muted-foreground";

// ── Small editorial primitives ─────────────────────────────
const SectionEyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 mb-5">
    <span className="h-px w-6 bg-primary/50" />
    <h2 className="font-ui text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
      {children}
    </h2>
  </div>
);

const ContextLine = ({
  label, value, muted,
}: { label: string; value: string; muted?: boolean }) => (
  <div className="py-3.5 border-b border-border/50 last:border-b-0 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6">
    <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:w-48 flex-shrink-0">
      {label}
    </p>
    <p className={`font-display text-[15px] leading-snug ${muted ? "text-muted-foreground italic" : "text-foreground"}`}>
      {value}
    </p>
  </div>
);

// ── Main Component ────────────────────────────────────────
const Home = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useProfile();
  const {
    activeBrand, activeBrandDNA, brands, journeyStages, currentStageData, isLoading: brandLoading,
  } = useBrand();

  const [lastMentorMsg, setLastMentorMsg] = useState<{ content: string; created_at: string } | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [upcomingPosts, setUpcomingPosts] = useState<CalendarPost[]>([]);
  const [brandStageData, setBrandStageData] = useState<Record<string, Record<string, string>>>({});
  const [stageFields, setStageFields] = useState<Record<string, StageField[]>>({});

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "";
  const greeting = firstName ? `${getGreeting()}, ${firstName}` : getGreeting();
  const onboarded = !!profile?.onboarding_completed;
  const status = profile?.brand_status ?? null;
  const brandCount = brands?.length ?? 0;
  const hasBrand = !!activeBrand;
  const hasDNA = !!(activeBrandDNA && (activeBrandDNA.brand_voice || activeBrandDNA.positioning_statement || activeBrandDNA.core_promise));

  useEffect(() => {
    if (!activeBrand?.id) {
      setLastMentorMsg(null);
      setAssets([]);
      setUpcomingPosts([]);
      setBrandStageData({});
      return;
    }
    let cancelled = false;
    (async () => {
      const today = new Date();
      const in14 = new Date();
      in14.setDate(today.getDate() + 14);
      const startDate = today.toISOString().split("T")[0];
      const endDate = in14.toISOString().split("T")[0];

      const [conv, assetList, posts, stageData, fields] = await Promise.all([
        getOrCreateConversation(activeBrand.id),
        getLibraryAssets(activeBrand.id, "all"),
        getCalendarPostsForRange(activeBrand.id, startDate, endDate),
        getBrandStageData(activeBrand.id),
        getAllStageFields(),
      ]);
      if (cancelled) return;
      setAssets(assetList ?? []);
      setUpcomingPosts(posts ?? []);
      setBrandStageData(stageData ?? {});
      setStageFields(fields ?? {});
      if (conv?.id) {
        const msgs = await getMessages(conv.id);
        if (cancelled) return;
        const lastAssistant = [...(msgs ?? [])].reverse().find((m) => m.role === "assistant");
        setLastMentorMsg(lastAssistant ? { content: lastAssistant.content, created_at: lastAssistant.created_at } : null);
      }
    })();
    return () => { cancelled = true; };
  }, [activeBrand?.id]);

  if (profileLoading || brandLoading) return <HomeSkeleton />;

  // Stage classification
  type State = "incomplete" | "in_progress" | "early" | "multiple" | "default";
  let viewState: State = "default";
  if (!onboarded) viewState = "incomplete";
  else if (status === "multiple_projects" && brandCount > 1) viewState = "multiple";
  else if (status === "in_progress" && hasBrand) viewState = "in_progress";
  else if ((status === "have_idea" || status === "exploring") && brandCount <= 1) viewState = "early";

  // ── Derived business context ──
  const completeness = activeBrand?.completeness_score ?? 0;

  const latestAsset = assets[0];
  const nextPost = upcomingPosts[0];
  const docCount = assets.filter((a) => a.type === "document").length;
  const scriptCount = assets.filter((a) => a.type === "script").length;
  const visualCount = assets.filter((a) => a.type === "template_output" || a.type === "generated_visual").length;

  const hasMomentum = !!(lastMentorMsg || latestAsset || nextPost);

  // Get current stage data for Business Context panel
  const currentStageKey = activeBrand?.journey_stage ?? currentStageData?.stage_key ?? journeyStages[0]?.stage_key;
  const currentStageFields = stageFields[currentStageKey] ?? [];
  const currentStageValues = brandStageData[currentStageKey] ?? {};
  
  // Build list of fields with values, ordered by sort_order
  const contextFields = currentStageFields
    .filter(field => currentStageValues[field.field_key]?.trim())
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 5)
    .map(field => ({
      label: field.field_label,
      value: currentStageValues[field.field_key]?.trim() ?? ""
    }));

  const hasContextFields = contextFields.length > 0;

  // ── Subtitle (calm, environmental) ──
  let subtitle = "";
  if (viewState === "incomplete") subtitle = "A few details first, so the workspace can adapt to how you work.";
  else if (viewState === "early") subtitle = "Begin a conversation. The rest of the workspace will form around it.";
  else if (viewState === "multiple") subtitle = `${brandCount} businesses in your workspace. Continue with one.`;
  else if (viewState === "in_progress" && activeBrand) subtitle = `The current state of ${activeBrand.name}.`;
  else subtitle = "Your operating environment.";

  return (
    <FadeIn>
      <div className="relative min-h-screen pb-20 overflow-x-hidden bg-background">
        <div className="pointer-events-none absolute top-0 right-0 w-[520px] max-w-full h-[420px] bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.05),transparent_72%)]" />
        <div className="pointer-events-none absolute top-[120px] left-0 w-[300px] h-[300px] bg-[radial-gradient(ellipse_at_left,hsl(var(--primary)/0.025),transparent_70%)]" />

        {/* ── Incomplete onboarding banner ── */}
        {viewState === "incomplete" && (
          <div className="px-4 md:px-8 pt-6 max-w-[1180px] mx-auto">
            <div className="flex items-center gap-3 rounded-lg bg-primary/[0.06] border border-primary/20 px-4 py-3">
              <AlertCircle size={16} className="text-primary flex-shrink-0" />
              <p className="font-ui text-[13px] text-foreground flex-1">
                Finish your profile so Kinika can shape itself around you.
              </p>
              <Button onClick={() => navigate("/onboarding")} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Continue setup
              </Button>
            </div>
          </div>
        )}

        {/* ── Quiet hero ── */}
        <section className="relative px-4 md:px-8 pt-10 md:pt-14 pb-10 max-w-[1180px] mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-amber-pulse" />
            <p className="font-ui text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              {activeBrand ? activeBrand.name : "Workspace"}
            </p>
          </div>
          <h1 className="font-display leading-[1.05] text-foreground" style={{ fontSize: "clamp(30px, 5.5vw, 52px)" }}>
            {greeting}.
          </h1>
          <p className="font-ui text-[15px] md:text-base text-muted-foreground mt-3 max-w-xl leading-relaxed">
            {subtitle}
          </p>
        </section>

        {/* ─────────────────────────────────────────────────────
            EARLY STATE — calm conversational invitation
        ───────────────────────────────────────────────────── */}
        {viewState === "early" && (
          <section className="px-4 md:px-8 pb-16 max-w-[1180px] mx-auto">
            <div className="rounded-2xl border border-card-border bg-card/60 backdrop-blur-sm p-8 md:p-12">
              <div className="max-w-2xl">
                <SectionEyebrow>Begin</SectionEyebrow>
                <h2 className="font-display text-[28px] md:text-[34px] leading-tight text-foreground mb-4">
                  Every workflow here starts as a conversation.
                </h2>
                <p className="font-ui text-[14px] text-muted-foreground leading-relaxed mb-8 max-w-lg">
                  Tell Kinika what you're building. As your thinking takes shape,
                  the rest of your workspace — campaigns, visuals, documents — will form around it.
                </p>
                <Button
                  onClick={() => navigate("/mentor")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-6"
                >
                  Open Kinika
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* ─────────────────────────────────────────────────────
            MULTIPLE PROJECTS — ecosystem switcher
        ───────────────────────────────────────────────────── */}
        {viewState === "multiple" && brands.length > 0 && (
          <section className="px-4 md:px-8 pb-16 max-w-[1180px] mx-auto">
            <SectionEyebrow>Your businesses</SectionEyebrow>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {brands.map((b) => {
                const stage = journeyStages.find(s => s.stage_key === b.journey_stage);
                const isActive = b.id === activeBrand?.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => navigate("/mentor")}
                    className={`text-left rounded-xl border bg-card hover:border-primary/40 transition-all p-5 group ${
                      isActive ? "border-primary/60" : "border-card-border"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: b.primary_color || "hsl(var(--primary))" }} />
                      <p className="font-display text-lg text-foreground truncate flex-1">{b.name}</p>
                      {isActive && <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-primary">Active</span>}
                    </div>
                    <p className="font-ui text-[11px] text-muted-foreground mb-3">
                      {stage ? stage.name : "Beginning"}
                    </p>
                    <div className="h-px bg-border/60 mb-3" />
                    <div className="flex items-center justify-between">
                      <span className="font-ui text-[11px] text-muted-foreground">{b.completeness_score}% formed</span>
                      <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ─────────────────────────────────────────────────────
            CONTEXT LAYER — the brain of the homepage
            (only when there's an active brand)
        ───────────────────────────────────────────────────── */}
        {hasBrand && viewState !== "early" && (
          <section className="px-4 md:px-8 pb-14 max-w-[1180px] mx-auto">
            <SectionEyebrow>
              Business context{currentStageData ? ` — ${currentStageData.name}` : ""}
            </SectionEyebrow>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 lg:gap-10">
              {/* Context lines */}
              <div className="rounded-xl border border-card-border bg-card/40 px-5 md:px-7 py-2 md:py-3">
                {hasContextFields ? (
                  <>
                    {contextFields.map((field, idx) => (
                      <ContextLine
                        key={idx}
                        label={field.label}
                        value={truncate(field.value, 160)}
                      />
                    ))}
                    {/* Stage row at the bottom */}
                    <ContextLine
                      label="Stage"
                      value={currentStageData ? `${currentStageData.emoji} ${currentStageData.name}` : "—"}
                    />
                  </>
                ) : (
                  <>
                    <ContextLine
                      label="Stage"
                      value={currentStageData ? `${currentStageData.emoji} ${currentStageData.name}` : "—"}
                      muted={true}
                    />
                    <p className="text-muted-foreground italic text-sm mt-1 ml-48 sm:ml-0">
                      Shape this in conversation with Kinika.
                    </p>
                  </>
                )}
              </div>

              {/* Brand alignment panel */}
              <aside className="rounded-xl border border-card-border bg-card/40 p-5 flex flex-col">
                <p className="font-ui text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Brand alignment
                </p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-[42px] leading-none text-foreground">{completeness}</span>
                  <span className="font-ui text-[12px] text-muted-foreground">/ 100</span>
                </div>
                <div className="mt-4 h-1 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.max(2, completeness)}%` }}
                  />
                </div>
                <p className="font-ui text-[12px] text-muted-foreground leading-relaxed mt-4">
                  {completeness < 30
                    ? "Your foundations are still forming."
                    : completeness < 70
                    ? "Your direction is becoming clearer."
                    : "Your brand reads with consistency across surfaces."}
                </p>
                <Link
                  to="/brand-dna"
                  className="mt-auto pt-4 font-ui text-[12px] text-primary hover:underline inline-flex items-center gap-1"
                >
                  Open Brand DNA <ArrowUpRight size={12} />
                </Link>
              </aside>
            </div>
          </section>
        )}

        {/* ─────────────────────────────────────────────────────
            ACTIVE MOMENTUM — what's currently moving
        ───────────────────────────────────────────────────── */}
        {hasBrand && hasMomentum && (
          <section className="px-4 md:px-8 pb-14 max-w-[1180px] mx-auto">
            <SectionEyebrow>In motion</SectionEyebrow>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Last conversation */}
              {lastMentorMsg && (
                <button
                  onClick={() => navigate("/mentor")}
                  className="text-left rounded-xl border border-card-border bg-card/50 hover:border-primary/40 transition-all p-5 flex flex-col group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Last thread</span>
                    <span className="font-ui text-[10px] text-muted-foreground">{relativeDays(lastMentorMsg.created_at)}</span>
                  </div>
                  <p className="font-display text-[15px] leading-snug text-foreground/90 italic flex-1">
                    "{truncate(lastMentorMsg.content, 130)}"
                  </p>
                  <div className="mt-4 flex items-center gap-2 font-ui text-[12px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Continue <ArrowRight size={12} />
                  </div>
                </button>
              )}

              {/* Latest visual */}
              {latestAsset && (
                <button
                  onClick={() => navigate("/library")}
                  className="text-left rounded-xl border border-card-border bg-card/50 hover:border-primary/40 transition-all overflow-hidden flex flex-col group"
                >
                  <div className="aspect-[16/10] bg-muted/30 overflow-hidden">
                    {latestAsset.file_url && (latestAsset.mime_type?.startsWith("image/") || latestAsset.type === "template_output" || latestAsset.type === "generated_visual" || latestAsset.type === "product_image") ? (
                      <img src={latestAsset.file_url} alt={latestAsset.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Folder size={26} className="text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Latest output</span>
                    <p className="font-display text-[14px] text-foreground truncate">{latestAsset.name}</p>
                    <p className="font-ui text-[11px] text-muted-foreground capitalize mt-0.5">
                      {latestAsset.source_module?.replace("contentstudio", "ContentStudio").replace("prostudio", "ProStudio") || latestAsset.type}
                    </p>
                  </div>
                </button>
              )}

              {/* Next scheduled */}
              {nextPost ? (
                <button
                  onClick={() => navigate("/content-calendar")}
                  className="text-left rounded-xl border border-card-border bg-card/50 hover:border-primary/40 transition-all p-5 flex flex-col group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Next scheduled</span>
                    <span className="font-ui text-[10px] text-muted-foreground">
                      {new Date(nextPost.scheduled_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`w-1.5 h-1.5 rounded-full ${platformDot(nextPost.platform)}`} />
                    <span className="font-ui text-[11px] text-muted-foreground capitalize">{nextPost.platform}</span>
                  </div>
                  <p className="font-display text-[14px] leading-snug text-foreground flex-1">
                    {truncate(nextPost.creative_headline || nextPost.creative_copy_text || nextPost.copy_text || "Scheduled post", 110)}
                  </p>
                  {upcomingPosts.length > 1 && (
                    <p className="font-ui text-[11px] text-muted-foreground mt-3">
                      + {upcomingPosts.length - 1} more in the next 14 days
                    </p>
                  )}
                </button>
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 bg-transparent p-5 flex flex-col justify-center">
                  <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Next scheduled</span>
                  <p className="font-display text-[14px] text-muted-foreground italic leading-snug">
                    Nothing planned yet. Open the calendar when you're ready to sequence.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ─────────────────────────────────────────────────────
            WORKFLOW ACCESS — Kinika primary, others quiet
        ───────────────────────────────────────────────────── */}
        <section className="px-4 md:px-8 pb-12 max-w-[1180px] mx-auto">
          <SectionEyebrow>Workflows</SectionEyebrow>

          {/* Kinika — primary */}
          <button
            onClick={() => navigate("/mentor")}
            className="w-full text-left rounded-xl border border-card-border bg-card/60 hover:border-primary/50 transition-all p-6 md:p-7 group flex items-start gap-5 mb-3"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3 flex-wrap">
                <h3 className="font-display text-xl text-foreground">Kinika</h3>
                <span className="font-ui text-[11px] text-muted-foreground">The thinking layer</span>
              </div>
              <p className="font-ui text-[13px] text-muted-foreground leading-relaxed mt-2 max-w-2xl">
                Every workflow here is shaped by what you've built in conversation.
                {hasBrand ? " Continue where you left off." : " Begin here."}
              </p>
            </div>
            <ArrowUpRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
          </button>

          {/* Secondary workflows — compact list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { name: "Studio", icon: Camera, path: "/pro-studio", desc: "Visual generation shaped by your brand context.", count: visualCount, unit: "outputs" },
              { name: "Campaigns", icon: Megaphone, path: "/content-studio", desc: "One brief, sequenced across platforms.", locked: !hasDNA, lockedHint: "Available once your brand DNA forms." },
              { name: "Calendar", icon: Calendar, path: "/content-calendar", desc: "Continuity across what you publish.", count: upcomingPosts.length, unit: "scheduled" },
              { name: "Documents", icon: FileText, path: "/doc-studio", desc: "Proposals and decks, pre-aligned to your voice.", count: docCount, unit: "drafted" },
              { name: "Scripts", icon: Film, path: "/reel-builder", desc: "Reels and video, structured from your message.", count: scriptCount, unit: "written" },
              { name: "Library", icon: Layers, path: "/library", desc: "Everything generated, in one place.", count: assets.length, unit: "assets" },
            ].map((m) => {
              const Icon = m.icon;
              const handleClick = () => {
                if (m.locked) navigate("/mentor");
                else navigate(m.path);
              };
              return (
                <button
                  key={m.name}
                  onClick={handleClick}
                  className="text-left rounded-lg border border-card-border bg-card/30 hover:bg-card/60 hover:border-primary/30 transition-all px-5 py-4 flex items-center gap-4 group"
                >
                  <Icon size={16} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-display text-[15px] text-foreground">{m.name}</span>
                      {m.locked ? (
                        <span className="font-ui text-[10px] text-muted-foreground italic">{m.lockedHint}</span>
                      ) : m.count && m.count > 0 ? (
                        <span className="font-ui text-[11px] text-muted-foreground">· {m.count} {m.unit}</span>
                      ) : null}
                    </div>
                    <p className="font-ui text-[12px] text-muted-foreground leading-snug mt-0.5 truncate">
                      {m.desc}
                    </p>
                  </div>
                  <ArrowUpRight size={14} className="text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Brand DNA quiet link */}
          <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-5">
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <Shield size={13} />
              <span className="font-ui text-[12px]">
                The shared layer beneath every workflow.
              </span>
            </div>
            <Link to="/brand-dna" className="font-ui text-[12px] text-primary hover:underline inline-flex items-center gap-1">
              Brand DNA <ArrowUpRight size={12} />
            </Link>
          </div>
        </section>
      </div>
    </FadeIn>
  );
};

export default Home;
