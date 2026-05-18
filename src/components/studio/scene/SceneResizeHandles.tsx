import { PointerEvent as RPE, useCallback } from "react";
import type { SceneNode } from "@/types/scene";
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
  zoom: number;
}

export function SceneResizeHandles({ node, zoom }: Props) {
  const { updateNode } = useSceneStore();

  const startResize = useCallback(
    (handle: string) => (e: RPE<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const start = { x: node.x, y: node.y, w: node.width, h: node.height };

      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
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
    [node, zoom, updateNode]
  );

  const startRotate = useCallback(
    (e: RPE<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      const move = (ev: PointerEvent) => {
        const target = e.currentTarget as HTMLDivElement;
        const root = target.closest("[data-scene-artboard]") as HTMLElement | null;
        if (!root) return;
        const rect = root.getBoundingClientRect();
        const px = (ev.clientX - rect.left) / zoom;
        const py = (ev.clientY - rect.top) / zoom;
        const angle = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
        updateNode(node.id, { rotation: Math.round(angle) } as Partial<SceneNode>);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [node, zoom, updateNode]
  );

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
            border: `${1 / zoom}px solid hsl(var(--primary))`,
            borderRadius: 2 / zoom,
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
          top: -20 / zoom,
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
