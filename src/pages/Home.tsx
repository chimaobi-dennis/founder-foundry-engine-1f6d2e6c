import { Button } from "@/components/ui/button";
import {
  MessageCircle, Camera, Megaphone, Calendar, FileText, Film,
  Download, CalendarPlus, Instagram, Facebook, Twitter,
  ArrowRight, Clock, Plus, Send, Folder
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useProfile } from "@/hooks/use-profile";
import { HomeSkeleton } from "@/components/skeletons/PageSkeletons";

const allModules = [
  { key: "mentor", name: "Mentor", icon: MessageCircle, path: "/mentor", desc: "Your AI thinking partner. Remembers everything.", visual: "chat-brain" },
  { key: "prostudio", name: "ProStudio", icon: Camera, path: "/pro-studio", desc: "Product photography and digital visuals without a studio.", visual: "before-after" },
  { key: "campaignkit", name: "CampaignKit", icon: Megaphone, path: "/campaign-kit", desc: "One brief. Eight platform-ready creatives instantly.", visual: "fan-out" },
  { key: "contentcalendar", name: "ContentCalendar", icon: Calendar, path: "/content-calendar", desc: "Plan your content month. Never miss a posting day.", visual: "mini-cal" },
  { key: "docstudio", name: "DocStudio", icon: FileText, path: "/doc-studio", desc: "Professional documents powered by your brand memory.", visual: "doc-card" },
  { key: "reelbuilder", name: "ReelBuilder", icon: Film, path: "/reel-builder", desc: "Brief to storyboard to teleprompter in minutes.", visual: "storyboard" },
];

const getModuleOrder = (profession: string | null, brandStatus: string | null) => {
  if (brandStatus === "just_an_idea" || brandStatus === "early_stage") {
    return ["mentor", "prostudio", "campaignkit", "contentcalendar", "docstudio", "reelbuilder"];
  }
  if (profession === "freelancer") {
    return ["mentor", "docstudio", "campaignkit", "prostudio", "contentcalendar", "reelbuilder"];
  }
  if (brandStatus === "multiple_brands") {
    return ["mentor", "contentcalendar", "campaignkit", "prostudio", "docstudio", "reelbuilder"];
  }
  if (brandStatus === "established") {
    return ["campaignkit", "mentor", "prostudio", "contentcalendar", "docstudio", "reelbuilder"];
  }
  return ["mentor", "prostudio", "campaignkit", "contentcalendar", "docstudio", "reelbuilder"];
};

