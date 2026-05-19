import { PointerEvent as RPE, useCallback, useEffect, useMemo, useRef, useState, WheelEvent as RWE } from "react";
import type { SceneNode, CameraState, SceneBounds } from "@/types/scene";
import { screenToWorld, screenToWorldDim, worldToScreen, worldToScreenDim, getSceneBounds } from "@/types/scene";
import { useSceneStore, sceneHelpers } from "./sceneStore";
import { SceneNodeRenderer } from "./SceneNodeRenderer";
import { SceneSelectionOverlay } from "./SceneSelectionOverlay";

interface Props {
  className?: string;
  /** Show debug overlay with viewport/world bounds */
  debug?: boolean;
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
export function SceneCanvas({ className, debug = false }: Props) {
  const store = useSceneStore();
  const { document, selectedIds, camera, setSelection, setCamera, dispatch } = store;
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

  // ─── Center and fit camera on content on initial mount ─────────
  // This ensures the design is centered and fully visible like in HTML mode.
  // Calculates zoom to fit content into viewport with padding.
  // Only runs if camera is at default position (0,0,1) to avoid overriding
  // restored positions or user-set positions.
  useEffect(() => {
    if (didInitialCenterRef.current) return;
    if (viewportSize.width === 0 || viewportSize.height === 0) return;
    // Check if camera is at default position (not restored or user-modified)
    const isDefaultPosition =
      camera.x === 0 && camera.y === 0 && camera.zoom === 1;
    if (!isDefaultPosition) {
      didInitialCenterRef.current = true; // Mark as done even if we don't center
      return;
    }
    // Center on the actual content bounds
    const contentCenterX = worldBounds.minX + worldBounds.width / 2;
    const contentCenterY = worldBounds.minY + worldBounds.height / 2;
    // Calculate zoom to fit content into viewport with 10% padding
    const padding = 0.1; // 10% padding around content
    const availableWidth = viewportSize.width * (1 - padding * 2);
    const availableHeight = viewportSize.height * (1 - padding * 2);
    const scaleX = availableWidth / (worldBounds.width || 1);
    const scaleY = availableHeight / (worldBounds.height || 1);
    const fitZoom = Math.max(0.1, Math.min(1.5, Math.min(scaleX, scaleY)));
    // Camera position to center the content in viewport with fit zoom:
    // screenX = viewportCenterX + cameraX + worldX * zoom
    // For center: viewportCenterX = viewportCenterX + cameraX + contentCenterX * zoom
    // Therefore: cameraX = -contentCenterX * zoom
    const targetCamera = {
      x: -contentCenterX * fitZoom,
      y: -contentCenterY * fitZoom,
      zoom: fitZoom,
    };
    setCamera(targetCamera);
    didInitialCenterRef.current = true;
  }, [viewportSize.width, viewportSize.height, worldBounds, camera.x, camera.y, camera.zoom, setCamera]);

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

  // ─── Zoom with cursor focus preservation ─────────────────────
  const onWheel = useCallback((e: RWE<HTMLDivElement>) => {
    if (!viewportRef.current) return;

    // Ctrl/Cmd + wheel = zoom
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();

      // Get cursor position in viewport
      const rect = viewportRef.current.getBoundingClientRect();
      const cursorScreenX = e.clientX - rect.left;
      const cursorScreenY = e.clientY - rect.top;

      // Convert cursor position to world before zoom
      const cursorWorldBefore = screenToWorld(cursorScreenX, cursorScreenY, camera, viewportCenter.x, viewportCenter.y);

      // Calculate new zoom
      const delta = -e.deltaY * 0.002;
      const newZoom = Math.max(0.1, Math.min(5, camera.zoom * (1 + delta)));

      // Adjust camera so that cursor world position stays the same
      // worldX = (screenX - viewportCenterX - cameraX) / zoom
      // Solve for new cameraX:
      // cursorWorldBefore.x = (cursorScreenX - viewportCenterX - newCameraX) / newZoom
      // newCameraX = cursorScreenX - viewportCenterX - cursorWorldBefore.x * newZoom
      const newCameraX = cursorScreenX - viewportCenter.x - cursorWorldBefore.x * newZoom;
      const newCameraY = cursorScreenY - viewportCenter.y - cursorWorldBefore.y * newZoom;

      setCamera({ x: newCameraX, y: newCameraY, zoom: newZoom });
      return;
    }

    // Regular wheel = pan (unless shift for horizontal)
    const dx = e.shiftKey ? -e.deltaY : -e.deltaX;
    const dy = e.shiftKey ? 0 : -e.deltaY;
    setCamera({ ...camera, x: camera.x + dx, y: camera.y + dy });
  }, [camera, setCamera, viewportCenter]);

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
    <div
      ref={viewportRef}
      data-scene-viewport
      onWheel={onWheel}
      onPointerDown={onViewportPointerDown}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden", // Viewport is the ONLY clipping layer
        background: "hsl(var(--background))", // Solid background, no pattern
        cursor: isPanning ? "grabbing" : isSpacePressed ? "grab" : "default",
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
          // Camera transform: viewport center + camera offset, then scale
          transform: `
            translate(${viewportCenter.x + camera.x}px, ${viewportCenter.y + camera.y}px)
            scale(${camera.zoom})
          `,
          transformOrigin: "0 0",
          // No overflow, no fixed dimensions — infinite world
        }}
      >
        {/* Infinite Canvas Background — moves with camera, same color as artboard */}
        <div
          style={{
            position: "absolute",
            left: -50000,
            top: -50000,
            width: 100000,
            height: 100000,
            background: document.background,
            pointerEvents: "none",
          }}
        />

        {/* Artboard Frame — shows the design bounds with subtle border */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: document.width,
            height: document.height,
            border: "1px solid rgba(0,0,0,0.1)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            pointerEvents: "none",
          }}
        />

        {/* Scene Nodes — absolutely positioned in world space */}
        <div
          data-scene-world
          onPointerDownCapture={onNodePointerDownCapture}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            // No overflow, no clipping
          }}
        >
          {sorted.map((node) => (
            <SceneNodeRenderer key={node.id} node={node} />
          ))}
          {selected.map((n) => (
            <SceneSelectionOverlay key={`ov-${n.id}`} node={n} camera={camera} />
          ))}
        </div>
      </div>

      {/* Debug Overlay */}
      {debug && (
        <SceneCameraDebugOverlay
          camera={camera}
          viewportSize={viewportSize}
          viewportCenter={viewportCenter}
          worldBounds={worldBounds}
        />
      )}
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
