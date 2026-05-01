import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Download,
  RefreshCw,
  CalendarPlus,
  Plus,
  Loader2,
} from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import {
  getBriefWithCreatives,
  regenerateCreative,
  approveCreativeToCalendar,
} from "@/services/contentStudioService";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const db = supabase as any;

interface Creative {
  id: string;
  platform_id: string;
  headline: string | null;
  copy_text: string | null;
  subject_line: string | null;
  hashtags: string[] | null;
  visual_html: string | null;
  status: string | null;
  is_approved: boolean | null;
  scheduled_at: string | null;
  content_platforms: any;
}

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
  align = "right",
}: {
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  align?: "left" | "right";
}) {
  const days = useMemo(() => nextDays(), []);
  const [selDay, setSelDay] = useState(0);
  const [selTime, setSelTime] = useState("09:00");
  return (
    <div
      className={cn(
        "absolute bottom-full mb-2 w-[280px] rounded-xl border border-border bg-card shadow-xl p-4 z-50",
        align === "right" ? "right-0" : "left-0"
      )}
    >
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
          className="flex-1 h-8 rounded-md border border-border text-[12px] font-ui hover:bg-muted/50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            const [h, m] = selTime.split(":").map(Number);
            const d = new Date(days[selDay].date);
            d.setHours(h, m, 0, 0);
            onConfirm(d);
          }}
          className="flex-1 h-8 rounded-md bg-primary text-primary-foreground text-[12px] font-ui font-medium hover:bg-primary/90 transition-colors"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

