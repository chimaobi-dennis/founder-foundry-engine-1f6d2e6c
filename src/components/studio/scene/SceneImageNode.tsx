import { memo } from "react";
import type { ImageNode } from "@/types/scene";

interface Props {
  node: ImageNode;
}

function SceneImageNodeImpl({ node }: Props) {
  return (
    <img
      src={node.src}
      alt=""
      draggable={false}
      style={{
        width: "100%",
        height: "100%",
        objectFit: node.objectFit,
        borderRadius: node.borderRadius,
        display: "block",
        userSelect: "none",
        pointerEvents: "none",
      }}
    />
  );
}

export const SceneImageNode = memo(SceneImageNodeImpl);
