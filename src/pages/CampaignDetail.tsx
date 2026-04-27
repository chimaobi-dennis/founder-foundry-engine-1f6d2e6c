import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  Download,
  Bookmark,
  CalendarPlus,
  Instagram,
  Facebook,
  Mail,
  MessageSquare,
  Twitter,
  Search,
  Smartphone,
  Megaphone,
  Archive,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getCampaignWithCreatives,
  generateCampaignCreatives,
  regenerateCampaignPlatform,
  scheduleCreative,
} from "@/services/campaignService";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/hooks/use-brand";

const db = supabase as any;

// ───────────────────────── Platform meta ─────────────────────────

type PlatformId =
  | "headlines"
  | "instagram"
  | "facebook_ad"
  | "google_ad"
  | "email"
  | "whatsapp"
  | "twitter_x"
  | "sms";

interface PlatformMeta {
  id: PlatformId;
  name: string;
  icon: any;
  /** Solid dot colour for tab + status indicators */
  dot: string;
  /** Background style applied to the visual creative card */
  background: string;
  /** Foreground colour used for headline / icon on the visual card */
  foreground: string;
  /** Chip background for CTA button on the visual card */
  ctaBg: string;
  /** Chip text colour for CTA button on the visual card */
  ctaFg: string;
}

const PLATFORMS: PlatformMeta[] = [
  {
    id: "headlines",
    name: "Headlines",
    icon: Megaphone,
    dot: "#D4A017",
    background: "#D4A017",
    foreground: "#1A1A2E",
    ctaBg: "#1A1A2E",
    ctaFg: "#F5F0E8",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: Instagram,
    dot: "#E1306C",
    background: "linear-gradient(135deg, #E1306C 0%, #833AB4 100%)",
    foreground: "#FFFFFF",
    ctaBg: "rgba(255,255,255,0.95)",
    ctaFg: "#1A1A2E",
  },
  {
    id: "facebook_ad",
    name: "Facebook Ad",
    icon: Facebook,
    dot: "#1877F2",
    background: "#1877F2",
    foreground: "#FFFFFF",
    ctaBg: "#FFFFFF",
    ctaFg: "#1877F2",
  },
  {
    id: "google_ad",
    name: "Google Ad",
    icon: Search,
    dot: "#4285F4",
    background:
      "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 60%, rgba(66,133,244,0.08) 100%)",
    foreground: "#1A1A2E",
    ctaBg: "#1A73E8",
    ctaFg: "#FFFFFF",
  },
  {
    id: "email",
    name: "Email",
    icon: Mail,
    dot: "#EA4335",
    background: "#EA4335",
    foreground: "#FFFFFF",
    ctaBg: "#FFFFFF",
    ctaFg: "#EA4335",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: MessageSquare,
    dot: "#25D366",
    background: "linear-gradient(135deg, #128C7E 0%, #25D366 100%)",
    foreground: "#FFFFFF",
    ctaBg: "#FFFFFF",
    ctaFg: "#128C7E",
  },
  {
    id: "twitter_x",
    name: "Twitter / X",
    icon: Twitter,
    dot: "#000000",
    background: "#000000",
    foreground: "#FFFFFF",
    ctaBg: "#FFFFFF",
    ctaFg: "#000000",
  },
  {
    id: "sms",
    name: "SMS",
    icon: Smartphone,
    dot: "#6B7280",
    background: "linear-gradient(135deg, #4B5563 0%, #6B7280 100%)",
    foreground: "#FFFFFF",
    ctaBg: "#FFFFFF",
    ctaFg: "#1A1A2E",
  },
];

const PLATFORM_BY_ID = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p])
) as Record<PlatformId, PlatformMeta>;

type CreativeStatus = "generating" | "ready" | "failed";

interface Creative {
  id: string;
  platform: PlatformId | string;
  headline: string | null;
  copy_text: string | null;
  subject_line: string | null;
  scheduled_at?: string | null;
  status?: CreativeStatus;
}

// ───────────────────────── Visual creative card ─────────────────────────

