import { PointerEvent as RPE, useCallback } from "react";
import type { SceneNode, CameraState } from "@/types/scene";
import { screenToWorldDim } from "@/types/scene";
import { useSceneStore } from "./sceneStore";

const HANDLES: { key: string; cursor: string; x: number; y: number }[] = [
  { key: "nw", cursor: "nwse-resize", x: 0, y: 0 },
  { key: "n", cursor: "ns-resize", x: 0.5, y: 0 },
  { key: "ne", cursor: "nesw-resize", x: 1, y: 0 },
  { key: "e", cursor: "ew-resize", x: 1, y: 0.5 },
  { key: "se", cursor: "nwse-resize", x: 1, y: 1 },
  { key: "s", cursor: "ns-resize", x: 0.5, y: 1 },
  { key: "sw", cursor: "nesw-resize", x: 0, y: 1 },
  { key: "w", cursor: "ew-resize", x: 0, y: 0.5 },
];

interface Props {
  node: SceneNode;
  camera: CameraState;
}

/**
 * Resize handles for the selection overlay.
 * All drag deltas are converted from screen pixels to world coordinates.
 * Handle sizes stay constant in screen space (inverse zoom scaling).
 */
export function SceneResizeHandles({ node, camera }: Props) {
  const { updateNode } = useSceneStore();
  const zoom = camera.zoom;

  const startResize = useCallback(
    (handle: string) => (e: RPE<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const start = { x: node.x, y: node.y, w: node.width, h: node.height };

      const move = (ev: PointerEvent) => {
        // Convert screen delta to world delta
        const screenDx = ev.clientX - startX;
        const screenDy = ev.clientY - startY;
        const dx = screenToWorldDim(screenDx, camera);
        const dy = screenToWorldDim(screenDy, camera);

        let { x, y, w, h } = start;
        if (handle.includes("e")) w = Math.max(8, start.w + dx);
        if (handle.includes("s")) h = Math.max(8, start.h + dy);
        if (handle.includes("w")) {
          w = Math.max(8, start.w - dx);
          x = start.x + (start.w - w);
        }
        if (handle.includes("n")) {
          h = Math.max(8, start.h - dy);
          y = start.y + (start.h - h);
        }
        updateNode(node.id, { x, y, width: w, height: h } as Partial<SceneNode>);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [node, camera, updateNode]
  );

  const startRotate = useCallback(
    (e: RPE<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;

      const move = (ev: PointerEvent) => {
        // Get pointer position in world space relative to node center
        // Since we're in the world layer (camera transform applied), we can compute
        // the angle directly from the mouse position relative to the node center
        // But we need the viewport-relative mouse position converted to world

        // This is tricky because we don't have viewport center here.
        // The resize handles are inside the world layer which has the camera transform.
        // We'll use a simpler approach: compute angle from the screen position
        // converted to world space offset from node center.

        // For now, use a simplified rotation that works at any zoom
        const rect = (e.currentTarget as HTMLElement).ownerDocument.defaultView!.document
          .querySelector('[data-scene-viewport]')!.getBoundingClientRect();

        const screenX = ev.clientX - rect.left;
        const screenY = ev.clientY - rect.top;

        // Convert to world space
        const viewportCenterX = rect.width / 2;
        const viewportCenterY = rect.height / 2;
        const worldX = (screenX - viewportCenterX - camera.x) / camera.zoom;
        const worldY = (screenY - viewportCenterY - camera.y) / camera.zoom;

        const angle = (Math.atan2(worldY - cy, worldX - cx) * 180) / Math.PI + 90;
        updateNode(node.id, { rotation: Math.round(angle) } as Partial<SceneNode>);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [node, camera, updateNode]
  );

  // Handle size stays constant in screen space (inverse zoom scaling)
  const size = 8 / zoom;
  const offset = -size / 2;

  return (
    <>
      {HANDLES.map((h) => (
        <div
          key={h.key}
          onPointerDown={startResize(h.key)}
          style={{
            position: "absolute",
            left: `calc(${h.x * 100}% + ${offset}px)`,
            top: `calc(${h.y * 100}% + ${offset}px)`,
            width: size,
            height: size,
            background: "hsl(var(--background))",
            border: `${1 / camera.zoom}px solid hsl(var(--primary))`,
            borderRadius: 2 / camera.zoom,
            cursor: h.cursor,
            zIndex: 1000,
          }}
        />
      ))}
      <div
        onPointerDown={startRotate}
        style={{
          position: "absolute",
          left: `calc(50% + ${offset}px)`,
          top: -20 / camera.zoom,
          width: size,
          height: size,
          background: "hsl(var(--primary))",
          borderRadius: "50%",
          cursor: "grab",
          zIndex: 1000,
        }}
      />
    </>
  );
}
