import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, Pause, Play, Clock, FileText } from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import { getBriefs } from "@/services/contentStudioService";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

interface BriefRow {
  id: string;
  name: string;
  status: string | null;
  is_series: boolean | null;
  series_active: boolean | null;
  series_interval: string | null;
  next_generation_at: string | null;
  selected_platform_ids: string[] | null;
  created_at: string;
  content_studio_creatives: { id: string; status: string }[];
}

const intervalLabels: Record<string, string> = {
  daily: "Daily",
  every_48h: "Every 48h",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
  generating: { bg: "rgba(212,160,23,0.12)", color: "#D4A017", label: "Generating" },
  ready: { bg: "rgba(74,222,128,0.12)", color: "#4ADE80", label: "Ready" },
  approved: { bg: "rgba(74,222,128,0.16)", color: "#4ADE80", label: "Approved" },
  draft: { bg: "rgba(138,150,163,0.15)", color: "#8A96A3", label: "Draft" },
  scheduled: { bg: "rgba(45,74,62,0.4)", color: "#9DD8B8", label: "Scheduled" },
  failed: { bg: "rgba(220,38,38,0.12)", color: "#F87171", label: "Failed" },
};

function timeFromNow(iso: string | null) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  const mins = Math.round(ms / 60000);
  if (mins < 0) return "due now";
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}

export default function ContentStudio() {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [briefs, setBriefs] = useState<BriefRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!activeBrand?.id) return;
    setLoading(true);
    try {
      const data = await getBriefs(activeBrand.id);
      setBriefs(data || []);
    } catch (e) {
      console.error("Failed to load briefs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeBrand?.id]);

  const totalCreatives = briefs.reduce(
    (n, b) => n + (b.content_studio_creatives?.length || 0),
    0
  );
  const activeSeries = briefs.filter((b) => b.is_series && b.series_active);
  const recent = briefs.filter((b) => !b.is_series || !b.series_active).slice(0, 12);

  const togglePause = async (brief: BriefRow) => {
    const next = !brief.series_active;
    setBriefs((prev) =>
      prev.map((b) => (b.id === brief.id ? { ...b, series_active: next } : b))
    );
    await db
      .from("content_studio_briefs")
      .update({ series_active: next })
      .eq("id", brief.id);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="mt-3 h-4 w-96 bg-muted rounded animate-pulse" />
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-foreground">ContentStudio</h1>
          <p className="text-[13px] font-ui text-muted-foreground mt-1.5">
            Create and schedule content across all your platforms
          </p>
        </div>
        <button
          onClick={() => navigate("/content-studio/new")}
          className="h-11 px-5 rounded-lg bg-primary text-primary-foreground font-ui text-[14px] font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> New content
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-10">
        <Stat label="Briefs created" value={briefs.length} />
        <Stat label="Creatives generated" value={totalCreatives} />
        <Stat label="Active series" value={activeSeries.length} />
      </div>

      {briefs.length === 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={20} className="text-primary" />
          </div>
          <h3 className="font-display text-xl text-foreground mb-2">
            Create your first content brief
          </h3>
          <p className="text-[13px] font-ui text-muted-foreground max-w-md mx-auto mb-5">
            Tell us what you want to say and we will generate platform-ready
            visuals and copy from your brand context.
          </p>
          <button
            onClick={() => navigate("/content-studio/new")}
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            + New content
          </button>
        </div>
      )}

      {/* Active series */}
      {activeSeries.length > 0 && (
        <section className="mb-10">
          <h2 className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-4">
            Active series
          </h2>
          <div className="grid gap-3">
            {activeSeries.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-border bg-card p-5 flex items-center gap-4 hover:-translate-y-px hover:border-primary/40 transition-all"
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(212,160,23,0.1)" }}
                >
                  <Clock size={20} className="text-primary" />
                </div>
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/content-studio/${b.id}`)}
                >
                  <p className="font-ui text-[15px] font-medium text-foreground truncate">
                    {b.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-ui font-semibold"
                      style={{
                        background: "rgba(212,160,23,0.12)",
                        color: "#D4A017",
                      }}
                    >
                      {intervalLabels[b.series_interval || "weekly"]}
                    </span>
                    <span className="text-[12px] font-ui text-muted-foreground">
                      Next: {timeFromNow(b.next_generation_at)}
                    </span>
                    <span className="text-[12px] font-ui text-muted-foreground">
                      · {b.selected_platform_ids?.length || 0} platforms
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => togglePause(b)}
                  className="h-9 px-3 rounded-md border border-border text-[12px] font-ui text-foreground hover:bg-muted/40 flex items-center gap-1.5 transition-colors"
                >
                  {b.series_active ? <Pause size={13} /> : <Play size={13} />}
                  {b.series_active ? "Pause" : "Resume"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent content */}
      {recent.length > 0 && (
        <section>
          <h2 className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-4">
            Recent content
          </h2>
          <div className="grid gap-3">
            {recent.map((b) => {
              const ready = b.content_studio_creatives?.filter((c) => c.status === "ready").length || 0;
              const total = b.content_studio_creatives?.length || 0;
              const status = b.status || "draft";
              const s = statusStyle[status] || statusStyle.draft;
              return (
                <div
                  key={b.id}
                  onClick={() => navigate(`/content-studio/${b.id}`)}
                  className="rounded-xl border border-border bg-card p-5 cursor-pointer hover:-translate-y-px hover:border-primary/40 transition-all flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-ui text-[15px] font-medium text-foreground truncate">
                      {b.name}
                    </p>
                    <p className="text-[12px] font-ui text-muted-foreground mt-0.5">
                      {total} creatives · {ready} ready
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className="inline-block rounded-[10px] px-2.5 py-0.5 text-[11px] font-ui font-medium"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {s.label}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/content-studio/${b.id}`);
                      }}
                      className="text-[12px] font-ui text-primary hover:underline"
                    >
                      Open in Studio
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-2xl font-ui font-medium text-foreground">{value}</p>
      <p className="text-[11px] font-ui text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
