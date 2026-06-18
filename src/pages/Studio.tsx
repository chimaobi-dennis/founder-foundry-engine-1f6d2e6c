import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Megaphone,
  Hexagon,
  FileText,
  Film,
  TrendingUp,
  Monitor,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getRecentCreations, type RecentItem } from "@/services/studioService";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""} ago`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CardDef = {
  id: "socialContent" | "logo" | "documents" | "reels" | "pitchDeck" | "presentation";
  icon: LucideIcon;
  title: string;
  description: string;
  route: string | null;
  soon?: boolean;
};

type QuickAction = {
  id: CardDef["id"];
  icon: LucideIcon;
  label: string;
  route: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "socialContent", icon: Megaphone, label: "Social Content", route: "/content-studio" },
  { id: "logo", icon: Hexagon, label: "Logo", route: "/studio/logo" },
  { id: "documents", icon: FileText, label: "Document", route: "/doc-studio" },
  { id: "reels", icon: Film, label: "Reel Script", route: "/reel-builder" },
];

const CARDS: CardDef[] = [
  {
    id: "socialContent",
    icon: Megaphone,
    title: "Social Content",
    description: "Campaigns, posts and visuals for every platform",
    route: "/content-studio",
  },
  {
    id: "logo",
    icon: Hexagon,
    title: "Logo",
    description: "Generate your brand logo with AI",
    route: "/studio/logo",
  },
  {
    id: "documents",
    icon: FileText,
    title: "Document",
    description: "Proposals, briefs, contracts and one-pagers",
    route: "/doc-studio",
  },
  {
    id: "reels",
    icon: Film,
    title: "Reel Script",
    description: "Script, storyboard and teleprompter",
    route: "/reel-builder",
  },
  {
    id: "pitchDeck",
    icon: TrendingUp,
    title: "Pitch Deck",
    description: "Investor deck from your brand context",
    route: null,
    soon: true,
  },
  {
    id: "presentation",
    icon: Monitor,
    title: "Presentation",
    description: "Slides generated from your brand",
    route: null,
    soon: true,
  },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RecentSkeleton() {
  return (
    <div className="space-y-2 mt-3">
      {[72, 88].map((w) => (
        <div key={w} className="flex items-center justify-between">
          <div
            className="h-3 rounded bg-foreground/10"
            style={{
              width: `${w}%`,
              animation: "studio-skel 1.6s ease-in-out infinite",
            }}
          />
          <div
            className="h-3 rounded ml-2 flex-shrink-0 bg-foreground/5"
            style={{
              width: 48,
              animation: "studio-skel 1.6s ease-in-out infinite",
              animationDelay: "200ms",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Recent items ─────────────────────────────────────────────────────────────

function RecentItems({ items, loading }: { items: RecentItem[]; loading: boolean }) {
  if (loading) return <RecentSkeleton />;

  if (items.length === 0) {
    return (
      <p className="mt-3 text-[11px] font-ui italic text-muted-foreground/60">
        Nothing yet — start creating
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-2">
          <span
            className="text-[11px] font-ui truncate text-muted-foreground"
            title={item.name}
          >
            {item.name}
          </span>
          <span className="text-[10px] font-ui flex-shrink-0 text-muted-foreground/50">
            {relativeTime(item.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function CreationCard({
  card,
  items,
  loading,
  onClick,
}: {
  card: CardDef;
  items: RecentItem[];
  loading: boolean;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const canClick = !!card.route;

  return (
    <div
      role={canClick ? "button" : undefined}
      tabIndex={canClick ? 0 : undefined}
      onClick={canClick ? onClick : undefined}
      onKeyDown={canClick ? (e) => e.key === "Enter" && onClick?.() : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative flex flex-col p-5 rounded-xl border transition-all duration-200 select-none bg-card outline-none ${
        hovered && canClick ? "border-primary/45" : "border-card-border"
      } ${canClick ? "cursor-pointer" : "cursor-default"}`}
    >
      {/* Coming Soon badge */}
      {card.soon && (
        <span className="absolute top-4 right-4 text-[9px] font-ui font-semibold uppercase tracking-widest px-2 py-0.5 rounded-sm bg-primary/15 text-primary">
          Soon
        </span>
      )}

      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 flex-shrink-0 bg-primary/10 ${
          card.soon ? "text-primary/45" : "text-primary"
        }`}
      >
        <card.icon size={18} />
      </div>

      {/* Title + description */}
      <p
        className={`text-[14px] font-ui font-semibold leading-snug mb-1 ${
          card.soon ? "text-foreground/45" : "text-foreground"
        }`}
      >
        {card.title}
      </p>
      <p
        className={`text-[12px] font-ui leading-snug ${
          card.soon ? "text-muted-foreground/50" : "text-muted-foreground"
        }`}
      >
        {card.description}
      </p>

      {/* Divider */}
      <div className="my-3 h-px bg-card-border" />

      {/* Recent creations */}
      {card.soon ? (
        <p className="text-[11px] font-ui italic text-muted-foreground/35">
          Coming soon
        </p>
      ) : (
        <RecentItems items={items} loading={loading} />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Studio() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [recent, setRecent] = useState<{
    socialContent: RecentItem[];
    logo: RecentItem[];
    documents: RecentItem[];
    reels: RecentItem[];
  }>({ socialContent: [], logo: [], documents: [], reels: [] });
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const data = await getRecentCreations(user.id);
      if (!cancelled) {
        setRecent(data);
        setLoadingRecent(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const getItems = (id: CardDef["id"]): RecentItem[] => {
    if (id === "socialContent") return recent.socialContent;
    if (id === "logo") return recent.logo;
    if (id === "documents") return recent.documents;
    if (id === "reels") return recent.reels;
    return [];
  };

  return (
    <div className="min-h-full px-6 py-8 md:px-10 bg-background">
      <style>{`
        @keyframes studio-skel {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
      `}</style>

      {/* ── Launcher ── */}
      <div className="max-w-2xl mb-8">
        {/* Amber accent rule */}
        <div className="w-10 h-px bg-primary mb-3" />

        <h1 className="text-[26px] font-display font-semibold leading-snug mb-4 text-foreground">
          What do you want to create today?
        </h1>

        {/* Input bar — no card, restrained border */}
        <div
          className={`relative rounded-lg border transition-colors duration-200 ${
            focused ? "border-primary/50" : "border-card-border"
          }`}
        >
          <input
            type="text"
            placeholder="Describe what you want to create…"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="w-full bg-transparent pl-4 pr-14 py-3.5 text-[14px] font-ui outline-none text-foreground placeholder:text-muted-foreground/50 caret-primary"
            readOnly
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-ui text-muted-foreground/40 select-none">
            ⌘K
          </span>
        </div>

        {/* Quick action pills */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => navigate(action.route)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-card-border text-[12px] font-ui text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            >
              <action.icon size={12} />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section break ── */}
      <div className="mb-4">
        <p className="text-[10px] font-ui font-medium uppercase tracking-widest text-muted-foreground/70 mb-2">
          Quick Start
        </p>
        <div className="h-px bg-card-border" />
      </div>

      {/* ── Creation cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((card) => (
          <CreationCard
            key={card.id}
            card={card}
            items={getItems(card.id)}
            loading={loadingRecent && !card.soon}
            onClick={() => card.route && navigate(card.route)}
          />
        ))}
      </div>
    </div>
  );
}
