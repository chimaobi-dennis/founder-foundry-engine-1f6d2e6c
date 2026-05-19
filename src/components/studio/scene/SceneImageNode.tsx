import { memo } from "react";
import type { ImageNode } from "@/types/scene";
import { clampRadius } from "@/lib/renderers/sceneRenderPipeline";

interface Props {
  node: ImageNode;
}

function SceneImageNodeImpl({ node }: Props) {
  const r = clampRadius(node.borderRadius, node.width, node.height);

  return (
    <img
      src={node.src}
      alt=""
      draggable={false}
      style={{
        width: "100%",
        height: "100%",
        objectFit: node.objectFit,
        borderRadius: r.radius,
        display: "block",
        userSelect: "none",
        pointerEvents: "none",
      }}
    />
  );
}

export const SceneImageNode = memo(SceneImageNodeImpl);
