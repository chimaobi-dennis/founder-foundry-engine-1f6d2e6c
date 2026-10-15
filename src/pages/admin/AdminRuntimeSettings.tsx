import { useState, useEffect, useCallback } from "react";
import { FadeIn } from "@/components/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Check, Monitor, Box } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  getSetting,
  setSetting,
  ensureDefaultSettings,
  type PlatformSetting,
} from "@/services/platformSettingsService";

// ═══════════════════════════════════════════════════════════════
// TYPES — reusable runtime setting definitions
// ═══════════════════════════════════════════════════════════════

interface SettingOption<T extends string = string> {
  value: T;
  label: string;
  description: string;
  icon: React.ReactNode;
  experimental?: boolean;
  experimentalNote?: string;
}

interface RuntimeSettingConfig<T extends string = string> {
  key: string;
  title: string;
  description: string;
  options: SettingOption<T>[];
  valueExtractor: (setting: PlatformSetting | null) => T;
  valueBuilder: (value: T) => Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// SETTING DEFINITIONS — add future settings here
// ═══════════════════════════════════════════════════════════════

const RENDER_ENGINE_SETTING: RuntimeSettingConfig<"html" | "scene"> = {
  key: "content_studio_generation",
  title: "Generation Engine",
  description:
    "Controls which rendering engine Content Studio uses to generate creatives.",
  options: [
    {
      value: "html",
      label: "HTML Renderer",
      description: "Generates creatives as styled HTML.",
      icon: <Monitor size={18} />,
    },
    {
      value: "scene",
      label: "Scene Renderer",
      description: "Generates creatives as Scene JSON documents.",
      icon: <Box size={18} />,
      experimental: true,
      experimentalNote:
        "Scene Renderer is experimental and uses the new Scene JSON engine.",
    },
  ],
  valueExtractor: (setting) => {
    const val = (setting?.setting_value as any)?.render_engine;
    return val === "scene" ? "scene" : "html";
  },
  valueBuilder: (value) => ({ render_engine: value }),
};

const ALL_SETTINGS: RuntimeSettingConfig<any>[] = [RENDER_ENGINE_SETTING];

// ═══════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════

const cardBg = { background: "#FFFFFF", border: "1px solid #DDE3EC" };

function RuntimeSettingSection<T extends string>({
  config,
}: {
  config: RuntimeSettingConfig<T>;
}) {
  const [currentValue, setCurrentValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSetting = useCallback(async () => {
    setLoading(true);
    // Ensure default row exists (admin context, service role client)
    await ensureDefaultSettings();
    const data = await getSetting(config.key);
    setCurrentValue(config.valueExtractor(data));
    setLoading(false);
  }, [config]);

  useEffect(() => {
    fetchSetting();
  }, [fetchSetting]);

  const handleChange = async (newValue: T) => {
    if (newValue === currentValue || saving) return;

    // Optimistic update
    const previousValue = currentValue;
    setCurrentValue(newValue);
    setSaving(true);

    const result = await setSetting(config.key, config.valueBuilder(newValue));

    if (!result) {
      // Rollback on failure
      setCurrentValue(previousValue);
      toast({
        title: "Failed to update setting",
        description: "Please try again.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Setting updated" });
    }

    setSaving(false);
  };

  const activeOption = config.options.find((o) => o.value === currentValue);

  if (loading) {
    return (
      <div className="rounded-xl p-5" style={cardBg}>
        <Skeleton className="h-5 w-40 mb-2" />
        <Skeleton className="h-4 w-64 mb-5" />
        <div className="flex gap-3">
          <Skeleton className="h-24 flex-1 rounded-lg" />
          <Skeleton className="h-24 flex-1 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-5" style={cardBg}>
      {/* Header */}
      <div className="mb-5">
        <h3
          className="text-[15px] font-ui font-medium"
          style={{ color: "#0B1220" }}
        >
          {config.title}
        </h3>
        <p
          className="text-[12px] font-ui mt-0.5"
          style={{ color: "#5B6472" }}
        >
          {config.description}
        </p>
      </div>

      {/* Segmented control / radio cards */}
      <div className="flex gap-3">
        {config.options.map((option) => {
          const isActive = currentValue === option.value;
          return (
            <button
              key={option.value}
              onClick={() => handleChange(option.value)}
              disabled={saving}
              className="flex-1 rounded-lg p-4 text-left transition-all relative"
              style={{
                background: isActive ? "#F0F3F7" : "#F5F7FA",
                border: isActive
                  ? "1px solid #1E4ED8"
                  : "1px solid #DDE3EC",
                opacity: saving ? 0.7 : 1,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {/* Selection indicator */}
              {isActive && (
                <div
                  className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "#1E4ED8" }}
                >
                  <Check size={12} style={{ color: "#FFFFFF" }} />
                </div>
              )}

              {/* Icon */}
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center mb-3"
                style={{
                  background: isActive
                    ? "rgba(212,160,23,0.15)"
                    : "#DDE3EC",
                  color: isActive ? "#1E4ED8" : "#5B6472",
                }}
              >
                {option.icon}
              </div>

              {/* Label */}
              <p
                className="text-[13px] font-ui font-medium"
                style={{ color: isActive ? "#0B1220" : "#5B6472" }}
              >
                {option.label}
              </p>

              {/* Description */}
              <p
                className="text-[11px] font-ui mt-0.5"
                style={{ color: "#8B94A3" }}
              >
                {option.description}
              </p>

              {/* Experimental badge */}
              {option.experimental && (
                <span
                  className="inline-block mt-2 text-[10px] font-ui px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(212,160,23,0.1)",
                    color: "#1E4ED8",
                    border: "1px solid rgba(212,160,23,0.25)",
                  }}
                >
                  Experimental
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Current engine status */}
      {activeOption && (
        <div className="mt-4 flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background:
                activeOption.experimental ? "#1E4ED8" : "#157347",
            }}
          />
          <p className="text-[12px] font-ui" style={{ color: "#5B6472" }}>
            Current Engine:{" "}
            <span
              className="font-medium"
              style={{ color: "#0B1220" }}
            >
              {activeOption.label.toUpperCase()}
            </span>
          </p>
          {saving && (
            <span
              style={{
                width: "10px",
                height: "10px",
                border: "2px solid #1E4ED8",
                borderTopColor: "transparent",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.6s linear infinite",
              }}
            />
          )}
        </div>
      )}

      {/* Experimental warning */}
      {activeOption?.experimental && activeOption.experimentalNote && (
        <div
          className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5"
          style={{
            background: "rgba(212,160,23,0.06)",
            border: "1px solid rgba(212,160,23,0.15)",
          }}
        >
          <AlertTriangle
            size={14}
            className="flex-shrink-0 mt-0.5"
            style={{ color: "#1E4ED8" }}
          />
          <p
            className="text-[11px] font-ui leading-relaxed"
            style={{ color: "#5B6472" }}
          >
            {activeOption.experimentalNote}
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════

export default function AdminRuntimeSettings() {
  return (
    <FadeIn>
      <div className="space-y-5">
        <div>
          <h1
            className="font-display text-2xl"
            style={{ color: "#0B1220" }}
          >
            Runtime Settings
          </h1>
          <p
            className="text-[13px] font-ui mt-0.5"
            style={{ color: "#5B6472" }}
          >
            Control platform-wide runtime configuration.
          </p>
        </div>

        {/* Section: Content Studio */}
        <div>
          <p
            className="text-[10px] font-ui uppercase tracking-wider mb-2"
            style={{ color: "#8B94A3", letterSpacing: "0.1em" }}
          >
            Content Studio
          </p>
          <RuntimeSettingSection config={RENDER_ENGINE_SETTING} />
        </div>

        {/* Future settings sections render here from ALL_SETTINGS */}
      </div>
    </FadeIn>
  );
}
