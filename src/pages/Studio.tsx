import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Megaphone,
  Hexagon,
  FileText,
  Film,
  TrendingUp,
  Monitor,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
            className="h-3 rounded"
            style={{
              width: `${w}%`,
              background: "rgba(255,255,255,0.06)",
              animation: "studio-skel 1.6s ease-in-out infinite",
            }}
          />
          <div
            className="h-3 rounded ml-2 flex-shrink-0"
            style={{
              width: 48,
              background: "rgba(255,255,255,0.04)",
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
      <p
        className="mt-3 text-[11px] font-ui italic"
        style={{ color: "rgba(138,150,163,0.55)" }}
      >
        Nothing yet — start creating
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-2">
          <span
            className="text-[11px] font-ui truncate"
            style={{ color: "#8A96A3" }}
            title={item.name}
          >
            {item.name}
          </span>
          <span
            className="text-[10px] font-ui flex-shrink-0"
            style={{ color: "rgba(138,150,163,0.5)" }}
          >
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
      className="relative flex flex-col p-5 rounded-xl transition-all duration-200 select-none"
      style={{
        background: "#1A2A3A",
        border: `1px solid ${hovered && canClick ? "rgba(212,160,23,0.45)" : "#2A3A4A"}`,
        cursor: canClick ? "pointer" : "default",
        outline: "none",
      }}
    >
      {/* Coming Soon badge */}
      {card.soon && (
        <span
          className="absolute top-4 right-4 text-[9px] font-ui font-semibold uppercase tracking-widest px-2 py-0.5 rounded-sm"
          style={{ background: "rgba(212,160,23,0.15)", color: "#D4A017" }}
        >
          Soon
        </span>
      )}

      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 flex-shrink-0"
        style={{
          background: "rgba(212,160,23,0.10)",
          color: card.soon ? "rgba(212,160,23,0.45)" : "#D4A017",
        }}
      >
        <card.icon size={18} />
      </div>

      {/* Title + description */}
      <p
        className="text-[14px] font-ui font-semibold leading-snug mb-1"
        style={{ color: card.soon ? "rgba(245,240,232,0.45)" : "#F5F0E8" }}
      >
        {card.title}
      </p>
      <p
        className="text-[12px] font-ui leading-snug"
        style={{ color: card.soon ? "rgba(138,150,163,0.5)" : "#8A96A3" }}
      >
        {card.description}
      </p>

      {/* Divider */}
      <div
        className="my-3 h-px"
        style={{ background: "#2A3A4A" }}
      />

      {/* Recent creations */}
      {card.soon ? (
        <p
          className="text-[11px] font-ui italic"
          style={{ color: "rgba(138,150,163,0.35)" }}
        >
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
    <div
      className="min-h-full px-6 py-8 md:px-10"
      style={{ background: "#0D1B2A" }}
    >
      <style>{`
        @keyframes studio-skel {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
      `}</style>

      {/* ── Launcher bar ── */}
      <div className="max-w-2xl mb-10">
        <h1
          className="text-[22px] font-display font-semibold mb-1 leading-snug"
          style={{ color: "#F5F0E8" }}
        >
          What do you want to create today?
        </h1>
        <p
          className="text-[13px] font-ui mb-5"
          style={{ color: "#8A96A3" }}
        >
          Describe it or choose a starting point below
        </p>

        {/* Visual input — not wired */}
        <div
          className="relative rounded-xl transition-all duration-200"
          style={{
            border: `1.5px solid ${focused ? "rgba(212,160,23,0.6)" : "#2A3A4A"}`,
            boxShadow: focused ? "0 0 0 3px rgba(212,160,23,0.08)" : "none",
            background: "#1A2A3A",
          }}
        >
          <input
            type="text"
            placeholder="e.g. Instagram post for my new product launch…"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="w-full bg-transparent px-4 py-4 text-[14px] font-ui outline-none placeholder:text-[#8A96A3]/50"
            style={{ color: "#F5F0E8", caretColor: "#D4A017" }}
            readOnly
          />
        </div>
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
