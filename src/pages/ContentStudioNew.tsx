import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Check } from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import { useAuth } from "@/contexts/AuthContext";
import { AssetPicker } from "@/components/campaignkit/AssetPicker";
import {
  getActivePlatforms,
  prefillBriefFromBrand,
  createBrief,
  generateContentForBrief,
} from "@/services/contentStudioService";
import { cn } from "@/lib/utils";

const goals = [
  "Build awareness",
  "Drive sales",
  "Launch product",
  "Grow following",
  "Educate audience",
  "Promote event",
];
const tones = [
  "Confident",
  "Warm and friendly",
  "Bold and direct",
  "Playful",
  "Professional",
  "Inspiring",
];
const intervals = [
  { value: "daily", label: "Daily" },
  { value: "every_48h", label: "Every 48h" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
];

export default function ContentStudioNew() {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [briefText, setBriefText] = useState("");
  const [campaignGoal, setCampaignGoal] = useState(goals[0]);
  const [tone, setTone] = useState(tones[0]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);
  const [isSeries, setIsSeries] = useState(false);
  const [seriesInterval, setSeriesInterval] = useState("weekly");
  const [asset, setAsset] = useState<{ id: string | null; type: "output" | "product_image" | null }>({
    id: null,
    type: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from brand
  useEffect(() => {
    (async () => {
      if (!activeBrand?.id) return;
      try {
        const [pf, pls] = await Promise.all([
          prefillBriefFromBrand(activeBrand.id),
          getActivePlatforms(),
        ]);
        setName(pf.name || `${activeBrand.name} — Content`);
        if (pf.tone && tones.includes(pf.tone)) setTone(pf.tone);
        setPlatforms(pls || []);
        setSelectedPlatformIds((pls || []).map((p: any) => p.id));
      } catch (e) {
        console.error("Prefill failed", e);
        setPlatforms([]);
      }
    })();
  }, [activeBrand?.id]);

  const togglePlatform = (id: string) => {
    setSelectedPlatformIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!activeBrand?.id || !user?.id) return;
    if (!name.trim()) {
      setError("Content name is required");
      return;
    }
    if (selectedPlatformIds.length === 0) {
      setError("Select at least one platform");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const briefId = await createBrief(activeBrand.id, user.id, {
        name: name.trim(),
        brief: briefText.trim() || undefined,
        campaign_goal: campaignGoal,
        tone,
        is_series: isSeries,
        series_interval: isSeries ? seriesInterval : undefined,
        selected_platform_ids: selectedPlatformIds,
      });
      // Trigger generation in background — editor page will poll
      try {
        sessionStorage.setItem(`content-studio:autogen:${briefId}`, "1");
      } catch {}
      generateContentForBrief(briefId).catch((e) =>
        console.error("Generation error", e)
      );
      navigate(`/content-studio/${briefId}`);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to create brief");
      setSubmitting(false);
    }
  };

  const credits = selectedPlatformIds.length;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      <button
        onClick={() => navigate("/content-studio")}
        className="flex items-center gap-1.5 text-[12px] font-ui text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Cancel
      </button>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        {/* LEFT — brief inputs */}
        <div className="space-y-6">
          <div>
            <h1 className="font-display text-2xl text-foreground">New content</h1>
            <p className="text-[13px] font-ui text-muted-foreground mt-1">
              {activeBrand?.name || "Brand"}
            </p>
          </div>

          {/* Name */}
          <Field label="Content name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring launch teaser"
              className="w-full h-11 rounded-lg border border-input bg-background px-3 text-[14px] font-ui text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
            />
          </Field>

          {/* Brief */}
          <Field label="What's this content for? (optional)">
            <textarea
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              placeholder="e.g. Welcome back to campus post — push the new hoodie collection"
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-[14px] font-ui text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </Field>

          {/* Goal + Tone */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Campaign goal">
              <select
                value={campaignGoal}
                onChange={(e) => setCampaignGoal(e.target.value)}
                className="w-full h-11 rounded-lg border border-input bg-background px-3 text-[14px] font-ui text-foreground focus:outline-none focus:border-primary transition-colors"
              >
                {goals.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tone">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full h-11 rounded-lg border border-input bg-background px-3 text-[14px] font-ui text-foreground focus:outline-none focus:border-primary transition-colors"
              >
                {tones.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex items-center gap-1.5 text-[12px] font-ui text-muted-foreground">
            <Sparkles size={12} className="text-primary" />
            <span>Using your brand context from Mentor</span>
          </div>

          {/* Platforms */}
          <Field label={`Platforms (${selectedPlatformIds.length} selected)`}>
            {platforms.length === 0 ? (
              <p className="text-[13px] font-ui text-muted-foreground">
                No active platforms configured. Ask your admin to enable some.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {platforms.map((p) => {
                  const selected = selectedPlatformIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlatform(p.id)}
                      className={cn(
                        "relative flex items-center gap-2 px-3 h-11 rounded-lg border text-[13px] font-ui transition-all",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                      )}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: p.brand_color || "#8A96A3" }}
                      />
                      <span className="truncate">{p.name}</span>
                      {selected && (
                        <Check
                          size={12}
                          className="text-primary ml-auto flex-shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          {/* Series toggle */}
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-ui text-[14px] font-medium text-foreground">
                  Content series
                </p>
                <p className="text-[12px] font-ui text-muted-foreground mt-0.5">
                  Auto-generate new content on a schedule
                </p>
              </div>
              <span
                onClick={() => setIsSeries(!isSeries)}
                className={cn(
                  "relative inline-block w-10 h-6 rounded-full transition-colors",
                  isSeries ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                    isSeries && "translate-x-4"
                  )}
                />
              </span>
            </label>
            {isSeries && (
              <div className="mt-4 space-y-2">
                <p className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider">
                  Frequency
                </p>
                <div className="flex flex-wrap gap-2">
                  {intervals.map((iv) => (
                    <button
                      key={iv.value}
                      type="button"
                      onClick={() => setSeriesInterval(iv.value)}
                      className={cn(
                        "h-9 px-3 rounded-md border text-[12px] font-ui transition-colors",
                        seriesInterval === iv.value
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40"
                      )}
                    >
                      {iv.label}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] font-ui text-muted-foreground mt-2">
                  AI will automatically generate new content at this interval and
                  notify you to review.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — asset picker + generate */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-3">
              Select an asset (optional)
            </p>
            <AssetPicker
              selectedId={asset.id}
              selectedType={asset.type}
              onSelect={(id, type) => setAsset({ id, type })}
              onSkip={() => setAsset({ id: null, type: null })}
            />
            <button
              type="button"
              onClick={() => setAsset({ id: null, type: null })}
              className="text-[12px] font-ui text-muted-foreground hover:text-primary mt-2 transition-colors"
            >
              Skip — use brand context only
            </button>
          </div>

          <button
            onClick={handleGenerate}
            disabled={submitting || selectedPlatformIds.length === 0}
            className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-ui text-[14px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Creating brief…"
              : `Generate content — uses ${credits} credit${credits === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
