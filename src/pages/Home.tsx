import { Button } from "@/components/ui/button";
import {
  MessageCircle, Camera, Megaphone, Calendar, FileText, Film,
  Download, CalendarPlus, Instagram, Facebook, Twitter,
  ArrowRight, Clock, Plus, Send
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const mockChat = [
  { role: "user" as const, text: "I want to build a functional wellness brand called Nordform. Science-based adaptogens, targeting Stockholm professionals who are skeptical of wellness culture." },
  { role: "ai" as const, text: "Interesting tension. Swedish consumers are very open to health products but deeply skeptical of wellness marketing. How honest are you willing to be about what the research actually shows?" },
  { role: "user" as const, text: "Completely honest. I think that is actually the differentiator." },
  { role: "ai" as const, text: "That is a strong instinct. If Nordform says 'the research is promising but not conclusive — here is what we know' that builds more trust than overclaiming. How do you communicate uncertainty without undermining purchase confidence?" },
  { role: "user" as const, text: "We frame it around ritual and consistency rather than miracle results." },
  { role: "ai" as const, text: "Smart. That shifts the success metric from the product to the behavior. What does the physical product look like? In Sweden the packaging carries a lot of brand weight." },
  { role: "user" as const, text: "Minimal white packaging. Forest green typography. Very clean. More design object than supplement bottle." },
  { role: "ai" as const, text: "Perfect for Stockholm. Supplements that look good on a kitchen counter rather than hidden in a cabinet. The packaging signals intelligence before the customer reads a word. Who is your specific customer?" },
  { role: "user" as const, text: "Mid-thirties, works in tech or design, slightly embarrassed by the wellness industry but genuinely interested in optimising how they feel." },
  { role: "ai" as const, text: "That self-awareness is gold. Nordform is the supplement brand for people who hate supplement brands. That is a real positioning. Write that down — it is your brief for everything." },
];

const modules = [
  { name: "Mentor", icon: MessageCircle, path: "/mentor", desc: "Your AI thinking partner. Remembers everything.", visual: "chat-brain" },
  { name: "ProStudio", icon: Camera, path: "/pro-studio", desc: "Product photography and digital visuals without a studio.", visual: "before-after" },
  { name: "CampaignKit", icon: Megaphone, path: "/campaign-kit", desc: "One brief. Eight platform-ready creatives instantly.", visual: "fan-out" },
  { name: "ContentCalendar", icon: Calendar, path: "/content-calendar", desc: "Plan your content month. Never miss a posting day.", visual: "mini-cal" },
  { name: "DocStudio", icon: FileText, path: "/doc-studio", desc: "Professional documents powered by your brand memory.", visual: "doc-card" },
  { name: "ReelBuilder", icon: Film, path: "/reel-builder", desc: "Brief to storyboard to teleprompter in minutes.", visual: "storyboard" },
];

const recentAssets = [
  { name: "Daily Stack on counter", platform: "Instagram" },
  { name: "Testimonial card", platform: "Facebook" },
  { name: "Feature card", platform: "General" },
  { name: "Announcement visual", platform: "Instagram" },
  { name: "Ashwagandha close-up", platform: "Facebook" },
  { name: "Lifestyle morning shot", platform: "Instagram" },
];

const today = new Date();
const upcomingDays = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(today);
  d.setDate(d.getDate() + i + 1);
  return d;
});

const scheduledPosts: Record<number, { platform: string; copy: string; time: string }> = {
  0: { platform: "Instagram", copy: "Morning ritual with Nordform Daily Stack ✦", time: "09:00" },
  2: { platform: "Facebook", copy: "What our customers actually say about Lion's Mane", time: "12:30" },
  4: { platform: "Instagram", copy: "The science behind Ashwagandha — honestly explained", time: "10:00" },
  5: { platform: "Twitter", copy: "Three supplements. One daily ritual. No overclaiming. ✦", time: "14:00" },
};

