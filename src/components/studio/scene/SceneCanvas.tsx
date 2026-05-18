import { PointerEvent as RPE, useCallback, useEffect, useRef, useState, WheelEvent as RWE } from "react";
import type { SceneNode } from "@/types/scene";
import { useSceneStore, sceneHelpers } from "./sceneStore";
import { SceneNodeRenderer } from "./SceneNodeRenderer";
import { SceneSelectionOverlay } from "./SceneSelectionOverlay";

interface Props {
  className?: string;
}

/**
 * Editable scene canvas. Renders the document inside a fixed artboard,
 * supports zoom, pan, selection, drag, resize, and keyboard shortcuts.
 */
export function SceneCanvas({ className }: Props) {
  const store = useSceneStore();
  const { document, selectedIds, zoom, pan, setSelection, setZoom, setPan, dispatch } = store;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);

  const sorted = [...document.nodes].sort((a, b) => a.zIndex - b.zIndex);
  const selected = selectedIds
    .map((id) => sceneHelpers.findNode(document.nodes, id))
    .filter(Boolean) as SceneNode[];

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        store.redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        store.duplicateSelected();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length) {
          e.preventDefault();
          store.deleteSelected();
        }
      } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (!selected.length) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        dispatch({
          type: "update_nodes",
          updates: selected.map((n) => ({ id: n.id, patch: { x: n.x + dx, y: n.y + dy } as Partial<SceneNode> })),
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, selectedIds, selected, dispatch]);

  // Drag node(s)
  const onArtboardPointerDown = useCallback(
    (e: RPE<HTMLDivElement>) => {
      // empty click clears selection
      if ((e.target as HTMLElement).hasAttribute("data-scene-artboard")) {
        setSelection([]);
      }
    },
    [setSelection]
  );

  // Begin drag when pressing on a node — handled via onPointerDown bubbling.
  const onNodePointerDownCapture = useCallback(
    (e: RPE<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest("[data-scene-node]") as HTMLElement | null;
      if (!target) return;
      // ignore handles / overlays
      if ((e.target as HTMLElement).closest("[data-scene-overlay]")) return;

      const id = target.getAttribute("data-scene-node");
      if (!id) return;
      const node = sceneHelpers.findNode(document.nodes, id);
      if (!node || store.ui[id]?.locked) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startPositions = (selectedIds.includes(id) ? selectedIds : [id])
        .map((nid) => {
          const n = sceneHelpers.findNode(document.nodes, nid);
          return n ? { id: nid, x: n.x, y: n.y } : null;
        })
        .filter(Boolean) as { id: string; x: number; y: number }[];

      let moved = false;
      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
        dispatch({
          type: "update_nodes",
          updates: startPositions.map((p) => ({ id: p.id, patch: { x: p.x + dx, y: p.y + dy } as Partial<SceneNode> })),
        });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (!moved) {
          // pure click — let the node's own onPointerDown handle selection
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [document.nodes, selectedIds, zoom, dispatch, store.ui]
  );

  // Zoom with cmd/ctrl + wheel
  const onWheel = useCallback(
    (e: RWE<HTMLDivElement>) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.002;
        setZoom(zoom * (1 + delta));
      }
    },
    [zoom, setZoom]
  );

  // Pan with space+drag or middle-click drag
  const onWrapPointerDown = useCallback(
    (e: RPE<HTMLDivElement>) => {
      if (e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        const startX = e.clientX;
        const startY = e.clientY;
        const start = { ...pan };
        const move = (ev: PointerEvent) => {
          setPan({ x: start.x + (ev.clientX - startX), y: start.y + (ev.clientY - startY) });
        };
        const up = () => {
          setIsPanning(false);
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }
    },
    [pan, setPan]
  );

  return (
    <div
      ref={wrapRef}
      onWheel={onWheel}
      onPointerDown={onWrapPointerDown}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "hsl(var(--muted) / 0.4)",
        backgroundImage:
          "radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)",
        backgroundSize: "22px 22px",
        cursor: isPanning ? "grabbing" : "default",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
        }}
      >
        <div
          data-scene-artboard
          onPointerDown={onArtboardPointerDown}
          onPointerDownCapture={onNodePointerDownCapture}
          style={{
            position: "relative",
            width: document.width,
            height: document.height,
            background: document.background,
            boxShadow: "0 20px 60px hsl(var(--background) / 0.6)",
            overflow: "hidden",
          }}
        >
          {sorted.map((node) => (
            <SceneNodeRenderer key={node.id} node={node} />
          ))}
          {selected.map((n) => (
            <SceneSelectionOverlay key={`ov-${n.id}`} node={n} zoom={zoom} />
          ))}
        </div>
      </div>
    </div>
  );
}
