import { memo } from "react";
import type { FrameNode } from "@/types/scene";
import { SceneNodeRenderer } from "./SceneNodeRenderer";
import { clampRadius, resolveFill, resolveStroke } from "@/lib/renderers/sceneRenderPipeline";

interface Props {
  node: FrameNode;
}

function SceneFrameNodeImpl({ node }: Props) {
  const r = clampRadius(node.radius, node.width, node.height);
  const fill = resolveFill(node.fill);
  const stroke = resolveStroke(node.stroke, node.strokeWidth);
  const sorted = [...node.children].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: fill.isTransparent ? undefined : fill.fill,
        border: stroke.isVisible ? `${stroke.width}px solid ${stroke.color}` : "none",
        borderRadius: r.radius,
        boxSizing: "border-box",
        overflow: node.clipContent ? "hidden" : "visible",
        position: "relative",
      }}
    >
      {sorted.map((child) => (
        <SceneNodeRenderer key={child.id} node={child} interactive={false} />
      ))}
    </div>
  );
}

export const SceneFrameNode = memo(SceneFrameNodeImpl);