function getChatPreview(brandStatus: string | null) {
  if (brandStatus === "just_an_idea") {
    return [
      { role: "ai" as const, text: "You have an idea. Good — that is where everything starts. Before we talk about logos or campaigns, tell me this: what problem are you actually solving and for who specifically?" },
    ];
  }
  if (brandStatus === "early_stage") {
    return [
      { role: "ai" as const, text: "You have got something started. The hardest part now is usually figuring out what is actually working versus what just feels like it should be working. What is the biggest thing that feels unresolved about your brand right now?" },
    ];
  }
  if (brandStatus === "established") {
    return [
      { role: "ai" as const, text: "You have been at this a while. At this stage most founders are not missing ideas — they are missing clarity on which idea to focus on. What is the one thing you keep coming back to that you have not solved yet?" },
    ];
  }
  if (brandStatus === "multiple_brands") {
    return [
      { role: "ai" as const, text: "Managing multiple brands or clients means your biggest risk is dilution — spreading too thin across too many things. Which brand or client needs the most strategic attention right now?" },
    ];
  }
  // Default — Nordform conversation
  return [
    { role: "user" as const, text: "I want to build a functional wellness brand called Nordform. Science-based adaptogens, targeting Stockholm professionals who are skeptical of wellness culture." },
    { role: "ai" as const, text: "Interesting tension. Swedish consumers are very open to health products but deeply skeptical of wellness marketing. How honest are you willing to be about what the research actually shows?" },
    { role: "user" as const, text: "Completely honest. I think that is actually the differentiator." },
    { role: "ai" as const, text: "That is a strong instinct. If Nordform says 'the research is promising but not conclusive — here is what we know' that builds more trust than overclaiming. How do you communicate uncertainty without undermining purchase confidence?" },
    { role: "user" as const, text: "We frame it around ritual and consistency rather than miracle results." },
    { role: "ai" as const, text: "Smart. That shifts the success metric from the product to the behavior. What does the physical product look like? In Sweden the packaging carries a lot of brand weight." },
  ];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const platformColor: Record<string, string> = { Instagram: "text-[#2D4A3E]", Facebook: "text-blue-400", Twitter: "text-sky-400", General: "text-muted-foreground" };
const platformIcon: Record<string, typeof Instagram> = { Instagram, Facebook, Twitter };

function ModuleVisual({ type }: { type: string }) {
  const base = "w-full h-20 rounded-md flex items-center justify-center gap-1 overflow-hidden";
  switch (type) {
    case "chat-brain":
      return (
        <div className={`${base} bg-primary/5`}>
          <div className="flex flex-col gap-1 items-start">
            <div className="w-16 h-2 rounded-full bg-primary/20" />
            <div className="w-12 h-2 rounded-full bg-primary/10" />
          </div>
          <div className="w-5 h-5 rounded-full border-2 border-primary/30 ml-2 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
          </div>
          <div className="flex flex-col gap-1 items-end">
            <div className="w-14 h-2 rounded-full bg-primary/15" />
            <div className="w-10 h-2 rounded-full bg-primary/10" />
          </div>
        </div>
      );
    case "before-after":
      return (
        <div className={`${base} bg-primary/5`}>
          <div className="w-14 h-14 rounded bg-muted/30 border border-border flex items-center justify-center text-[8px] text-muted-foreground">RAW</div>
          <ArrowRight size={14} className="text-primary/40" />
          <div className="w-14 h-14 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-[8px] text-primary">FINAL</div>
        </div>
      );
    case "fan-out":
      return (
        <div className={`${base} bg-primary/5 relative`}>
          <div className="w-10 h-12 rounded bg-primary/15 border border-primary/20 absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center text-[7px] text-primary/60">BRIEF</div>
          {[-28, -20, -12, 12, 20, 28].map((r, i) => (
            <div key={i} className="w-6 h-8 rounded bg-muted/20 border border-border absolute" style={{ transform: `rotate(${r}deg) translateY(-8px)`, opacity: 0.4 + i * 0.1 }} />
          ))}
        </div>
      );
    case "mini-cal":
      return (
        <div className={`${base} bg-primary/5`}>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: 28 }, (_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${[3, 7, 10, 15, 21, 24].includes(i) ? "bg-primary/40" : [5, 12, 19].includes(i) ? "bg-blue-400/30" : "bg-muted/20"}`} />
            ))}
          </div>
        </div>
      );
    case "doc-card":
      return (
        <div className={`${base} bg-primary/5`}>
          <div className="w-16 h-16 rounded bg-card border border-border p-1.5 flex flex-col gap-1">
            <div className="w-full h-1.5 rounded-full bg-primary/20" />
            <div className="w-3/4 h-1 rounded-full bg-muted/30" />
            <div className="w-full h-1 rounded-full bg-muted/20" />
            <div className="w-5/6 h-1 rounded-full bg-muted/20" />
            <div className="mt-auto w-1/2 h-1 rounded-full bg-primary/15" />
          </div>
        </div>
      );
    case "storyboard":
      return (
        <div className={`${base} bg-primary/5 gap-2`}>
          {[1, 2, 3].map((n) => (
            <div key={n} className="w-12 h-14 rounded bg-card border border-border flex flex-col items-center justify-center gap-1">
              <div className="w-8 h-6 rounded-sm bg-muted/20" />
              <div className="w-6 h-1 rounded-full bg-muted/30" />
            </div>
          ))}
        </div>
      );
    default:
      return <div className={`${base} bg-primary/5`} />;
  }
}

const Home = () => {
  const navigate = useNavigate();
  const chatRef = useRef<HTMLDivElement>(null);
  const { profile, loading: profileLoading } = useProfile();

  if (profileLoading) return <HomeSkeleton />;

  const hasBrand = profile?.onboarding_completed;
  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const greeting = `${getGreeting()}, ${firstName}`;

  const chatMessages = getChatPreview(profile?.brand_status ?? null);
  const moduleOrder = getModuleOrder(profile?.profession ?? null, profile?.brand_status ?? null);
  const orderedModules = moduleOrder.map((key) => allModules.find((m) => m.key === key)!).filter(Boolean);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, []);

  // First-time user with no brand (should not normally happen since onboarding sets onboarding_completed)
  if (!hasBrand) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center text-center gap-4 max-w-[440px] px-4">
          <div className="w-4 h-4 rounded-full bg-primary animate-amber-pulse" />
          <h1 className="font-display text-[32px] text-foreground mt-2">Welcome to FounderForge</h1>
          <p className="font-ui text-base text-muted-foreground max-w-[400px]">
            Let's start by building your first brand. Your mentor is ready.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <Button onClick={() => navigate("/mentor?mode=idea")} className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-lg min-w-[200px]">
              Start with an idea
            </Button>
            <Button onClick={() => navigate("/mentor?mode=brand")} variant="outline" className="border-primary text-primary hover:bg-primary/10 h-12 rounded-lg min-w-[200px]">
              I already have a brand
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Check if user has actual assets/brands (for empty states)
  const hasAssets = false; // Will be dynamic once brands/assets are stored
  const hasPosts = false;

  return (
    <div className="relative min-h-screen pb-16 overflow-x-hidden">
      <div className="pointer-events-none absolute top-0 right-0 w-[500px] h-[400px] bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.06),transparent_70%)]" />

      {/* ── Hero ── */}
      <section className="relative grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 px-4 md:px-6 pt-8 md:pt-10 pb-8 md:pb-12 max-w-full lg:max-w-[1200px] mx-auto">
        <div className="lg:col-span-3 flex flex-col justify-center gap-4 md:gap-5">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-primary animate-amber-pulse flex-shrink-0" />
            <h1 className="font-display text-[32px] md:text-[40px] lg:text-[48px] leading-tight text-foreground">
              {greeting}
            </h1>
          </div>
          <p className="font-ui text-base md:text-lg text-muted-foreground max-w-lg leading-relaxed">
            Tell me about your idea or your brand and we will figure out the rest together.
          </p>
          <div className="flex flex-col xs:flex-row gap-2.5 mt-1">
            <Button onClick={() => navigate("/mentor?mode=idea")} className="bg-primary text-primary-foreground border-0 hover:bg-primary/90 w-full xs:w-auto">
              I have an idea to explore
            </Button>
            <Button onClick={() => navigate("/mentor?mode=brand")} variant="outline" className="bg-transparent border-[1.5px] border-primary text-primary hover:bg-primary/10 w-full xs:w-auto">
              I already have a brand
            </Button>
          </div>
        </div>

        {/* Chat preview */}
        <div className="col-span-1 lg:col-span-2 flex flex-col">
          <div className="rounded-xl border-[0.5px] border-card-border bg-card overflow-hidden shadow-lg dark:shadow-primary/5 shadow-black/5">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-amber-pulse" />
              <span className="font-ui text-xs text-muted-foreground">Mentor · Your session</span>
            </div>
            <div ref={chatRef} className="px-5 py-4 space-y-3 h-[320px] overflow-y-auto scrollbar-chat">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`rounded-lg px-3 py-2 text-[12px] leading-relaxed max-w-[85%] font-ui ${
                    msg.role === "user"
                      ? "bg-background text-foreground"
                      : "bg-muted text-foreground"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-border">
              <div className="w-full h-9 rounded-lg bg-muted/50 border border-border flex items-center justify-between px-3">
                <span className="text-[11px] text-muted-foreground font-ui">Continue this conversation...</span>
                <Send size={14} className="text-muted-foreground/50" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Module grid ── */}
      <section className="px-4 md:px-6 pb-8 md:pb-12 pt-12 md:pt-20 max-w-full lg:max-w-[1200px] mx-auto">
        <h2 className="font-ui text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-5">
          Everything you need to build your brand
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orderedModules.map((mod) => (
            <Link
              key={mod.name}
              to={mod.path}
              className="group rounded-xl border-[0.5px] border-card-border bg-card hover:border-card-border-hover transition-all duration-200 overflow-hidden hover:-translate-y-0.5 dark:shadow-none shadow-[var(--card-shadow)]"
            >
              <div className="h-[2px] bg-gradient-to-r from-primary/60 via-primary to-primary/60 group-hover:from-primary group-hover:via-primary group-hover:to-primary transition-all duration-200" />
              <div className="p-4 md:p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <mod.icon size={28} className="text-primary/80 group-hover:text-primary transition-colors duration-200" />
                    <span className="font-display text-lg text-foreground">{mod.name}</span>
                  </div>
                  <span className="text-[12px] font-ui text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">Open →</span>
                </div>
                <p className="font-ui text-[13px] text-muted-foreground">{mod.desc}</p>
                <ModuleVisual type={mod.visual} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Recent assets ── */}
      <section className="px-4 md:px-6 pb-8 md:pb-12 max-w-full lg:max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-ui text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Recent assets</h2>
        </div>
        {hasAssets ? (
          <div className="text-muted-foreground">Assets grid here</div>
        ) : (
          <div className="flex flex-col items-center py-12 gap-2">
            <Folder size={32} className="text-muted-foreground/40" />
            <p className="font-ui text-[13px] text-muted-foreground">Your assets will appear here</p>
            <p className="font-ui text-[12px] text-muted-foreground">Assets you create in ProStudio, DocStudio and ReelBuilder are saved automatically.</p>
            <Link to="/pro-studio" className="font-ui text-[13px] text-primary hover:underline mt-2">Go to ProStudio →</Link>
          </div>
        )}
      </section>

      {/* ── Upcoming posts ── */}
      <section className="px-4 md:px-6 pb-16 max-w-full lg:max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-ui text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Upcoming posts</h2>
        </div>
        {hasPosts ? (
          <div className="text-muted-foreground">Posts here</div>
        ) : (
          <div className="flex flex-col items-center py-12 gap-2">
            <Calendar size={32} className="text-muted-foreground/40" />
            <p className="font-ui text-[13px] text-muted-foreground">No posts scheduled yet</p>
            <Link to="/campaign-kit" className="font-ui text-[13px] text-primary hover:underline mt-2">Create your first campaign →</Link>
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