const dayName = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short" });
const dayDate = (d: Date) => `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "short" })}`;

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
  const { user } = useAuth();
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, []);

  // Check if user is first-time (no brands flag in metadata)
  useEffect(() => {
    if (user) {
      const hasCompletedOnboarding = user.user_metadata?.has_brand === true;
      setIsFirstTime(!hasCompletedOnboarding);
    }
  }, [user]);

  if (isFirstTime) {
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

  return (
    <div className="relative min-h-screen pb-16 overflow-x-hidden">
      <div className="pointer-events-none absolute top-0 right-0 w-[500px] h-[400px] bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.06),transparent_70%)]" />

      {/* ── Hero ── */}
      <section className="relative grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 px-4 md:px-6 pt-8 md:pt-10 pb-8 md:pb-12 max-w-full lg:max-w-[1200px] mx-auto">
        <div className="lg:col-span-3 flex flex-col justify-center gap-4 md:gap-5">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-primary animate-amber-pulse flex-shrink-0" />
            <h1 className="font-display text-[32px] md:text-[40px] lg:text-[48px] leading-tight text-foreground">
              What are we building today?
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
              <span className="font-ui text-xs text-muted-foreground">Mentor · Nordform session</span>
            </div>
            <div ref={chatRef} className="px-5 py-4 space-y-3 h-[320px] overflow-y-auto scrollbar-chat">
              {mockChat.map((msg, i) => (
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
          {modules.map((mod) => (
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
          <button className="font-ui text-[13px] text-primary hover:underline">View all</button>
        </div>
        <div className="hidden md:flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {recentAssets.map((asset, i) => <AssetCard key={i} asset={asset} tablet />)}
        </div>
        <div className="grid grid-cols-2 gap-3 md:hidden">
          {recentAssets.map((asset, i) => <AssetCard key={i} asset={asset} mobile />)}
        </div>
      </section>

      {/* ── Upcoming posts ── */}
      <section className="px-4 md:px-6 pb-16 max-w-full lg:max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-ui text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Upcoming posts</h2>
        </div>
        <div className="flex flex-col gap-1">
          {upcomingDays.map((d, i) => {
            const post = scheduledPosts[i];
            const PlatformIcon = post ? platformIcon[post.platform] : null;
            return (
              <div key={i} className={`flex items-center gap-2 md:gap-4 px-3 md:px-4 py-2.5 md:py-3 rounded-lg transition-all duration-200 min-w-0 ${
                post ? "bg-card border border-card-border hover:border-card-border-hover" : "border border-dashed border-border/50"
              }`}>
                <span className="font-ui text-[11px] md:text-[13px] text-muted-foreground w-14 md:w-20 flex-shrink-0">
                  {dayName(d)} {dayDate(d)}
                </span>
                {post ? (
                  <>
                    {PlatformIcon && <PlatformIcon size={16} className={platformColor[post.platform]} />}
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded bg-muted/30 flex-shrink-0 flex items-center justify-center">
                      <Camera size={12} className="text-muted-foreground/40" />
                    </div>
                    <p className="font-ui text-[12px] md:text-[13px] text-foreground flex-1 truncate">{post.copy}</p>
                    <span className="font-ui text-[11px] md:text-[12px] text-muted-foreground flex items-center gap-1 flex-shrink-0">
                      <Clock size={12} /> {post.time}
                    </span>
                  </>
                ) : (
                  <button className="font-ui text-[12px] text-primary/50 hover:text-primary flex items-center gap-1 transition-colors duration-200">
                    <Plus size={12} /> Schedule post
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <Link to="/content-calendar" className="font-ui text-[13px] text-primary hover:underline">View full calendar →</Link>
        </div>
      </section>
    </div>
  );
};

function AssetCard({ asset, mobile, tablet }: { asset: { name: string; platform: string }; mobile?: boolean; tablet?: boolean }) {
  return (
    <div className={`group relative flex-shrink-0 ${mobile ? "w-full" : tablet ? "w-[140px] lg:w-[160px]" : "w-[160px]"}`}>
      <div className="relative w-full aspect-[4/3] rounded-lg bg-card border border-card-border overflow-hidden group-hover:border-card-border-hover transition-all duration-200">
        <div className="w-full h-full bg-gradient-to-br from-muted/40 to-muted/20 flex items-center justify-center">
          <Camera size={20} className="text-muted-foreground/40" />
        </div>
        <div className={`absolute bottom-1.5 right-1.5 flex gap-1.5 ${mobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity duration-200`}>
          <button className="w-7 h-7 rounded-full bg-card/90 border border-border flex items-center justify-center hover:border-primary transition-colors duration-200">
            <Download size={12} className="text-foreground" />
          </button>
          <button className="w-7 h-7 rounded-full bg-card/90 border border-border flex items-center justify-center hover:border-primary transition-colors duration-200">
            <CalendarPlus size={12} className="text-foreground" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="font-ui text-[10px] px-1.5 py-0.5 rounded-full border border-primary/30 text-primary">{asset.platform}</span>
      </div>
      <p className="font-ui text-[13px] text-foreground mt-1 truncate">{asset.name}</p>
    </div>
  );
}

export default Home;
