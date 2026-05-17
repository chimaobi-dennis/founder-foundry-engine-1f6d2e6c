import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Check,
  ChevronDown,
  ChevronRight,
  Wand2,
  Image,
  Shapes,
  Palette,
  Layers,
  Zap,
  Maximize2,
  Settings2,
  Coins,
} from "lucide-react";
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

const intervals = [
  { value: "daily", label: "Daily" },
  { value: "every_48h", label: "Every 48h" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
];

// AI Workspace Configuration Options
const visualDirections = [
  { id: "minimal", label: "Minimal", icon: "✦" },
  { id: "editorial", label: "Editorial", icon: "◈" },
  { id: "luxury", label: "Luxury", icon: "◆" },
  { id: "bold", label: "Bold", icon: "●" },
  { id: "organic", label: "Organic", icon: "❀" },
  { id: "futuristic", label: "Futuristic", icon: "◉" },
  { id: "corporate", label: "Corporate", icon: "▣" },
  { id: "genz", label: "Gen Z", icon: "★" },
  { id: "scandinavian", label: "Scandinavian", icon: "○" },
];

const visualAssets = [
  { id: "ai_generated", label: "AI-generated visuals" },
  { id: "brand_images", label: "Uploaded brand images" },
  { id: "product_photos", label: "Product photos" },
  { id: "svg_graphics", label: "SVG graphics" },
  { id: "illustrations", label: "Illustrations" },
  { id: "abstract_shapes", label: "Abstract shapes" },
];

const layoutComplexity = [
  { id: "simple", label: "Simple" },
  { id: "balanced", label: "Balanced" },
  { id: "advanced", label: "Advanced" },
  { id: "experimental", label: "Experimental" },
];

const creativeModes = [
  { id: "on_brand", label: "Stay on-brand", description: "Maintain brand consistency" },
  { id: "explore", label: "Explore variations", description: "Test creative variations" },
  { id: "experimental", label: "Experimental mutation", description: "Push creative boundaries" },
];

export default function ContentStudioNew() {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const { user } = useAuth();

  // Core fields
  const [name, setName] = useState("");
  const [briefText, setBriefText] = useState("");
  const [campaignGoal, setCampaignGoal] = useState(goals[0]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);
  const [isSeries, setIsSeries] = useState(false);
  const [seriesInterval, setSeriesInterval] = useState("weekly");

  // AI Workspace Configuration
  const [visualDirection, setVisualDirection] = useState<string>("balanced");
  const [selectedAssets, setSelectedAssets] = useState<string[]>(["product_photos", "brand_images"]);
  const [layoutComplexityLevel, setLayoutComplexityLevel] = useState<string>("balanced");
  const [creativeMode, setCreativeMode] = useState<string>("on_brand");
  const [aiFreedom, setAiFreedom] = useState(50); // 0-100
  const [imageDensity, setImageDensity] = useState(50); // 0-100

  // UI State
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
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
        setPlatforms(pls || []);
        setSelectedPlatformIds((pls || []).map((p: any) => p.id));
      } catch (e) {
        console.error("Prefill failed", e);
        setPlatforms([]);
      }
    })();
  }, [activeBrand?.id]);

  // Toggle asset selection
  const toggleAsset = (id: string) => {
    setSelectedAssets((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  // Calculate credits based on configuration
  const calculateCredits = () => {
    let credits = selectedPlatformIds.length;

    // Base multiplier from complexity
    const complexityMultipliers: Record<string, number> = {
      simple: 0.75,
      balanced: 1,
      advanced: 1.5,
      experimental: 2,
    };
    credits *= complexityMultipliers[layoutComplexityLevel] || 1;

    // AI-generated visuals add cost
    if (selectedAssets.includes("ai_generated")) {
      credits *= 1.5;
    }

    // SVG generation adds cost
    if (selectedAssets.includes("svg_graphics")) {
      credits += selectedPlatformIds.length * 0.5;
    }

    // Experimental mode adds cost
    if (creativeMode === "experimental") {
      credits *= 1.3;
    }

    // AI freedom above 70 adds cost
    if (aiFreedom > 70) {
      credits *= 1.2;
    }

    return Math.ceil(credits);
  };

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
        is_series: isSeries,
        series_interval: isSeries ? seriesInterval : undefined,
        selected_platform_ids: selectedPlatformIds,
        // AI Workspace Configuration
        visual_direction: visualDirection,
        visual_assets: selectedAssets,
        layout_complexity: layoutComplexityLevel,
        creative_mode: creativeMode,
        ai_freedom: aiFreedom,
        image_density: imageDensity,
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

  const credits = calculateCredits();

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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* LEFT — AI Workspace Configuration */}
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="font-display text-2xl text-foreground">AI Creative Workspace</h1>
            <p className="text-[13px] font-ui text-muted-foreground mt-1">
              {activeBrand?.name || "Brand"} • Configure your generation parameters
            </p>
          </div>

          {/* Core Brief Section */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Wand2 size={16} className="text-primary" />
              <h2 className="font-ui text-[14px] font-medium text-foreground">Content Brief</h2>
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
            <Field label="What is this content for?">
              <textarea
                value={briefText}
                onChange={(e) => setBriefText(e.target.value)}
                placeholder="e.g. Welcome back to campus post — push the new hoodie collection"
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-[14px] font-ui text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </Field>

            {/* Campaign Goal */}
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
          </div>

          {/* Platforms Section */}
          <div className="rounded-xl border border-border bg-card p-5">
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
                            : "border-border bg-background text-muted-foreground hover:border-muted-foreground/40"
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
          </div>

          {/* AI Configuration — Visual Direction */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Palette size={16} className="text-primary" />
              <h2 className="font-ui text-[14px] font-medium text-foreground">Visual Direction</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {visualDirections.map((dir) => (
                <button
                  key={dir.id}
                  type="button"
                  onClick={() => setVisualDirection(dir.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 h-10 rounded-full border text-[13px] font-ui transition-all",
                    visualDirection === dir.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground/40"
                  )}
                >
                  <span className="text-[14px]">{dir.icon}</span>
                  <span>{dir.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Configuration — Visual Assets */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Image size={16} className="text-primary" />
              <h2 className="font-ui text-[14px] font-medium text-foreground">Visual Assets</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visualAssets.map((asset) => (
                <label
                  key={asset.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    selectedAssets.includes(asset.id)
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-muted-foreground/40"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedAssets.includes(asset.id)}
                    onChange={() => toggleAsset(asset.id)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-[13px] font-ui text-foreground">{asset.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="flex items-center gap-2 text-[13px] font-ui text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 size={14} />
            <span>Advanced AI Configuration</span>
            {showAdvancedSettings ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {/* Advanced Settings Panel */}
          {showAdvancedSettings && (
            <div className="space-y-6 animate-in slide-in-from-top-2 duration-200">
              {/* Layout Complexity */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-primary" />
                  <h2 className="font-ui text-[14px] font-medium text-foreground">Layout Complexity</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {layoutComplexity.map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setLayoutComplexityLevel(level.id)}
                      className={cn(
                        "px-4 h-10 rounded-lg border text-[13px] font-ui transition-all",
                        layoutComplexityLevel === level.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-muted-foreground/40"
                      )}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Creative Mode */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-primary" />
                  <h2 className="font-ui text-[14px] font-medium text-foreground">Creative Mode</h2>
                </div>
                <div className="space-y-2">
                  {creativeModes.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setCreativeMode(mode.id)}
                      className={cn(
                        "w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-all",
                        creativeMode === mode.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:border-muted-foreground/40"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full border mt-0.5 transition-colors",
                        creativeMode === mode.id
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40"
                      )}>
                        {creativeMode === mode.id && (
                          <Check size={10} className="text-primary-foreground m-auto mt-0.5" />
                        )}
                      </div>
                      <div>
                        <p className="font-ui text-[14px] font-medium text-foreground">{mode.label}</p>
                        <p className="text-[12px] font-ui text-muted-foreground mt-0.5">{mode.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Freedom Slider */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Shapes size={16} className="text-primary" />
                  <h2 className="font-ui text-[14px] font-medium text-foreground">AI Freedom</h2>
                </div>
                <div className="px-1">
                  <div className="flex justify-between text-[11px] font-ui text-muted-foreground mb-2">
                    <span>Structured</span>
                    <span>Creative</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={aiFreedom}
                    onChange={(e) => setAiFreedom(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-center mt-2">
                    <span className="text-[12px] font-ui text-muted-foreground">{aiFreedom}%</span>
                  </div>
                </div>
              </div>

              {/* Image Density Slider */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Maximize2 size={16} className="text-primary" />
                  <h2 className="font-ui text-[14px] font-medium text-foreground">Image Density</h2>
                </div>
                <div className="px-1">
                  <div className="flex justify-between text-[11px] font-ui text-muted-foreground mb-2">
                    <span>Minimal visuals</span>
                    <span>Heavy visuals</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={imageDensity}
                    onChange={(e) => setImageDensity(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-center mt-2">
                    <span className="text-[12px] font-ui text-muted-foreground">{imageDensity}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Series Toggle */}
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

        {/* RIGHT — Credit Display + Asset + Generate */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* Real-time Credit Calculation */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Coins size={16} className="text-primary" />
              <h3 className="font-ui text-[13px] font-medium text-foreground">Credit Estimate</h3>
            </div>
            <div className="space-y-2 text-[12px] font-ui">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platforms ({selectedPlatformIds.length})</span>
                <span className="text-foreground">{selectedPlatformIds.length} credits</span>
              </div>
              {layoutComplexityLevel !== 'balanced' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Complexity ({layoutComplexityLevel})</span>
                  <span className="text-foreground">×{layoutComplexityLevel === 'simple' ? '0.75' : layoutComplexityLevel === 'advanced' ? '1.5' : '2'}</span>
                </div>
              )}
              {selectedAssets.includes('ai_generated') && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI visuals</span>
                  <span className="text-foreground">×1.5</span>
                </div>
              )}
              {selectedAssets.includes('svg_graphics') && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SVG generation</span>
                  <span className="text-foreground">+{selectedPlatformIds.length * 0.5}</span>
                </div>
              )}
              {creativeMode === 'experimental' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Experimental mode</span>
                  <span className="text-foreground">×1.3</span>
                </div>
              )}
              {aiFreedom > 70 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">High AI freedom</span>
                  <span className="text-foreground">×1.2</span>
                </div>
              )}
              <div className="border-t border-primary/20 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="font-display text-xl text-primary">{credits} credits</span>
                </div>
              </div>
            </div>
          </div>

          {/* Asset Picker */}
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

          {/* Brand Context Indicator */}
          <div className="flex items-center gap-1.5 text-[12px] font-ui text-muted-foreground px-1">
            <Sparkles size={12} className="text-primary" />
            <span>Using your brand context from Founder Intelligence</span>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={submitting || selectedPlatformIds.length === 0}
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-ui text-[15px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Sparkles size={16} className="animate-pulse" />
                Creating AI brief…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Wand2 size={16} />
                Generate Content
              </span>
            )}
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
