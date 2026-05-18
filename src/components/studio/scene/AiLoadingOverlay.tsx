import { cn } from "@/lib/utils";
import { Sparkles, Loader2, Wand2, RefreshCw, LayoutPanelLeft, Download } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────

export type LoadingStage =
  | "thinking"
  | "mutating"
  | "refining"
  | "repairing"
  | "generating"
  | "exporting"
  | "scoring";

interface Props {
  stage: LoadingStage;
  message?: string;
  /** 0–100, omit for indeterminate. */
  progress?: number;
  className?: string;
}

// ─── Config ──────────────────────────────────────────────────

const STAGE_CONFIG: Record<LoadingStage, { icon: React.ReactNode; label: string; color: string }> = {
  thinking: { icon: <Sparkles className="h-4 w-4" />, label: "AI is thinking", color: "text-primary" },
  mutating: { icon: <Wand2 className="h-4 w-4" />, label: "Applying mutations", color: "text-blue-500" },
  refining: { icon: <LayoutPanelLeft className="h-4 w-4" />, label: "Refining composition", color: "text-emerald-500" },
  repairing: { icon: <RefreshCw className="h-4 w-4" />, label: "Repairing issues", color: "text-amber-500" },
  generating: { icon: <Sparkles className="h-4 w-4" />, label: "Generating scene", color: "text-violet-500" },
  exporting: { icon: <Download className="h-4 w-4" />, label: "Exporting", color: "text-cyan-500" },
  scoring: { icon: <Sparkles className="h-4 w-4" />, label: "Evaluating quality", color: "text-pink-500" },
};

// ─── Component ───────────────────────────────────────────────

/**
 * Cinematic AI loading overlay.
 * Shows stage-specific icon, label, and optional progress.
 */
export function AiLoadingOverlay({ stage, message, progress, className }: Props) {
  const config = STAGE_CONFIG[stage];

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center",
        "bg-background/60 backdrop-blur-sm",
        "animate-in fade-in duration-200",
        className
      )}
    >
      <div className="flex flex-col items-center gap-3 max-w-xs text-center">
        {/* Animated icon */}
        <div className={cn("relative", config.color)}>
          <div className="absolute inset-0 animate-ping opacity-20">
            {config.icon}
          </div>
          <div className="animate-pulse">
            {config.icon}
          </div>
        </div>

        {/* Label */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{config.label}</p>
          {message && (
            <p className="text-xs text-muted-foreground">{message}</p>
          )}
        </div>

        {/* Progress bar */}
        {progress !== undefined ? (
          <div className="w-32 h-1 bg-border rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-300 ease-out", `bg-current ${config.color}`)}
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : (
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn("h-1 w-1 rounded-full bg-current opacity-60", config.color)}
                style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Inline AI status pill (for toolbar/status bar).
 */
export function AiStatusPill({ stage, message }: { stage: LoadingStage; message?: string }) {
  const config = STAGE_CONFIG[stage];

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs",
      "bg-primary/5 border border-primary/10",
      "animate-in slide-in-from-bottom-2 duration-300"
    )}>
      <Loader2 className={cn("h-3 w-3 animate-spin", config.color)} />
      <span className="text-foreground/80 font-medium">
        {message || config.label}
      </span>
    </div>
  );
}
