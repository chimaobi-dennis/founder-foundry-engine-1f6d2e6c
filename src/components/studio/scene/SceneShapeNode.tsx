import { memo } from "react";
import type { ShapeNode } from "@/types/scene";
import { clampRadius, resolveFill, resolveStroke } from "@/lib/renderers/sceneRenderPipeline";

interface Props {
  node: ShapeNode;
}

function SceneShapeNodeImpl({ node }: Props) {
  const r = clampRadius(node.radius, node.width, node.height);
  const fill = resolveFill(node.fill);
  const stroke = resolveStroke(node.stroke, node.strokeWidth);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: fill.isTransparent ? undefined : fill.fill,
        border: stroke.isVisible ? `${stroke.width}px solid ${stroke.color}` : "none",
        borderRadius: r.radius,
        boxSizing: "border-box",
      }}
    />
  );
}

export const SceneShapeNode = memo(SceneShapeNodeImpl);
