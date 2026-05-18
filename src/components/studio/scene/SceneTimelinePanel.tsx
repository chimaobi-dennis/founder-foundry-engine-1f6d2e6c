import { useState, useMemo } from "react";
import {
  Clock, GitBranch, RotateCcw, Eye, ChevronDown, ChevronRight,
  Sparkles, Pencil, Wand2, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TimelineEntry } from "@/lib/scene/sceneTimeline";
import type { SnapshotSource } from "@/lib/scene/sceneVersioning";

// ─── Props ───────────────────────────────────────────────────

interface Props {
  entries: TimelineEntry[];
  currentIndex: number;
  branches: string[];
  onRestore: (snapshotId: string) => void;
  onBranch?: (name: string) => void;
  onCompare?: (fromId: string, toId: string) => void;
}

// ─── Source config ───────────────────────────────────────────

const SOURCE_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  generation: { icon: <Sparkles className="h-3 w-3" />, color: "text-violet-500", label: "Generated" },
  mutation: { icon: <Wand2 className="h-3 w-3" />, color: "text-blue-500", label: "AI Edit" },
  user_edit: { icon: <Pencil className="h-3 w-3" />, color: "text-foreground/70", label: "Manual Edit" },
  refinement: { icon: <RefreshCw className="h-3 w-3" />, color: "text-emerald-500", label: "Refined" },
  repair: { icon: <RefreshCw className="h-3 w-3" />, color: "text-amber-500", label: "Repaired" },
  reflow: { icon: <RefreshCw className="h-3 w-3" />, color: "text-cyan-500", label: "Reflowed" },
  branch: { icon: <GitBranch className="h-3 w-3" />, color: "text-pink-500", label: "Branch" },
};

function getSourceMeta(source: SnapshotSource) {
  return SOURCE_META[source.type] || { icon: <Clock className="h-3 w-3" />, color: "text-muted-foreground", label: source.type };
}

// ─── Component ───────────────────────────────────────────────

export function SceneTimelinePanel({
  entries,
  currentIndex,
  branches,
  onRestore,
  onBranch,
  onCompare,
}: Props) {
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [compareFrom, setCompareFrom] = useState<string | null>(null);

  const activeBranches = useMemo(() => {
    const grouped = new Map<string, TimelineEntry[]>();
    for (const entry of entries) {
      const b = entry.branch || "main";
      if (!grouped.has(b)) grouped.set(b, []);
      grouped.get(b)!.push(entry);
    }
    return grouped;
  }, [entries]);

  const handleCompareClick = (id: string) => {
    if (!compareFrom) {
      setCompareFrom(id);
    } else {
      onCompare?.(compareFrom, id);
      setCompareFrom(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground/90 uppercase tracking-wider">
          Timeline
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {entries.length} revision{entries.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Branch tabs */}
      {branches.length > 1 && (
        <div className="flex gap-1 px-3 py-1.5 border-b border-border overflow-x-auto">
          {branches.map((b) => (
            <button
              key={b}
              onClick={() => setExpandedBranch(expandedBranch === b ? null : b)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full transition-colors whitespace-nowrap",
                expandedBranch === b || (!expandedBranch && b === "main")
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GitBranch className="h-2.5 w-2.5 inline mr-0.5" />
              {b}
            </button>
          ))}
        </div>
      )}

      {/* Compare mode indicator */}
      {compareFrom && (
        <div className="px-3 py-1.5 bg-primary/5 border-b border-primary/20 flex items-center gap-2">
          <Eye className="h-3 w-3 text-primary" />
          <span className="text-[10px] text-primary">Select another revision to compare</span>
          <button
            className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => setCompareFrom(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Entries */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-2">
          {entries.map((entry, idx) => {
            const meta = getSourceMeta(entry.source);
            const isCurrent = idx === currentIndex;
            const isRestore = entry.isRestorePoint;

            return (
              <div key={entry.snapshotId} className="relative flex gap-2 pb-3 last:pb-0">
                {/* Vertical line */}
                {idx < entries.length - 1 && (
                  <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border" />
                )}

                {/* Dot */}
                <div className="relative z-10 mt-0.5 shrink-0">
                  <div
                    className={cn(
                      "h-3.5 w-3.5 rounded-full border-2 transition-colors",
                      isCurrent
                        ? "border-primary bg-primary"
                        : isRestore
                        ? "border-amber-400 bg-amber-400/30"
                        : "border-border bg-card"
                    )}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("shrink-0", meta.color)}>{meta.icon}</span>
                    <span
                      className={cn(
                        "text-[11px] font-medium truncate",
                        isCurrent ? "text-foreground" : "text-foreground/70"
                      )}
                    >
                      {entry.label || meta.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] px-1 py-px rounded bg-primary/10 text-primary font-medium shrink-0">
                        NOW
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-muted-foreground truncate">
                    {entry.changeSummary}
                  </p>

                  <div className="flex items-center gap-1 pt-0.5">
                    <span className="text-[9px] text-muted-foreground/60">
                      {formatTimestamp(entry.timestamp)}
                    </span>

                    {!isCurrent && (
                      <>
                        <button
                          onClick={() => onRestore(entry.snapshotId)}
                          className="text-[9px] text-muted-foreground hover:text-foreground ml-1 transition-colors"
                        >
                          <RotateCcw className="h-2.5 w-2.5 inline mr-0.5" />
                          Restore
                        </button>
                        {onCompare && (
                          <button
                            onClick={() => handleCompareClick(entry.snapshotId)}
                            className={cn(
                              "text-[9px] ml-1 transition-colors",
                              compareFrom === entry.snapshotId
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Eye className="h-2.5 w-2.5 inline mr-0.5" />
                            Compare
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {entries.length === 0 && (
            <div className="py-8 text-center">
              <Clock className="h-5 w-5 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">No history yet</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Branch action */}
      {onBranch && (
        <div className="px-3 py-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              const name = window.prompt("Branch name");
              if (name) onBranch(name);
            }}
          >
            <GitBranch className="h-3 w-3 mr-1" />
            Create Branch
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