function VisualCreativeCard({
  meta,
  creative,
  brandName,
  cta,
  status,
  fillHeight = false,
}: {
  meta: PlatformMeta;
  creative: Creative;
  brandName: string;
  cta: string;
  status: CreativeStatus;
  fillHeight?: boolean;
}) {
  const Icon = meta.icon;

  const sizingStyle: React.CSSProperties = fillHeight
    ? { minHeight: "100%" }
    : { aspectRatio: "4/5" };
  const sizingClass = fillHeight ? "h-full min-h-[560px]" : "";

  if (status === "generating") {
    return (
      <div
        className={`relative w-full rounded-2xl overflow-hidden border border-border shadow-sm flex items-center justify-center ${sizingClass}`}
        style={{ ...sizingStyle, background: "hsl(var(--muted))" }}
      >
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/60 to-muted" />
        <div className="relative flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex flex-col items-center gap-2 w-40">
            <div className="h-3 w-full rounded bg-foreground/10 animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-foreground/10 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-foreground/10 animate-pulse" />
          </div>
          <span className="text-[10px] font-ui font-semibold uppercase tracking-[0.2em]">
            Generating
          </span>
        </div>
      </div>
    );
  }

  // Headlines is special: render a list of options
  if (meta.id === "headlines") {
    const headlines = (creative.copy_text || creative.headline || "")
      .split(/\n+/)
      .map((h) => h.replace(/^\s*\d+[\).\s-]*\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 6);

    return (
      <div
        className={`relative w-full rounded-2xl overflow-hidden border border-border shadow-sm p-8 md:p-10 flex flex-col animate-fade-in ${sizingClass}`}
        style={{ ...sizingStyle, background: meta.background, color: meta.foreground }}
      >
        <div className="flex items-center justify-between mb-6">
          <Icon size={22} />
          <span className="text-[11px] font-ui font-semibold uppercase tracking-wider opacity-80">
            {brandName}
          </span>
        </div>
        <div className="flex-1 flex flex-col justify-center gap-3">
          {headlines.length > 0 ? (
            headlines.map((h, i) => (
              <p
                key={i}
                className="font-display text-xl md:text-2xl leading-tight"
              >
                ✦ {h}
              </p>
            ))
          ) : (
            <p className="font-display text-xl opacity-70">No headlines generated</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-border shadow-sm p-8 md:p-12 flex flex-col animate-fade-in ${sizingClass}`}
      style={{ ...sizingStyle, background: meta.background, color: meta.foreground }}
    >
      {/* Top row: icon + brand */}
      <div className="flex items-center justify-between">
        <Icon size={26} strokeWidth={2} />
        <span className="text-[11px] font-ui font-semibold uppercase tracking-wider opacity-80">
          {brandName}
        </span>
      </div>

      {/* Centre: headline (large, prominent) */}
      <div className="flex-1 flex items-center justify-center text-center py-8">
        <p
          className="font-display font-bold leading-[1.05] text-3xl md:text-5xl lg:text-6xl"
          style={{ color: meta.foreground }}
        >
          {creative.headline ||
            (creative.copy_text || "").split(/[.!?\n]/)[0]?.slice(0, 90) ||
            "Untitled creative"}
        </p>
      </div>

      {/* Subject line for email */}
      {meta.id === "email" && creative.subject_line && (
        <p
          className="text-[11px] font-ui font-semibold uppercase tracking-wider text-center mb-3 opacity-90"
        >
          Subject: {creative.subject_line}
        </p>
      )}

      {/* Bottom: CTA */}
      <div className="flex items-center justify-center mt-auto">
        <span
          className="inline-flex items-center px-6 py-3 rounded-full text-[14px] font-ui font-semibold"
          style={{ background: meta.ctaBg, color: meta.ctaFg }}
        >
          {cta || "Learn more"} →
        </span>
      </div>
    </div>
  );
}

// ───────────────────────── Status dot/badge ─────────────────────────

function StatusBadge({ status }: { status: CreativeStatus }) {
  const map: Record<CreativeStatus, { label: string; cls: string; dot: string }> = {
    generating: {
      label: "Generating",
      cls: "bg-primary/10 text-primary border-primary/20",
      dot: "bg-primary animate-pulse",
    },
    ready: {
      label: "Ready",
      cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      dot: "bg-emerald-500",
    },
    failed: {
      label: "Failed",
      cls: "bg-destructive/10 text-destructive border-destructive/20",
      dot: "bg-destructive",
    },
  };
  const m = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-ui font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${m.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ───────────────────────── Inline scheduler ─────────────────────────

function nextDays() {
  const out: { label: string; date: Date }[] = [];
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    out.push({
      label:
        d.toLocaleDateString("en-GB", { weekday: "short" }) + " " + d.getDate(),
      date: d,
    });
  }
  return out;
}

const TIME_SLOTS = ["09:00", "12:00", "15:00", "17:00", "20:00"];

function SchedulerPopover({
  onConfirm,
  onCancel,
}: {
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}) {
  const days = useMemo(() => nextDays(), []);
  const [selDay, setSelDay] = useState(0);
  const [selTime, setSelTime] = useState("09:00");

  const handleConfirm = () => {
    const [h, m] = selTime.split(":").map(Number);
    const d = new Date(days[selDay].date);
    d.setHours(h, m, 0, 0);
    onConfirm(d);
  };

  return (
    <div className="absolute bottom-full mb-2 right-0 w-[280px] rounded-xl border border-border bg-card shadow-xl p-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
      <p className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2">
        Date
      </p>
      <div className="flex gap-1.5 flex-wrap mb-3">
        {days.map((d, i) => (
          <button
            key={i}
            onClick={() => setSelDay(i)}
            className={`text-[11px] font-ui px-2 py-1 rounded-full transition-colors ${
              selDay === i
                ? "bg-primary text-primary-foreground"
                : "border border-border text-foreground hover:bg-muted/50"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2">
        Time
      </p>
      <select
        value={selTime}
        onChange={(e) => setSelTime(e.target.value)}
        className="w-full h-8 rounded-md border border-input bg-background px-2 text-[12px] font-ui text-foreground mb-3"
      >
        {TIME_SLOTS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 h-8 rounded-md border border-border text-[12px] font-ui text-foreground hover:bg-muted/50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 h-8 rounded-md bg-primary text-primary-foreground text-[12px] font-ui font-medium hover:bg-primary/90 transition-colors"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── Copy panel (right column) ─────────────────────────

function CopyPanel({
  meta,
  creative,
  status,
  regenerating,
  onCopyChange,
  onRegenerate,
  onSchedule,
  onSaveLibrary,
  onDownload,
  onPreview,
}: {
  meta: PlatformMeta;
  creative: Creative;
  status: CreativeStatus;
  regenerating: boolean;
  onCopyChange: (text: string) => void;
  onRegenerate: () => void;
  onSchedule: (date: Date) => void;
  onSaveLibrary: () => void;
  onDownload: () => void;
  onPreview: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(creative.copy_text ?? "");

  useEffect(() => {
    setDraft(creative.copy_text ?? "");
  }, [creative.id, creative.copy_text]);

  const text = draft || "";
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const charCount = text.length;

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    onCopyChange(draft);
    setEditing(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: meta.dot }}
          />
          <h4 className="text-[12px] font-ui font-semibold uppercase tracking-wider text-foreground">
            {meta.name}
          </h4>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Subject (email only) */}
      {meta.id === "email" && creative.subject_line && (
        <div className="mb-3 pb-3 border-b border-border">
          <p
            className="text-[10px] font-ui font-semibold uppercase tracking-wider mb-1"
            style={{ color: "#D4A017" }}
          >
            Subject
          </p>
          <p className="text-[13px] font-ui font-medium text-foreground">
            {creative.subject_line}
          </p>
        </div>
      )}

      {/* Headline */}
      {creative.headline && meta.id !== "headlines" && (
        <p className="font-display text-base font-bold text-foreground mb-3 leading-tight">
          {creative.headline}
        </p>
      )}

      {/* Copy body */}
      <div className="flex-1 min-h-0">
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full h-full min-h-[200px] text-[13px] font-ui text-foreground bg-background border border-input rounded-lg p-3 outline-none focus:ring-2 focus:ring-ring resize-y leading-relaxed"
          />
        ) : (
          <p className="text-[13px] font-ui text-foreground/85 whitespace-pre-wrap leading-relaxed">
            {text || (
              <span className="text-muted-foreground italic">
                {status === "generating" ? "Generating…" : "No copy generated"}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Counts */}
      <div className="flex items-center gap-3 text-[11px] font-ui text-muted-foreground mt-3">
        <span>{wordCount} words</span>
        <span>·</span>
        <span>{charCount} chars</span>
        <div className="ml-auto flex items-center gap-3">
          {editing ? (
            <button
              onClick={handleSaveEdit}
              className="text-primary hover:underline"
            >
              Save edit
            </button>
          ) : (
            text && (
              <button
                onClick={() => setEditing(true)}
                className="text-primary hover:underline"
              >
                Edit text
              </button>
            )
          )}
          <button
            onClick={onPreview}
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <Eye size={11} /> Preview
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 gap-2 mt-4 pt-4 border-t border-border">
        <button
          onClick={handleCopy}
          disabled={!text}
          className="text-[12px] font-ui px-3 py-2 rounded-md border border-border text-foreground hover:bg-muted/50 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy text"}
        </button>
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="text-[12px] font-ui px-3 py-2 rounded-md border border-primary text-primary hover:bg-primary/10 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {regenerating ? (
            <span className="h-2.5 w-2.5 rounded-full bg-current/40 animate-pulse" />
          ) : (
            <RefreshCw size={13} />
          )}
          {regenerating ? "Regenerating…" : "Regenerate this"}
        </button>
        <button
          onClick={onSaveLibrary}
          className="text-[12px] font-ui px-3 py-2 rounded-md border border-border text-foreground hover:bg-muted/50 flex items-center justify-center gap-1.5 transition-colors"
        >
          <Bookmark size={13} /> Save to Library
        </button>
        <button
          onClick={onDownload}
          className="text-[12px] font-ui px-3 py-2 rounded-md border border-border text-foreground hover:bg-muted/50 flex items-center justify-center gap-1.5 transition-colors"
        >
          <Download size={13} /> Download creative
        </button>
        <div className="relative">
          <button
            onClick={() => setShowScheduler((v) => !v)}
            className="w-full text-[12px] font-ui px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1.5 transition-colors"
          >
            <CalendarPlus size={13} />
            {creative.scheduled_at
              ? `Scheduled · ${new Date(creative.scheduled_at).toLocaleDateString(
                  "en-GB",
                  { weekday: "short", day: "numeric", month: "short" }
                )}`
              : "Save to Calendar"}
          </button>
          {showScheduler && (
            <SchedulerPopover
              onCancel={() => setShowScheduler(false)}
              onConfirm={(d) => {
                onSchedule(d);
                setShowScheduler(false);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Preview Modal ─────────────────────────

function PreviewModal({
  creatives,
  startIndex,
  brandName,
  cta,
  onClose,
}: {
  creatives: Creative[];
  startIndex: number;
  brandName: string;
  cta: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    setIndex(startIndex);
  }, [startIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft")
        setIndex((i) => (i - 1 + PLATFORMS.length) % PLATFORMS.length);
      if (e.key === "ArrowRight")
        setIndex((i) => (i + 1) % PLATFORMS.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const meta = PLATFORMS[index];
  const creative =
    creatives.find((c) => c.platform === meta.id) ?? {
      id: `placeholder-${meta.id}`,
      platform: meta.id,
      headline: null,
      copy_text: null,
      subject_line: null,
      status: "failed" as CreativeStatus,
    };
  const status = creative.status ?? "ready";

  const goPrev = () =>
    setIndex((i) => (i - 1 + PLATFORMS.length) % PLATFORMS.length);
  const goNext = () => setIndex((i) => (i + 1) % PLATFORMS.length);

  return (
    <div
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-8 h-14 border-b border-border">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: meta.dot }}
          />
          <span className="text-[13px] font-ui font-semibold text-foreground">
            {meta.name}
          </span>
          <span className="text-[12px] font-ui text-muted-foreground ml-2">
            {index + 1} / {PLATFORMS.length}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="h-9 w-9 rounded-full border border-border hover:bg-muted/50 flex items-center justify-center transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 grid grid-cols-[56px_1fr_56px] items-stretch">
        <button
          onClick={goPrev}
          aria-label="Previous platform"
          className="flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <ChevronLeft size={28} />
        </button>

        <div className="overflow-y-auto px-4 md:px-10 py-8">
          <div className="max-w-3xl mx-auto flex flex-col gap-6">
            {/* Full-size visual */}
            <div className="w-full">
              <VisualCreativeCard
                meta={meta}
                creative={creative}
                brandName={brandName}
                cta={cta}
                status={status}
              />
            </div>

            {/* Copy block */}
            <div className="rounded-2xl border border-border bg-card p-6">
              {meta.id === "email" && creative.subject_line && (
                <div className="mb-4 pb-4 border-b border-border">
                  <p
                    className="text-[10px] font-ui font-semibold uppercase tracking-wider mb-1"
                    style={{ color: "#D4A017" }}
                  >
                    Subject
                  </p>
                  <p className="text-[15px] font-ui font-medium text-foreground">
                    {creative.subject_line}
                  </p>
                </div>
              )}
              {creative.headline && meta.id !== "headlines" && (
                <p className="font-display text-xl font-bold text-foreground mb-3 leading-tight">
                  {creative.headline}
                </p>
              )}
              <p className="text-[14px] font-ui text-foreground/85 whitespace-pre-wrap leading-relaxed">
                {creative.copy_text || (
                  <span className="text-muted-foreground italic">
                    {status === "generating"
                      ? "Generating…"
                      : "No copy generated"}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={goNext}
          aria-label="Next platform"
          className="flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <ChevronRight size={28} />
        </button>
      </div>

      {/* Footer dots */}
      <div className="border-t border-border h-12 flex items-center justify-center gap-2">
        {PLATFORMS.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setIndex(i)}
            aria-label={`Show ${p.name}`}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6" : "w-2 opacity-40 hover:opacity-70"
            }`}
            style={{ background: p.dot }}
          />
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── Page ─────────────────────────

export default function CampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { activeBrand, activeBrandDNA } = useBrand();

  const [loading, setLoading] = useState(true);
  const [regenAll, setRegenAll] = useState(false);
  const [regenPlatform, setRegenPlatform] = useState<PlatformId | null>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [activeTab, setActiveTab] = useState<PlatformId>("headlines");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [autogenStarted, setAutogenStarted] = useState(false);

  const load = async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const data = await getCampaignWithCreatives(campaignId);
      setCampaign(data);
      const rows: Creative[] = data.campaign_creatives ?? [];
      const byPlatform = new Map(rows.map((r) => [r.platform, r]));
      const ordered: Creative[] = PLATFORMS.map((p): Creative => {
        const found = byPlatform.get(p.id);
        if (found) {
          const hasContent = Boolean(
            found.copy_text || found.headline || found.subject_line
          );
          return { ...found, status: hasContent ? "ready" : "failed" };
        }
        return {
          id: `placeholder-${p.id}`,
          platform: p.id,
          headline: null,
          copy_text: null,
          subject_line: null,
          status: "failed",
        };
      });
      setCreatives(ordered);
    } catch (err: any) {
      toast.error(err.message || "Failed to load campaign");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const updateCreative = (platform: string, updates: Partial<Creative>) => {
    setCreatives((prev) =>
      prev.map((c) => (c.platform === platform ? { ...c, ...updates } : c))
    );
  };

  const handleRegenerateAll = async () => {
    if (!campaignId || !campaign) return;
    setRegenAll(true);
    // Optimistically mark all as generating
    setCreatives((prev) => prev.map((c) => ({ ...c, status: "generating" })));
    try {
      await db.from("campaign_creatives").delete().eq("campaign_id", campaignId);
      const brief = {
        productName: campaign.product_name,
        targetAudience: campaign.target_audience,
        campaignGoal: campaign.campaign_goal,
        tone: campaign.tone,
        keyBenefit: campaign.key_benefit,
        callToAction: campaign.call_to_action,
      };
      await generateCampaignCreatives(campaignId, brief, activeBrandDNA);
      await load();
      toast.success("Campaign regenerated");
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate");
      await load();
    } finally {
      setRegenAll(false);
    }
  };

  const handleRegeneratePlatform = async (platform: PlatformId) => {
    if (!campaignId || !campaign) return;
    setRegenPlatform(platform);
    updateCreative(platform, { status: "generating" });
    try {
      const brief = {
        product_name: campaign.product_name,
        target_audience: campaign.target_audience,
        campaign_goal: campaign.campaign_goal,
        tone: campaign.tone,
        key_benefit: campaign.key_benefit,
        call_to_action: campaign.call_to_action,
      };
      const result = await regenerateCampaignPlatform(
        campaignId,
        platform,
        brief,
        activeBrandDNA
      );
      updateCreative(platform, {
        id: result.id,
        headline: result.headline || null,
        copy_text: result.copy_text || null,
        subject_line: result.subject_line || null,
        status: "ready",
      });
      toast.success(`${PLATFORM_BY_ID[platform].name} regenerated`);
    } catch (err: any) {
      updateCreative(platform, { status: "failed" });
      toast.error(err.message || "Failed to regenerate");
    } finally {
      setRegenPlatform(null);
    }
  };

  const handleSchedule = async (creativeId: string, platform: string, date: Date) => {
    if (creativeId.startsWith("placeholder-")) {
      toast.error("Generate this creative before scheduling");
      return;
    }
    try {
      await scheduleCreative(creativeId, date);
      updateCreative(platform, { scheduled_at: date.toISOString() });
      toast.success(
        `Scheduled for ${date.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })} at ${date.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule");
    }
  };

  const handleEditCopy = async (id: string, platform: string, copy_text: string) => {
    if (id.startsWith("placeholder-")) return;
    try {
      const { error } = await db
        .from("campaign_creatives")
        .update({ copy_text })
        .eq("id", id);
      if (error) throw error;
      updateCreative(platform, { copy_text });
      toast.success("Saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
  };

  // ── Background per-platform generation (fresh campaigns) ──
  const runBackgroundGeneration = useCallback(
    async (campaignRow: any) => {
      if (!campaignId) return;
      // Mark all 8 as generating
      setCreatives((prev) =>
        prev.map((c) => ({ ...c, status: "generating" as CreativeStatus }))
      );
      const brief = {
        product_name: campaignRow.product_name,
        target_audience: campaignRow.target_audience,
        campaign_goal: campaignRow.campaign_goal,
        tone: campaignRow.tone,
        key_benefit: campaignRow.key_benefit,
        call_to_action: campaignRow.call_to_action,
      };
      // Fire all 8 in parallel; each updates its own card on completion
      await Promise.all(
        PLATFORMS.map(async (p) => {
          try {
            const result = await regenerateCampaignPlatform(
              campaignId,
              p.id,
              brief,
              activeBrandDNA
            );
            updateCreative(p.id, {
              id: result.id,
              headline: result.headline || null,
              copy_text: result.copy_text || null,
              subject_line: result.subject_line || null,
              status: "ready",
            });
          } catch (err) {
            console.error(`Failed to generate ${p.id}:`, err);
            updateCreative(p.id, { status: "failed" });
          }
        })
      );
      try {
        sessionStorage.removeItem(`campaign:autogen:${campaignId}`);
      } catch {}
      toast.success("Campaign creatives ready");
    },
    [campaignId, activeBrandDNA]
  );

  // After initial load: if autogen flag set and no real creatives yet, kick off generation
  useEffect(() => {
    if (loading || !campaign || autogenStarted) return;
    let shouldAutogen = false;
    try {
      shouldAutogen =
        !!campaignId &&
        sessionStorage.getItem(`campaign:autogen:${campaignId}`) === "1";
    } catch {}
    const hasAnyContent = creatives.some(
      (c) =>
        !c.id.startsWith("placeholder-") &&
        (c.copy_text || c.headline || c.subject_line)
    );
    if (shouldAutogen && !hasAnyContent) {
      setAutogenStarted(true);
      void runBackgroundGeneration(campaign);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, campaign]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex flex-col min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-7xl w-full mx-auto px-4 md:px-6 py-6">
          <div className="h-5 w-32 rounded bg-muted animate-pulse mb-4" />
          <div className="h-14 rounded-xl bg-muted animate-pulse mb-4" />
          <div className="h-10 rounded-xl bg-muted animate-pulse mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 aspect-[4/5] rounded-2xl bg-muted animate-pulse" />
            <div className="lg:col-span-2 h-[600px] rounded-2xl bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground font-ui">Campaign not found</p>
        <button
          onClick={() => navigate("/campaign-kit")}
          className="text-[13px] font-ui text-primary hover:underline"
        >
          Back to campaigns
        </button>
      </div>
    );
  }

  const activeCreative =
    creatives.find((c) => c.platform === activeTab) ?? creatives[0];
  const activeMeta = PLATFORM_BY_ID[activeTab];
  const readyCount = creatives.filter((c) => c.status === "ready").length;
  const brandName = activeBrand?.name || campaign.product_name || "Brand";

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-24">
      <div className="max-w-7xl w-full mx-auto px-4 md:px-6 py-6">
        {/* Back link */}
        <button
          onClick={() => navigate("/campaign-kit")}
          className="flex items-center gap-1.5 text-[12px] font-ui text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> Back to campaigns
        </button>

        {/* Title */}
        <div className="mb-4">
          <h1 className="font-display text-2xl text-foreground mb-1 truncate">
            {campaign.name}
          </h1>
          <p className="text-[13px] font-ui text-muted-foreground">
            {campaign.product_name}
            {campaign.target_audience ? ` · ${campaign.target_audience}` : ""}
          </p>
        </div>

        {/* Summary bar */}
        <div className="h-14 rounded-xl border border-border bg-card flex items-center px-4 gap-3 mb-4">
          {campaign.campaign_goal && (
            <span className="text-[12px] font-ui px-2.5 py-1 rounded-full border border-border bg-muted/50 text-foreground">
              {campaign.campaign_goal}
            </span>
          )}
          {campaign.tone && (
            <span className="text-[12px] font-ui px-2.5 py-1 rounded-full border border-border bg-muted/50 text-foreground">
              {campaign.tone}
            </span>
          )}
          <button
            onClick={() => navigate("/campaign-kit")}
            className="text-[12px] font-ui text-primary hover:underline ml-2"
          >
            Edit brief
          </button>
          <div className="flex-1" />
          <button
            onClick={handleRegenerateAll}
            disabled={regenAll}
            className="text-[12px] font-ui px-3 py-1.5 rounded-md border border-primary text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {regenAll ? (
              <span className="h-2 w-2 rounded-full bg-current/40 animate-pulse" />
            ) : (
              <RefreshCw size={12} />
            )}
            Regenerate all
          </button>
        </div>

        {/* Platform tab strip */}
        <div className="border-b border-border mb-6 -mx-1 px-1 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {PLATFORMS.map((p) => {
              const c = creatives.find((x) => x.platform === p.id);
              const isActive = activeTab === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveTab(p.id)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-[12px] font-ui transition-colors ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      c?.status === "generating" ? "animate-pulse" : ""
                    }`}
                    style={{ background: p.dot }}
                  />
                  <span className="font-medium whitespace-nowrap">{p.name}</span>
                  {isActive && (
                    <span
                      className="absolute left-2 right-2 -bottom-px h-0.5 rounded-t"
                      style={{ background: p.dot }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Two-column main */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Visual creative — ~60% */}
          <div className="lg:col-span-3">
            <VisualCreativeCard
              meta={activeMeta}
              creative={activeCreative}
              brandName={brandName}
              cta={campaign.call_to_action || "Learn more"}
              status={activeCreative.status ?? "ready"}
            />
          </div>

          {/* Copy panel — ~40% */}
          <div className="lg:col-span-2">
            <CopyPanel
              meta={activeMeta}
              creative={activeCreative}
              status={activeCreative.status ?? "ready"}
              regenerating={regenPlatform === activeTab}
              onCopyChange={(text) =>
                handleEditCopy(activeCreative.id, activeCreative.platform, text)
              }
              onRegenerate={() => handleRegeneratePlatform(activeTab)}
              onSchedule={(d) =>
                handleSchedule(activeCreative.id, activeCreative.platform, d)
              }
              onSaveLibrary={() => toast.success("Saved to Library")}
              onDownload={() => toast.success("Download started")}
            />
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-7xl w-full mx-auto px-4 md:px-6 h-16 flex items-center gap-3">
          <span className="text-[12px] font-ui text-muted-foreground">
            <strong className="text-foreground font-semibold">
              {readyCount}
            </strong>{" "}
            of {PLATFORMS.length} creatives ready
          </span>
          <div className="flex-1" />
          <button
            onClick={() => toast.success("Export started")}
            className="text-[12px] font-ui px-3 py-2 rounded-md border border-border text-foreground hover:bg-muted/50 flex items-center gap-1.5 transition-colors"
          >
            <Archive size={13} /> Export all as ZIP
          </button>
          <button
            onClick={() => toast.success("Saved all to Library")}
            className="text-[12px] font-ui px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 transition-colors"
          >
            <Bookmark size={13} /> Save all to Library
          </button>
        </div>
      </div>
    </div>
  );
}
