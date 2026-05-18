import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { SceneDocument, SceneNode } from "@/types/scene";
import { diffScenes, type NodeDiff, type DiffChangeType } from "@/lib/scene/sceneDiff";

// ─── Props ───────────────────────────────────────────────────

interface Props {
  before: SceneDocument;
  after: SceneDocument;
  zoom?: number;
}

// ─── Colors ──────────────────────────────────────────────────

const CHANGE_COLORS: Record<DiffChangeType, { border: string; bg: string; label: string }> = {
  added: { border: "border-emerald-500", bg: "bg-emerald-500/10", label: "Added" },
  removed: { border: "border-red-500", bg: "bg-red-500/10", label: "Removed" },
  modified: { border: "border-amber-500", bg: "bg-amber-500/10", label: "Changed" },
  moved: { border: "border-blue-500", bg: "bg-blue-500/10", label: "Moved" },
  resized: { border: "border-purple-500", bg: "bg-purple-500/10", label: "Resized" },
  retyped: { border: "border-pink-500", bg: "bg-pink-500/10", label: "Retyped" },
};

// ─── Component ───────────────────────────────────────────────

/**
 * Overlays colored outlines on changed nodes to visualize AI edits.
 * Renders as an absolutely positioned layer over the scene.
 */
export function SceneDiffOverlay({ before, after, zoom = 1 }: Props) {
  const diff = useMemo(() => diffScenes(before, after), [before, after]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, SceneNode>();
    const walk = (nodes: SceneNode[]) => {
      for (const n of nodes) {
        map.set(n.id, n);
        if ("children" in n && Array.isArray(n.children)) walk(n.children);
      }
    };
    walk(after.nodes);
    walk(before.nodes);
    return map;
  }, [before, after]);

  if (!diff.hasChanges) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40" data-scene-overlay>
      {diff.nodeDiffs.map((nd) => {
        const node = nodeMap.get(nd.nodeId);
        if (!node) return null;

        const style = CHANGE_COLORS[nd.changeType];

        return (
          <div
            key={`diff-${nd.nodeId}`}
            className={cn(
              "absolute border-2 rounded-sm transition-all duration-300",
              style.border,
              style.bg
            )}
            style={{
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height,
            }}
          >
            {/* Change label */}
            <div
              className={cn(
                "absolute -top-4 left-0 px-1 py-0.5 rounded text-[8px] font-semibold leading-none whitespace-nowrap",
                style.border.replace("border-", "bg-"),
                "text-white"
              )}
              style={{ fontSize: Math.max(8, 9 / zoom) }}
            >
              {style.label}
              {nd.changeType === "modified" && nd.changedFields.length > 0 && (
                <span className="opacity-80 ml-0.5">
                  ({nd.changedFields.slice(0, 2).join(", ")})
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
