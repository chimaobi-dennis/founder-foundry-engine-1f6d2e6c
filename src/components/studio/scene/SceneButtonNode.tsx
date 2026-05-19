import { memo } from "react";
import type { ButtonNode } from "@/types/scene";
import { clampRadius, resolveFill, resolveStroke, resolveFont } from "@/lib/renderers/sceneRenderPipeline";

interface Props {
  node: ButtonNode;
}

function SceneButtonNodeImpl({ node }: Props) {
  const r = clampRadius(node.radius, node.width, node.height);
  const fill = resolveFill(node.fill);
  const stroke = resolveStroke(node.stroke, node.strokeWidth);
  const font = resolveFont(node.fontFamily, node.fontWeight, node.fontSize, 1.2, 0);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: fill.isTransparent ? undefined : fill.fill,
        border: stroke.isVisible ? `${stroke.width}px solid ${stroke.color}` : "none",
        borderRadius: r.radius,
        boxSizing: "border-box",
        fontFamily: `"${font.family}"`,
        fontWeight: font.weight,
        fontSize: font.size,
        color: node.textColor || "#ffffff",
        userSelect: "none",
      }}
    >
      {node.label || "Button"}
    </div>
  );
}

export const SceneButtonNode = memo(SceneButtonNodeImpl);
