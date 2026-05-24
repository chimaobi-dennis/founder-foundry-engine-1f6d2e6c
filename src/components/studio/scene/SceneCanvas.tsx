import { PointerEvent as RPE, useCallback, useEffect, useMemo, useRef, useState, WheelEvent as RWE } from "react";
import { cn } from "@/lib/utils";
import type { SceneNode, CameraState, SceneBounds } from "@/types/scene";
import { worldToScreen, worldToScreenDim, getSceneBounds } from "@/types/scene";
import { useSceneStore, sceneHelpers } from "./sceneStore";
import { SceneNodeRenderer } from "./SceneNodeRenderer";
import { SceneSelectionOverlay } from "./SceneSelectionOverlay";

interface Props {
  className?: string;
  /** Show debug overlay with viewport/world bounds */
  debug?: boolean;
  /** External zoom control (e.g., from toolbar) */
  zoom?: number;
  /** Canvas width in pixels (like EditableCanvas) */
  width?: number;
  /** Canvas height in pixels (like EditableCanvas) */
  height?: number;
  /** When true, scene artboard fills the provided width/height exactly (like HTML forceFillStage) */
  forceFillStage?: boolean;
}

/**
 * SceneCanvas — Camera-based infinite canvas renderer.
 *
 * Architecture:
 * - World space: node coordinates are NEVER mutated during zoom/pan
 * - Camera space: (x, y, zoom) stored separately
 * - Screen space: computed via worldToScreen transform
 * - Viewport: the only layer with overflow:hidden (clips final output)
 * - World layer: NO overflow clipping, infinite extent
 *
 * Zoom behavior:
 * - Zoom happens around the cursor focus point (preserved world coordinate)
 * - World coordinates of nodes never change
 * - Camera offset adjusted to maintain cursor world position
 */
