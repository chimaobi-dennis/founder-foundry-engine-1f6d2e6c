import { Button } from "@/components/ui/button";
import {
  MessageCircle, Camera, Megaphone, Calendar, FileText, Film,
  ArrowRight, Folder, Sparkles, AlertCircle
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ── Module catalog ─────────────────────────────────────────
type ModuleKey = "mentor" | "prostudio" | "contentstudio" | "contentcalendar" | "docstudio" | "reelbuilder";

interface ModuleDef {
  key: ModuleKey;
  name: string;
  icon: typeof MessageCircle;
  path: string;
  tagline: string;
  desc: string;
  requiresBrand: boolean;
  requiresDNA?: boolean;
}

const MODULES: ModuleDef[] = [
  { key: "mentor", name: "Kinika", icon: MessageCircle, path: "/mentor", tagline: "Your AI thinking partner",
    desc: "Remembers everything. Helps you think through your brand, strategy, and decisions — one conversation at a time.",
    requiresBrand: false },
  { key: "prostudio", name: "ProStudio", icon: Camera, path: "/pro-studio", tagline: "Product visuals without a studio",
    desc: "Turn your product into scroll-stopping images using professional templates — no design skills needed.",
    requiresBrand: false },
  { key: "contentstudio", name: "ContentStudio", icon: Megaphone, path: "/content-studio", tagline: "One brief. Eight platforms. Ready to post.",
    desc: "Write your campaign once and get platform-specific content for Instagram, LinkedIn, TikTok, and more — with visuals.",
    requiresBrand: true, requiresDNA: true },
  { key: "contentcalendar", name: "ContentCalendar", icon: Calendar, path: "/content-calendar", tagline: "Plan your content month",
    desc: "See everything scheduled in one place. Never miss a posting day or lose track of what's going out when.",
    requiresBrand: true },
  { key: "docstudio", name: "DocStudio", icon: FileText, path: "/doc-studio", tagline: "Professional documents, instantly",
    desc: "Proposals, briefs, pitch decks — generated from your brand memory so you never start from a blank page.",
    requiresBrand: true },
  { key: "reelbuilder", name: "ReelBuilder", icon: Film, path: "/reel-builder", tagline: "Brief to script to teleprompter",
    desc: "Turn a content idea into a structured video script with scenes, talking points, and a built-in teleprompter.",
    requiresBrand: true },
];

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
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
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

function platformDot(p?: string) {
  return PLATFORM_DOT[(p || "").toLowerCase()] || "bg-muted-foreground";
}

// ── Module Card ────────────────────────────────────────────
function ModuleCard({
  mod, hasBrand, hasDNA, activity, onNavigate,
}: {
  mod: ModuleDef;
  hasBrand: boolean;
  hasDNA: boolean;
  activity?: string;
  onNavigate: (path: string) => void;
}) {
  const Icon = mod.icon;
  const blockedNoDNA = mod.requiresDNA && hasBrand && !hasDNA;
  const blockedNoBrand = mod.requiresBrand && !hasBrand;
  const blocked = blockedNoBrand || blockedNoDNA;

  let actionLabel = "Open →";
  if (mod.key === "mentor") actionLabel = hasBrand ? "Continue conversation →" : "Start your first session →";
  else if (mod.key === "prostudio") actionLabel = "Browse templates →";
  else if (mod.key === "contentstudio") actionLabel = blockedNoDNA ? "Available after your first session with Kinika" : "Create content →";
  else if (mod.key === "contentcalendar") actionLabel = activity ?? "View calendar →";
  else if (mod.key === "docstudio") actionLabel = "Create a document →";
  else if (mod.key === "reelbuilder") actionLabel = "Write a script →";

  const handleClick = () => {
    if (blocked) {
      onNavigate("/mentor");
    } else {
      onNavigate(mod.path);
    }
  };

  const card = (
    <button
      onClick={handleClick}
      className="text-left group rounded-xl border-[0.5px] border-card-border bg-card hover:border-card-border-hover transition-all duration-200 overflow-hidden hover:-translate-y-0.5 dark:shadow-none shadow-[var(--card-shadow)] w-full"
    >
      <div className="h-[2px] bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
      <div className="p-5 flex flex-col gap-3 min-h-[180px]">
        <div className="flex items-center gap-2.5">
          <Icon size={26} className="text-primary/80 group-hover:text-primary transition-colors" />
          <span className="font-display text-lg text-foreground">{mod.name}</span>
        </div>
        <p className="font-ui text-[13px] text-foreground/90 font-medium">{mod.tagline}</p>
        <p className="font-ui text-[12px] text-muted-foreground leading-relaxed">{mod.desc}</p>
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className={`font-ui text-[12px] ${blocked ? "text-muted-foreground" : "text-primary"}`}>
            {actionLabel}
          </span>
          {activity && mod.key !== "contentcalendar" && (
            <span className="font-ui text-[11px] text-muted-foreground">{activity}</span>
          )}
        </div>
      </div>
    </button>
  );

  if (blocked) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent side="top">
            <p className="font-ui text-xs">Start with Kinika first to unlock this</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return card;
}

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
  const [dataLoading, setDataLoading] = useState(false);

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "";
  const greeting = firstName ? `${getGreeting()}, ${firstName}` : getGreeting();
  const onboarded = !!profile?.onboarding_completed;
  const status = profile?.brand_status ?? null;
  const brandCount = brands?.length ?? 0;
  const hasBrand = !!activeBrand;
  const hasDNA = !!(activeBrandDNA && (activeBrandDNA.brand_voice || activeBrandDNA.positioning_statement || activeBrandDNA.core_promise));

  // Fetch dynamic data when active brand changes
  useEffect(() => {
    if (!activeBrand?.id) {
      setLastMentorMsg(null);
      setAssets([]);
      setUpcomingPosts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      try {
        const today = new Date();
        const in14 = new Date();
        in14.setDate(today.getDate() + 14);
        const startDate = today.toISOString().split("T")[0];
        const endDate = in14.toISOString().split("T")[0];

        const [conv, assetList, posts] = await Promise.all([
          getOrCreateConversation(activeBrand.id),
          getLibraryAssets(activeBrand.id, "all"),
          getCalendarPostsForRange(activeBrand.id, startDate, endDate),
        ]);

        if (cancelled) return;
        setAssets(assetList ?? []);
        setUpcomingPosts(posts ?? []);

        if (conv?.id) {
          const msgs = await getMessages(conv.id);
          if (cancelled) return;
          const lastAssistant = [...(msgs ?? [])].reverse().find((m) => m.role === "assistant");
          setLastMentorMsg(lastAssistant ? { content: lastAssistant.content, created_at: lastAssistant.created_at } : null);
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeBrand?.id]);

  const upcomingCalendarActivity = useMemo(() => {
    if (upcomingPosts.length === 0) return undefined;
    return `${upcomingPosts.length} ${upcomingPosts.length === 1 ? "post" : "posts"} scheduled`;
  }, [upcomingPosts.length]);

  const moduleActivity = (key: ModuleKey): string | undefined => {
    if (key === "contentcalendar") return upcomingCalendarActivity;
    if (key === "prostudio" || key === "contentstudio") {
      const count = assets.filter((a) => a.source_module === key.replace("contentstudio", "contentstudio").replace("prostudio", "prostudio")).length;
      if (count > 0) return `${count} ${count === 1 ? "asset" : "assets"}`;
    }
    if (key === "docstudio") {
      const count = assets.filter((a) => a.type === "document").length;
      if (count > 0) return `${count} ${count === 1 ? "doc" : "docs"}`;
    }
    if (key === "reelbuilder") {
      const count = assets.filter((a) => a.type === "script").length;
      if (count > 0) return `${count} ${count === 1 ? "script" : "scripts"}`;
    }
    return undefined;
  };

  if (profileLoading || brandLoading) return <HomeSkeleton />;

  // Determine state
  type State = "incomplete" | "in_progress" | "early" | "multiple" | "default";
  let viewState: State = "default";
  if (!onboarded) viewState = "incomplete";
  else if (status === "in_progress" && hasBrand) viewState = "in_progress";
  else if (status === "multiple_projects" && brandCount > 0) viewState = "multiple";
  else if ((status === "have_idea" || status === "exploring") && brandCount <= 1) viewState = "early";

  // ── Subtitle ──
  let subtitle = "Tell me about your idea or your brand and we will figure out the rest together.";
  if (viewState === "incomplete") subtitle = "Tell me about yourself to get started.";
  else if (viewState === "in_progress" && activeBrand) subtitle = `Here's where things stand with ${activeBrand.name}.`;
  else if (viewState === "early") subtitle = "Let's figure out the rest together.";
  else if (viewState === "multiple") subtitle = `You have ${brandCount} projects. Pick up where you left off.`;

  return (
    <FadeIn>
      <div className="relative min-h-screen pb-16 overflow-x-hidden bg-background">
        <div className="pointer-events-none absolute top-0 right-0 w-[500px] h-[400px] bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.06),transparent_70%)]" />

        {/* ── Incomplete onboarding banner ── */}
        {viewState === "incomplete" && (
          <div className="px-4 md:px-6 pt-6 max-w-[1200px] mx-auto">
            <div className="flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
              <AlertCircle size={18} className="text-primary flex-shrink-0" />
              <p className="font-ui text-sm text-foreground flex-1">
                Finish setting up your profile so your mentor can speak your language.
              </p>
              <Button
                onClick={() => navigate("/onboarding")}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Complete setup →
              </Button>
            </div>
          </div>
        )}

        {/* ── Hero ── */}
        <section className="relative px-4 md:px-6 pt-8 md:pt-10 pb-8 max-w-[1200px] mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-4 rounded-full bg-primary animate-amber-pulse flex-shrink-0" />
            <h1 className="font-display text-[32px] md:text-[40px] lg:text-[48px] leading-tight text-foreground">
              {greeting}
            </h1>
          </div>
          <p className="font-ui text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            {subtitle}
          </p>

          {/* CTAs only for incomplete onboarding */}
          {viewState === "incomplete" && (
            <div className="flex flex-col xs:flex-row gap-2.5 mt-5">
              <Button onClick={() => navigate("/mentor")} className="bg-primary text-primary-foreground hover:bg-primary/90">
                I have an idea to explore
              </Button>
              <Button onClick={() => navigate("/mentor")} variant="outline" className="border-primary text-primary hover:bg-primary/10">
                I already have a brand
              </Button>
            </div>
          )}
        </section>

        {/* ── STATE 2: In progress — Continue card + stats ── */}
        {viewState === "in_progress" && activeBrand && (
          <section className="px-4 md:px-6 pb-8 max-w-[1200px] mx-auto space-y-5">
            {/* Continue card */}
            <div className="rounded-xl border-[0.5px] border-card-border bg-card overflow-hidden flex">
              <div className="w-1 bg-primary" />
              <div className="flex-1 p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-2 font-ui">
                    <span>Continue where you left off</span>
                  </div>
                  <h3 className="font-display text-2xl text-foreground mb-1">{activeBrand.name}</h3>
                  {currentStageData && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-ui mb-3">
                      <span>{currentStageData.emoji}</span>
                      <span>{currentStageData.name}</span>
                    </div>
                  )}
                  {/* Journey progress bar */}
                  {journeyStages.length > 0 && (
                    <div className="flex gap-1 mb-3 max-w-md">
                      {journeyStages.map((s) => {
                        const currentIdx = journeyStages.findIndex(js => js.stage_key === activeBrand.journey_stage);
                        const myIdx = journeyStages.findIndex(js => js.stage_key === s.stage_key);
                        const isCurrent = s.stage_key === activeBrand.journey_stage;
                        const isPast = myIdx >= 0 && currentIdx >= 0 && myIdx < currentIdx;
                        return (
                          <div
                            key={s.stage_key}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              isCurrent ? "bg-primary" : isPast ? "bg-primary/60" : "bg-muted"
                            }`}
                            title={s.name}
                          />
                        );
                      })}
                    </div>
                  )}
                  {lastMentorMsg && (
                    <p className="font-ui text-[13px] text-muted-foreground italic">
                      "{truncate(lastMentorMsg.content, 100)}"
                      <span className="not-italic ml-2 text-[11px]">· Last session · {relativeDays(lastMentorMsg.created_at)}</span>
                    </p>
                  )}
                </div>
                <Button onClick={() => navigate("/mentor")} className="bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0">
                  Continue in Mentor →
                </Button>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border-[0.5px] border-card-border bg-card p-4">
                <p className="font-ui text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-2">Journey stage</p>
                <p className="font-display text-base text-foreground">
                  {currentStageData ? `${currentStageData.emoji} ${currentStageData.name}` : "—"}
                </p>
              </div>
              <div className="rounded-xl border-[0.5px] border-card-border bg-card p-4">
                <p className="font-ui text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-2">Assets created</p>
                <p className="font-display text-base text-foreground">{assets.length}</p>
              </div>
              <div className="rounded-xl border-[0.5px] border-card-border bg-card p-4">
                <p className="font-ui text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-2">Posts scheduled</p>
                <p className="font-display text-base text-foreground">{upcomingPosts.length}</p>
              </div>
            </div>
          </section>
        )}

        {/* ── STATE 3: Early user — Welcome block ── */}
        {viewState === "early" && (
          <section className="px-4 md:px-6 pb-8 max-w-[1200px] mx-auto">
            <div className="rounded-2xl border-[0.5px] border-card-border bg-card p-8 md:p-12 text-center flex flex-col items-center gap-4">
              <Sparkles size={32} className="text-primary" />
              <h2 className="font-display text-2xl md:text-3xl text-foreground">
                Your mentor is ready when you are.
              </h2>
              <p className="font-ui text-base text-muted-foreground max-w-xl">
                {status === "have_idea"
                  ? "You have an idea — that's enough to start. Your mentor will help you shape it into something real."
                  : "Not sure where to start? That's exactly where the right conversation begins."}
              </p>
              <Button
                onClick={() => navigate("/mentor")}
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 px-8 h-12"
              >
                Start a conversation →
              </Button>
            </div>
          </section>
        )}

        {/* ── STATE 4: Multiple projects ── */}
        {viewState === "multiple" && brands.length > 0 && (
          <section className="px-4 md:px-6 pb-8 max-w-[1200px] mx-auto">
            <h2 className="font-ui text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-4">Your projects</h2>
            <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-chat">
              {brands.map((b) => {
                const stage = journeyStages.find(s => s.stage_key === b.journey_stage);
                const initial = (b.name || "?").charAt(0).toUpperCase();
                return (
                  <button
                    key={b.id}
                    onClick={() => navigate("/mentor")}
                    className="flex-shrink-0 w-[260px] text-left rounded-xl border-[0.5px] border-card-border bg-card hover:border-card-border-hover hover:-translate-y-0.5 transition-all p-4 group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center font-display text-base text-white flex-shrink-0"
                        style={{ backgroundColor: b.primary_color || "#1A2A3A" }}
                      >
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-base text-foreground truncate">{b.name}</p>
                        {stage && (
                          <p className="font-ui text-[11px] text-muted-foreground truncate">
                            {stage.emoji} {stage.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-ui text-[11px] text-muted-foreground">
                        {b.completeness_score}% complete
                      </span>
                      <span className="font-ui text-[12px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Open →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Module Grid (always shown) ── */}
        <section className="px-4 md:px-6 pb-8 pt-4 max-w-[1200px] mx-auto">
          <h2 className="font-ui text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-5">
            Everything you need to build your brand
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {MODULES.map((mod) => (
              <ModuleCard
                key={mod.key}
                mod={mod}
                hasBrand={hasBrand}
                hasDNA={hasDNA}
                activity={moduleActivity(mod.key)}
                onNavigate={navigate}
              />
            ))}
          </div>
        </section>

        {/* ── Upcoming posts (only if data) ── */}
        {hasBrand && upcomingPosts.length > 0 && (
          <section className="px-4 md:px-6 pb-8 max-w-[1200px] mx-auto">
            <h2 className="font-ui text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-4">Coming up</h2>
            <div className="rounded-xl border-[0.5px] border-card-border bg-card divide-y divide-border">
              {upcomingPosts.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate("/content-calendar")}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${platformDot(p.platform)}`} />
                  <span className="font-ui text-[12px] text-foreground capitalize w-24 flex-shrink-0">{p.platform}</span>
                  <span className="font-ui text-[12px] text-muted-foreground w-28 flex-shrink-0">
                    {new Date(p.scheduled_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                  <span className="font-ui text-[13px] text-foreground/90 truncate flex-1">
                    {p.creative_headline || p.creative_copy_text || p.copy_text || "Scheduled post"}
                  </span>
                  <ArrowRight size={14} className="text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Recent assets (only if data) ── */}
        {hasBrand && assets.length > 0 && (
          <section className="px-4 md:px-6 pb-16 max-w-[1200px] mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-ui text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Recent assets</h2>
              <Link to="/library" className="font-ui text-[12px] text-primary hover:underline">View library →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {assets.slice(0, 3).map((a) => (
                <Link
                  key={a.id}
                  to="/library"
                  className="rounded-xl border-[0.5px] border-card-border bg-card overflow-hidden hover:border-card-border-hover hover:-translate-y-0.5 transition-all"
                >
                  <div className="aspect-[4/3] bg-muted/30 flex items-center justify-center overflow-hidden">
                    {a.file_url && (a.mime_type?.startsWith("image/") || a.type === "template_output" || a.type === "generated_visual" || a.type === "product_image") ? (
                      <img src={a.file_url} alt={a.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <Folder size={28} className="text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-ui text-[13px] text-foreground truncate">{a.name}</p>
                    <p className="font-ui text-[11px] text-muted-foreground capitalize">{a.source_module}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </FadeIn>
  );
};

export default Home;
