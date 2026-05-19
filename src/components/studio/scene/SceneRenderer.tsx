import type { SceneDocument } from "@/types/scene";
import { SceneNodeRenderer } from "./SceneNodeRenderer";
import { SceneDebugOverlay } from "./SceneDebugOverlay";

interface Props {
  document: SceneDocument;
  /** When true, render without interactivity (for previews). */
  preview?: boolean;
  /** When true, show debug overlay with node bounds, pivots, baselines. */
  debug?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Pure renderer for a SceneDocument. No editing affordances.
 * Use inside SceneCanvas for the editor, or standalone for previews.
 */
export function SceneRenderer({ document, preview = true, debug = false, className, style }: Props) {
  const sorted = [...document.nodes].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: document.width,
        height: document.height,
        background: document.background,
        overflow: "hidden",
        ...style,
      }}
    >
      {sorted.map((node) => (
        <SceneNodeRenderer key={node.id} node={node} interactive={!preview} />
      ))}
      {debug && <SceneDebugOverlay document={document} />}
    </div>
  );
}
