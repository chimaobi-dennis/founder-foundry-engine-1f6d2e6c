import type { SceneNode } from "@/types/scene";
import { SceneResizeHandles } from "./SceneResizeHandles";

interface Props {
  node: SceneNode;
  zoom: number;
}

export function SceneSelectionOverlay({ node, zoom }: Props) {
  return (
    <div
      data-scene-overlay
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        transform: `rotate(${node.rotation}deg)`,
        transformOrigin: "center center",
        pointerEvents: "none",
        zIndex: 999,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: `${1.5 / zoom}px solid hsl(var(--primary))`,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
        <SceneResizeHandles node={node} zoom={zoom} />
      </div>
    </div>
  );
}
