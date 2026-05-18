import { memo } from "react";
import type { ShapeNode } from "@/types/scene";

interface Props {
  node: ShapeNode;
}

function SceneShapeNodeImpl({ node }: Props) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: node.fill,
        border: node.strokeWidth ? `${node.strokeWidth}px solid ${node.stroke}` : "none",
        borderRadius: node.radius,
        boxSizing: "border-box",
      }}
    />
  );
}

export const SceneShapeNode = memo(SceneShapeNodeImpl);