export function SceneCanvas({ className, debug = false, zoom: externalZoom, width, height, forceFillStage }: Props) {
  const store = useSceneStore();
  const { document, selectedIds, camera, setSelection, setCamera, dispatch } = store;

  // Use provided dimensions if forceFillStage or if explicitly provided
  // Otherwise fall back to document dimensions
  const canvasWidth = (forceFillStage && width) ? width : (width ?? document.width);
  const canvasHeight = (forceFillStage && height) ? height : (height ?? document.height);
  const zoom = externalZoom ?? 1;

  // Artboard dimensions - when forceFillStage, artboard fills the canvas exactly
  const artboardWidth = forceFillStage ? canvasWidth : document.width;
  const artboardHeight = forceFillStage ? canvasHeight : document.height;

  // CSS transform approach like EditableCanvas - no camera zoom needed
  // Camera only handles pan (x, y), zoom is applied via CSS transform
  const viewportRef = useRef<HTMLDivElement>(null);
  const didInitialCenterRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Viewport dimensions
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setViewportSize({ width: cr.width, height: cr.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const viewportCenter = useMemo(() => ({
    x: viewportSize.width / 2,
    y: viewportSize.height / 2,
  }), [viewportSize]);

  // Compute world bounds for debug
  const worldBounds = useMemo(() => getSceneBounds(document), [document]);

  // ─── Center content on initial mount ─────────
  // Centers the artboard in the viewport at zoom 1 (like HTML mode).
  // The external zoom prop controls scale via CSS transform.
  // Include canvas dimensions in key so centering resets when platform changes
  const docKey = useMemo(() => `${canvasWidth}x${canvasHeight}-${document.width}x${document.height}-${document.nodes.length}`, [canvasWidth, canvasHeight, document.width, document.height, document.nodes.length]);

  // Reset centering when document changes (platform switch)
  useEffect(() => {
    didInitialCenterRef.current = false;
  }, [docKey]);

  useEffect(() => {
    if (didInitialCenterRef.current) return;
    if (viewportSize.width === 0 || viewportSize.height === 0) return;

    // Determine artboard dimensions
    const boardW = forceFillStage ? canvasWidth : document.width;
    const boardH = forceFillStage ? canvasHeight : document.height;

    // Camera position: when forceFillStage, artboard fills viewport from (0,0)
    // Otherwise center the artboard in the viewport
    const targetCamera = forceFillStage
      ? { x: 0, y: 0, zoom: 1 } // Top-left aligned, fills viewport
      : {
          x: (viewportSize.width - boardW) / 2,
          y: (viewportSize.height - boardH) / 2,
          zoom: 1,
        };

    setCamera(targetCamera);
    didInitialCenterRef.current = true;
  }, [viewportSize.width, viewportSize.height, canvasWidth, canvasHeight, document.width, document.height, forceFillStage, setCamera]);

  // Sorted nodes by zIndex
  const sorted = useMemo(() => [...document.nodes].sort((a, b) => a.zIndex - b.zIndex), [document.nodes]);
  const selected = useMemo(() => selectedIds
    .map((id) => sceneHelpers.findNode(document.nodes, id))
    .filter(Boolean) as SceneNode[], [selectedIds, document.nodes]);

  // ─── Keyboard Shortcuts ─────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

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

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [store, selectedIds, selected, dispatch]);

  // ─── Pan ────────────────────────────────────────────────────
  // Middle-click or space+drag to pan
  const startPan = useCallback((clientX: number, clientY: number) => {
    setIsPanning(true);
    const startCamera = { ...camera };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - clientX;
      const dy = ev.clientY - clientY;
      setCamera({ x: startCamera.x + dx, y: startCamera.y + dy, zoom: startCamera.zoom });
    };
    const up = () => {
      setIsPanning(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [camera, setCamera]);

  const onViewportPointerDown = useCallback((e: RPE<HTMLDivElement>) => {
    // Middle mouse or space key triggers pan
    if (e.button === 1 || isSpacePressed) {
      e.preventDefault();
      startPan(e.clientX, e.clientY);
      return;
    }

    // Empty click clears selection (but not if clicking a node)
    const target = e.target as HTMLElement;
    if (target.hasAttribute("data-scene-viewport")) {
      setSelection([]);
    }
  }, [isSpacePressed, startPan, setSelection]);

  // ─── Pan with wheel ─────────────────────
  // Zoom is handled externally via CSS transform (like HTML mode)
  const onWheel = useCallback((e: RWE<HTMLDivElement>) => {
    // Wheel = pan (shift for horizontal)
    const dx = e.shiftKey ? -e.deltaY : -e.deltaX;
    const dy = e.shiftKey ? 0 : -e.deltaY;
    setCamera({ ...camera, x: camera.x + dx, y: camera.y + dy });
  }, [camera, setCamera]);

  // ─── Node Dragging ───────────────────────────────────────────
  const onNodePointerDownCapture = useCallback((e: RPE<HTMLDivElement>) => {
    if (isPanning || isSpacePressed) return;

    const target = (e.target as HTMLElement).closest("[data-scene-node]") as HTMLElement | null;
    if (!target) return;
    // ignore handles / overlays
    if ((e.target as HTMLElement).closest("[data-scene-overlay]")) return;

    const id = target.getAttribute("data-scene-node");
    if (!id) return;
    const node = sceneHelpers.findNode(document.nodes, id);
    if (!node || store.ui[id]?.locked) return;

    // Select on click (unless already selected)
    if (!selectedIds.includes(id)) {
      setSelection([id]);
    }

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startPositions = (selectedIds.includes(id) ? selectedIds : [id])
      .map((nid) => {
        const n = sceneHelpers.findNode(document.nodes, nid);
        return n ? { id: nid, x: n.x, y: n.y } : null;
      })
      .filter(Boolean) as { id: string; x: number; y: number }[];

    let moved = false;
    const move = (ev: PointerEvent) => {
      // Convert screen delta to world delta
      const screenDx = ev.clientX - startClientX;
      const screenDy = ev.clientY - startClientY;
      const worldDx = screenToWorldDim(screenDx, camera);
      const worldDy = screenToWorldDim(screenDy, camera);

      if (Math.abs(worldDx) + Math.abs(worldDy) > 0.1) moved = true;

      dispatch({
        type: "update_nodes",
        updates: startPositions.map((p) => ({
          id: p.id,
          patch: { x: p.x + worldDx, y: p.y + worldDy } as Partial<SceneNode>,
        })),
      });
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [camera, document.nodes, dispatch, isPanning, isSpacePressed, selectedIds, setSelection, store.ui]);

  // ─── Render ─────────────────────────────────────────────────
  return (
    // CSS transform approach like EditableCanvas
    // Outer container sized at scaled dimensions, clips the scaled content
    <div
      className={cn("overflow-hidden rounded-sm relative bg-white", className)}
      style={{
        width: canvasWidth * zoom,
        height: canvasHeight * zoom,
      }}
    >
      {/* Viewport — actual scene at native size, scaled via transform */}
      <div
        ref={viewportRef}
        data-scene-viewport
        onWheel={onWheel}
        onPointerDown={onViewportPointerDown}
        style={{
          position: "relative",
          width: canvasWidth,
          height: canvasHeight,
          background: "hsl(var(--background))",
          cursor: isPanning ? "grabbing" : isSpacePressed ? "grab" : "default",
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
        }}
      >
        {/* World Layer — NO overflow clipping, infinite extent */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            // Camera transform: viewport center + camera offset (zoom is 1, handled by CSS)
            transform: `
              translate(${viewportCenter.x + camera.x}px, ${viewportCenter.y + camera.y}px)
              scale(1)
            `,
            transformOrigin: "0 0",
          }}
        >
          {/* Scene Artboard Frame — exact scene dimensions (or canvas size if forceFillStage) */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: artboardWidth,
              height: artboardHeight,
              background: document.background,
              overflow: "hidden",
              outline: "1px solid rgba(0,0,0,0.12)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
          >
            {/* Scene Nodes — rendered inside clipped artboard */}
            <div
              data-scene-world
              onPointerDownCapture={onNodePointerDownCapture}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                height: "100%",
              }}
            >
              {sorted.map((node) => (
                <SceneNodeRenderer key={node.id} node={node} />
              ))}
            </div>
          </div>

          {/* Selection Overlays — OUTSIDE clipped artboard so handles are visible at edges */}
          {selected.map((n) => (
            <SceneSelectionOverlay key={`ov-${n.id}`} node={n} camera={{ ...camera, zoom: 1 }} />
          ))}
        </div>

        {/* Debug Overlay */}
        {debug && (
          <SceneCameraDebugOverlay
            camera={{ ...camera, zoom: 1 }}
            viewportSize={viewportSize}
            viewportCenter={viewportCenter}
            worldBounds={worldBounds}
          />
        )}
      </div>
    </div>
  );
}

/** Debug overlay showing camera, viewport, and world bounds. */
function SceneCameraDebugOverlay({
  camera,
  viewportSize,
  viewportCenter,
  worldBounds,
}: {
  camera: CameraState;
  viewportSize: { width: number; height: number };
  viewportCenter: { x: number; y: number };
  worldBounds: SceneBounds;
}) {
  const screenOrigin = worldToScreen(0, 0, camera, viewportCenter.x, viewportCenter.y);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {/* World Bounds Rectangle */}
      <div
        style={{
          position: "absolute",
          left: worldToScreen(worldBounds.minX, 0, camera, viewportCenter.x, viewportCenter.y).x,
          top: worldToScreen(0, worldBounds.minY, camera, viewportCenter.x, viewportCenter.y).y,
          width: worldToScreenDim(worldBounds.width, camera),
          height: worldToScreenDim(worldBounds.height, camera),
          border: "2px dashed rgba(59, 130, 246, 0.5)",
          background: "rgba(59, 130, 246, 0.05)",
        }}
      />

      {/* World Origin Crosshair */}
      <div
        style={{
          position: "absolute",
          left: screenOrigin.x,
          top: screenOrigin.y,
          width: 20,
          height: 1,
          background: "red",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: screenOrigin.x,
          top: screenOrigin.y,
          width: 1,
          height: 20,
          background: "red",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Info Panel */}
      <div
        style={{
          position: "absolute",
          left: 10,
          top: 10,
          padding: "8px 12px",
          background: "rgba(0,0,0,0.8)",
          color: "#fff",
          fontSize: "11px",
          fontFamily: "monospace",
          borderRadius: 4,
        }}
      >
        <div>Camera: x={camera.x.toFixed(1)} y={camera.y.toFixed(1)} zoom={camera.zoom.toFixed(2)}</div>
        <div>Viewport: {viewportSize.width}x{viewportSize.height}</div>
        <div>World origin screen: {screenOrigin.x.toFixed(1)}, {screenOrigin.y.toFixed(1)}</div>
        <div>World bounds: {worldBounds.width.toFixed(0)}x{worldBounds.height.toFixed(0)}</div>
      </div>

      {/* Viewport Border */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          border: "2px solid rgba(255,0,0,0.3)",
        }}
      />
    </div>
  );
}
