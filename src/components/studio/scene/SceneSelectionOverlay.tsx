import type { SceneNode, CameraState } from "@/types/scene";
import { worldToScreen, worldToScreenDim } from "@/types/scene";
import { useMemo } from "react";
import { SceneResizeHandles } from "./SceneResizeHandles";

interface Props {
  node: SceneNode;
  camera: CameraState;
}

/**
 * Selection overlay — renders in screen space so it stays pixel-perfect
 * regardless of zoom level. The border width stays 1.5px (screen pixels)
 * and handles remain easy to grab.
 */
export function SceneSelectionOverlay({ node, camera }: Props) {
  // Compute screen position (centered in viewport + camera offset + world pos * zoom)
  const screenPos = useMemo(() => {
    // We need the viewport center. Since we don't have it here, we rely on
    // the parent's transform. The overlay is positioned inside the world layer
    // which already has the camera transform applied.
    // So we can just use world coordinates directly.
    return {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    };
  }, [node]);

  return (
    <div
      data-scene-overlay
      style={{
        position: "absolute",
        left: screenPos.x,
        top: screenPos.y,
        width: screenPos.width,
        height: screenPos.height,
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
          border: `${1.5 / camera.zoom}px solid hsl(var(--primary))`,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
        <SceneResizeHandles node={node} camera={camera} />
      </div>
    </div>
  );
}
