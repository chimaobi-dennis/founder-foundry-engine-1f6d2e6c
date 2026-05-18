import { useState, useMemo } from "react";
import { Check, X, RotateCcw, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SceneDocument } from "@/types/scene";
import { diffScenes, diffSummary, type SceneDiffResult } from "@/lib/scene/sceneDiff";
import { SceneRenderer } from "./SceneRenderer";

interface Props {
  before: SceneDocument;
  after: SceneDocument;
  onAccept: () => void;
  onReject: () => void;
  onRetry?: () => void;
  label?: string;
}

/**
 * Visual before/after preview for AI edits.
 * Shows changed regions and allows accept/reject/retry.
 */
export function ScenePatchPreview({ before, after, onAccept, onReject, onRetry, label }: Props) {
  const [mode, setMode] = useState<"split" | "before" | "after" | "diff">("split");

  const diff = useMemo(() => diffScenes(before, after), [before, after]);
  const summary = useMemo(() => diffSummary(diff), [diff]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground/90 uppercase tracking-wider">
          {label || "Preview Changes"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {(["split", "before", "after", "diff"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded transition-colors capitalize",
                mode === m
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 min-h-0 relative">
        {mode === "split" && (
          <div className="flex h-full">
            <div className="flex-1 border-r border-border relative overflow-hidden">
              <div className="absolute top-2 left-2 z-10 text-[10px] px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm border border-border text-muted-foreground">
                Before
              </div>
              <div className="h-full flex items-center justify-center p-4 bg-muted/20">
                <ScenePreviewCard scene={before} />
              </div>
            </div>
            <div className="flex-1 relative overflow-hidden">
              <div className="absolute top-2 left-2 z-10 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 backdrop-blur-sm border border-primary/20 text-primary">
                After
              </div>
              <div className="h-full flex items-center justify-center p-4 bg-muted/20">
                <ScenePreviewCard scene={after} />
              </div>
            </div>
          </div>
        )}

        {mode === "before" && (
          <div className="h-full flex items-center justify-center p-4 bg-muted/20">
            <ScenePreviewCard scene={before} />
          </div>
        )}

        {mode === "after" && (
          <div className="h-full flex items-center justify-center p-4 bg-muted/20">
            <ScenePreviewCard scene={after} />
          </div>
        )}

        {mode === "diff" && (
          <div className="h-full overflow-auto p-4">
            <DiffSummaryView diff={diff} summary={summary} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
        <span className="text-[10px] text-muted-foreground flex-1 truncate">
          {summary}
        </span>
        {onRetry && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onRetry}>
            <RotateCcw className="h-3 w-3 mr-1" /> Retry
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={onReject}>
          <X className="h-3 w-3 mr-1" /> Reject
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={onAccept}>
          <Check className="h-3 w-3 mr-1" /> Accept
        </Button>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function ScenePreviewCard({ scene }: { scene: SceneDocument }) {
  const scale = Math.min(240 / scene.width, 180 / scene.height, 1);

  return (
    <div
      className="relative shadow-md rounded-sm overflow-hidden border border-border/50"
      style={{
        width: scene.width * scale,
        height: scene.height * scale,
        background: scene.background,
        transform: `scale(1)`,
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: scene.width, height: scene.height }}>
        <SceneRenderer document={scene} />
      </div>
    </div>
  );
}

function DiffSummaryView({ diff, summary }: { diff: SceneDiffResult; summary: string }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-foreground">{summary}</p>
      <div className="space-y-1">
        {diff.nodeDiffs.map((nd) => (
          <div
            key={nd.nodeId}
            className={cn(
              "flex items-center gap-2 text-[11px] px-2 py-1 rounded",
              nd.changeType === "added" && "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400",
              nd.changeType === "removed" && "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400",
              nd.changeType === "modified" && "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400",
              nd.changeType === "moved" && "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400",
              nd.changeType === "resized" && "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400",
            )}
          >
            <span className="font-medium capitalize w-16">{nd.changeType}</span>
            <span className="truncate flex-1 font-mono">{nd.nodeId}</span>
          </div>
        ))}
        {diff.nodeDiffs.length === 0 && (
          <p className="text-xs text-muted-foreground">No structural changes detected.</p>
        )}
      </div>
    </div>
  );
}