export default function ContentStudioEditor() {
  const { briefId } = useParams<{ briefId: string }>();
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [brief, setBrief] = useState<any>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApproveAll, setShowApproveAll] = useState(false);
  const [showApproveOne, setShowApproveOne] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const pollRef = useRef<number | null>(null);

  const load = async () => {
    if (!briefId) return;
    try {
      const data = await getBriefWithCreatives(briefId);
      setBrief(data);
      const cs: Creative[] = data.content_studio_creatives || [];
      cs.sort(
        (a, b) =>
          (a.content_platforms?.sort_order ?? 0) -
          (b.content_platforms?.sort_order ?? 0)
      );
      setCreatives(cs);
      if (!activeId && cs.length) setActiveId(cs[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [briefId]);

  // Poll while any creative is still generating
  useEffect(() => {
    const generating =
      brief?.status === "generating" ||
      creatives.some((c) => c.status === "generating");
    if (!generating) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = window.setInterval(load, 3500);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [brief?.status, creatives]);

  const active = creatives.find((c) => c.id === activeId) || null;
  const readyCount = creatives.filter((c) => c.status === "ready").length;
  const approvedCount = creatives.filter((c) => c.is_approved).length;

  const updateCreativeLocal = (id: string, patch: Partial<Creative>) => {
    setCreatives((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const saveCopy = async (id: string, patch: Partial<Creative>) => {
    updateCreativeLocal(id, patch);
    await db.from("content_studio_creatives").update(patch).eq("id", id);
  };

  const handleRegenerateVisual = async () => {
    if (!active || !activeBrand?.id) return;
    setRegenerating(true);
    updateCreativeLocal(active.id, { status: "generating" });
    try {
      const html = await regenerateCreative(active.id, activeBrand.id);
      updateCreativeLocal(active.id, { visual_html: html, status: "ready" });
      toast.success("Visual regenerated");
    } catch (e: any) {
      toast.error(e.message || "Regeneration failed");
      updateCreativeLocal(active.id, { status: "ready" });
    } finally {
      setRegenerating(false);
    }
  };

  const handleApproveOne = async (date: Date) => {
    if (!active) return;
    setShowApproveOne(false);
    try {
      await approveCreativeToCalendar(active.id, date.toISOString());
      updateCreativeLocal(active.id, {
        is_approved: true,
        scheduled_at: date.toISOString(),
        status: "scheduled",
      });
      toast.success(`Scheduled for ${date.toLocaleString()}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to schedule");
    }
  };

  const handleApproveAll = async (date: Date) => {
    setShowApproveAll(false);
    const ready = creatives.filter((c) => c.status === "ready" && !c.is_approved);
    if (ready.length === 0) {
      toast.message("No ready creatives to approve");
      return;
    }
    try {
      await Promise.all(
        ready.map((c) => approveCreativeToCalendar(c.id, date.toISOString()))
      );
      toast.success(`${ready.length} creatives scheduled`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Bulk approve failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <p className="text-muted-foreground">Brief not found</p>
        <button
          onClick={() => navigate("/content-studio")}
          className="text-primary mt-4 hover:underline"
        >
          Back to ContentStudio
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-border bg-card px-4 md:px-6 h-14 flex items-center gap-4">
        <button
          onClick={() => navigate("/content-studio")}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-ui text-[14px] font-medium text-foreground truncate">
            {brief.name}
          </p>
        </div>
        <StatusPill
          label={
            brief.status === "generating"
              ? "Generating"
              : approvedCount > 0
              ? `${approvedCount} approved`
              : "Ready"
          }
          variant={brief.status === "generating" ? "amber" : "green"}
        />
        <button className="hidden md:flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-[12px] font-ui hover:bg-muted/50 transition-colors">
          <Download size={13} /> Export ZIP
        </button>
        <div className="relative">
          <button
            onClick={() => setShowApproveAll((v) => !v)}
            disabled={readyCount === 0}
            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-ui font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Approve all
          </button>
          {showApproveAll && (
            <SchedulerPopover
              align="right"
              onConfirm={handleApproveAll}
              onCancel={() => setShowApproveAll(false)}
            />
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[220px_1fr_360px]">
        {/* Platform sidebar */}
        <aside className="border-r border-border bg-card/30 overflow-y-auto p-3 hidden md:block">
          <p className="text-[10px] font-ui text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Platforms
          </p>
          <div className="space-y-0.5">
            {creatives.map((c) => {
              const meta = c.content_platforms;
              const selected = activeId === c.id;
              const status = c.status || "ready";
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-[13px] font-ui transition-colors",
                    selected
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: meta?.brand_color || "#8A96A3" }}
                  />
                  <span className="flex-1 truncate">{meta?.name || "Platform"}</span>
                  <StatusDot status={status} approved={!!c.is_approved} />
                </button>
              );
            })}
          </div>
          <button className="w-full mt-3 h-8 px-2.5 rounded-md border border-dashed border-border text-[12px] font-ui text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors flex items-center gap-1.5">
            <Plus size={12} /> Add platform
          </button>
        </aside>

        {/* Canvas */}
        <div className="overflow-auto p-4 md:p-8 bg-muted/20 flex items-center justify-center">
          {!active ? (
            <p className="text-muted-foreground text-sm">No creative selected</p>
          ) : active.status === "generating" ? (
            <div className="w-full max-w-[480px] aspect-square rounded-xl border border-border bg-card flex flex-col items-center justify-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <p className="text-[12px] font-ui font-semibold text-primary uppercase tracking-wider">
                Generating
              </p>
              <p className="text-[12px] font-ui text-muted-foreground">
                {active.content_platforms?.name}
              </p>
            </div>
          ) : active.visual_html ? (
            <div
              className="rounded-xl overflow-hidden border border-border bg-card shadow-sm"
              style={{
                width: active.content_platforms?.image_width || 600,
                maxWidth: "100%",
                aspectRatio: `${active.content_platforms?.image_width || 1} / ${
                  active.content_platforms?.image_height || 1
                }`,
              }}
            >
              <iframe
                title={active.content_platforms?.name}
                srcDoc={active.visual_html}
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No visual generated yet</p>
          )}
        </div>

        {/* Copy editor */}
        <aside className="border-l border-border bg-card overflow-y-auto p-5 hidden md:flex flex-col">
          {!active ? (
            <p className="text-muted-foreground text-sm">Select a platform</p>
          ) : (
            <CopyEditor
              creative={active}
              onChange={(patch) => updateCreativeLocal(active.id, patch)}
              onSave={(patch) => saveCopy(active.id, patch)}
              onRegenerateVisual={handleRegenerateVisual}
              regenerating={regenerating}
              onApproveClick={() => setShowApproveOne((v) => !v)}
              showApproveScheduler={showApproveOne}
              onApproveConfirm={handleApproveOne}
              onApproveCancel={() => setShowApproveOne(false)}
            />
          )}
        </aside>
      </div>

      {/* Bottom bar */}
      <div className="flex-shrink-0 border-t border-border bg-card px-4 md:px-6 h-12 flex items-center text-[12px] font-ui text-muted-foreground">
        <span>
          {readyCount} of {creatives.length} platforms ready
        </span>
        <div className="flex-1" />
        <button className="hidden md:flex items-center gap-1.5 px-3 h-8 rounded-md border border-border hover:bg-muted/40 transition-colors">
          <Download size={13} /> Export all as ZIP
        </button>
      </div>
    </div>
  );
}

function CopyEditor({
  creative,
  onChange,
  onSave,
  onRegenerateVisual,
  regenerating,
  onApproveClick,
  showApproveScheduler,
  onApproveConfirm,
  onApproveCancel,
}: {
  creative: Creative;
  onChange: (patch: Partial<Creative>) => void;
  onSave: (patch: Partial<Creative>) => void;
  onRegenerateVisual: () => void;
  regenerating: boolean;
  onApproveClick: () => void;
  showApproveScheduler: boolean;
  onApproveConfirm: (d: Date) => void;
  onApproveCancel: () => void;
}) {
  const meta = creative.content_platforms;
  const limit = meta?.character_limit || null;
  const isEmail = meta?.slug === "email";
  const isSocial = ["instagram", "twitter_x", "facebook_ad"].includes(
    meta?.slug || ""
  );
  const charCount = (creative.copy_text || "").length;
  const wordCount = (creative.copy_text || "").trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: meta?.brand_color || "#8A96A3" }}
        />
        <h3 className="font-ui text-[13px] font-semibold text-foreground uppercase tracking-wider">
          {meta?.name}
        </h3>
        <div className="ml-auto">
          <StatusDot status={creative.status || "ready"} approved={!!creative.is_approved} />
        </div>
      </div>

      {isEmail && (
        <Field label="Subject line">
          <input
            value={creative.subject_line || ""}
            onChange={(e) => onChange({ subject_line: e.target.value })}
            onBlur={(e) => onSave({ subject_line: e.target.value })}
            className="w-full h-10 rounded-md border border-input bg-background px-2.5 text-[13px] font-ui"
          />
        </Field>
      )}

      <Field label="Headline">
        <input
          value={creative.headline || ""}
          onChange={(e) => onChange({ headline: e.target.value })}
          onBlur={(e) => onSave({ headline: e.target.value })}
          className="w-full h-10 rounded-md border border-input bg-background px-2.5 text-[13px] font-ui"
        />
      </Field>

      <Field label="Copy">
        <textarea
          value={creative.copy_text || ""}
          onChange={(e) => onChange({ copy_text: e.target.value })}
          onBlur={(e) => onSave({ copy_text: e.target.value })}
          rows={6}
          className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-[13px] font-ui resize-none"
        />
        <div className="flex items-center justify-between mt-1.5 text-[11px] font-ui text-muted-foreground">
          <span>{wordCount} words</span>
          <span className={cn(limit && charCount > limit && "text-destructive")}>
            {charCount}
            {limit ? ` / ${limit}` : ""} chars
          </span>
        </div>
      </Field>

      {isSocial && (
        <Field label="Hashtags">
          <div className="flex flex-wrap gap-1.5">
            {(creative.hashtags || []).map((h, i) => (
              <span
                key={i}
                className="text-[11px] font-ui px-2 py-1 rounded-full bg-primary/10 text-primary"
              >
                #{h.replace(/^#/, "")}
              </span>
            ))}
            {(!creative.hashtags || creative.hashtags.length === 0) && (
              <span className="text-[12px] font-ui text-muted-foreground">
                No hashtags
              </span>
            )}
          </div>
        </Field>
      )}

      <div className="mt-auto pt-4 space-y-2">
        <button
          onClick={onRegenerateVisual}
          disabled={regenerating}
          className="w-full h-9 rounded-md border border-border text-[12px] font-ui hover:bg-muted/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {regenerating ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          Regenerate visual
        </button>
        <div className="relative">
          <button
            onClick={onApproveClick}
            disabled={creative.status !== "ready" || !!creative.is_approved}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-[13px] font-ui font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <CalendarPlus size={14} />
            {creative.is_approved ? "Approved" : "Approve & Schedule"}
          </button>
          {showApproveScheduler && (
            <SchedulerPopover
              align="right"
              onConfirm={onApproveConfirm}
              onCancel={onApproveCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[10px] font-ui text-muted-foreground uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusDot({ status, approved }: { status: string; approved: boolean }) {
  if (approved) return <Check size={12} className="text-emerald-500" />;
  if (status === "generating")
    return <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />;
  if (status === "ready")
    return <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />;
  if (status === "failed")
    return <span className="w-1.5 h-1.5 rounded-full bg-destructive" />;
  return <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />;
}

function StatusPill({
  label,
  variant,
}: {
  label: string;
  variant: "amber" | "green";
}) {
  const styles =
    variant === "amber"
      ? { bg: "rgba(212,160,23,0.12)", color: "#D4A017" }
      : { bg: "rgba(74,222,128,0.12)", color: "#4ADE80" };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-ui font-medium px-2 py-0.5 rounded-full"
      style={{ background: styles.bg, color: styles.color }}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          variant === "amber" ? "animate-pulse" : ""
        )}
        style={{ background: styles.color }}
      />
      {label}
    </span>
  );
}
