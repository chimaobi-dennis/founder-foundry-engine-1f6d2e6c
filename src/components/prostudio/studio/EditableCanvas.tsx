import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import type { StudioElement, SelectionRect } from "./types";

interface Props {
  html: string;
  zoom: number;
  width: number;
  height: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onElementsParsed: (els: StudioElement[]) => void;
  onElementMutated: () => void;
  /** Reports the intrinsic size detected from the injected HTML root. */
  onIntrinsicSize?: (size: { width: number; height: number }) => void;
  // Lookup so canvas knows which elements are visible/locked from layers panel
  getElementState: (id: string) => { visible: boolean; locked: boolean } | undefined;
  // Pulse counter to force re-measure (e.g. after applying property changes)
  refreshKey: number;
  /**
   * When true, prepend a CSS reset that forces the injected root to fill the
   * stage exactly — used in content-studio mode where the canvas size is
   * dictated by the platform (image_width × image_height) and the AI HTML
   * must conform, not the other way around.
   */
  forceFillStage?: boolean;
}

type DragMode = null | "move" | "resize-tl" | "resize-tr" | "resize-bl" | "resize-br";

/** Parse "600px" / "600" / "100%" — return number or null. */
function parsePx(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = String(value).match(/([\d.]+)\s*px/);
  if (m) return parseFloat(m[1]);
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

/**
 * Read intrinsic dimensions from the injected root.
 * Looks for inline width/height in style, then attributes, then defaults to props.
 */
function detectIntrinsicSize(stage: HTMLElement, fallback: { width: number; height: number }) {
  // Pick the first wrapping element with inline width/height, else use stage itself
  const root = stage.firstElementChild as HTMLElement | null;
  const candidates: HTMLElement[] = [];
  if (root) candidates.push(root);
  // Also inspect any element with data-element="background" as it usually defines size
  const bg = stage.querySelector<HTMLElement>('[data-element-type="background"], [data-element="background"]');
  if (bg) candidates.push(bg);

  for (const el of candidates) {
    const style = el.getAttribute("style") || "";
    const wMatch = style.match(/width\s*:\s*([\d.]+)px/i);
    const hMatch = style.match(/height\s*:\s*([\d.]+)px/i);
    const w = wMatch ? parseFloat(wMatch[1]) : parsePx(el.getAttribute("width"));
    const h = hMatch ? parseFloat(hMatch[1]) : parsePx(el.getAttribute("height"));
    if (w && h) return { width: w, height: h };
  }
  return fallback;
}

export function EditableCanvas({
  html,
  zoom,
  width,
  height,
  selectedId,
  onSelect,
  onElementsParsed,
  onElementMutated,
  onIntrinsicSize,
  getElementState,
  refreshKey,
  forceFillStage,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);

  // Inject HTML & wire selection. Re-runs when html changes.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // When the parent dictates exact canvas dimensions (content-studio mode),
    // prepend a CSS reset so the AI-generated root fills the stage exactly —
    // no white space, regardless of what the AI emitted.
    const fillReset = forceFillStage
      ? `<style data-fill-reset>
          html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
          [data-studio-stage-root] > * { width: 100% !important; height: 100% !important; box-sizing: border-box; }
        </style>`
      : "";
    stage.innerHTML = fillReset + html;
    if (forceFillStage) {
      // Wrap injected content in a marker so the > * selector above matches.
      stage.setAttribute("data-studio-stage-root", "");
    }

    // Assign unique data-studio-id to every [data-element] node based on its
    // data-element value + DOM index.
    const nodes = Array.from(
      stage.querySelectorAll<HTMLElement>("[data-element]"),
    );
    nodes.forEach((el, idx) => {
      const base = el.dataset.element || "el";
      const studioId = `${base}-${idx}`;
      el.dataset.studioId = studioId;
    });

    const elements: StudioElement[] = nodes.map((el) => ({
      id: el.dataset.studioId || "",
      type: (el.dataset.elementType as StudioElement["type"]) || "shape",
      name: el.dataset.elementName || el.dataset.element || "Element",
      visible: true,
      locked: false,
    }));
    onElementsParsed(elements);

    // Detect intrinsic size from the HTML and report back so parent can
    // size the stage container. Skipped when forceFillStage is true — the
    // platform's image_width/image_height is the source of truth.
    if (onIntrinsicSize && !forceFillStage) {
      const size = detectIntrinsicSize(stage, { width, height });
      onIntrinsicSize(size);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, forceFillStage]);

  // Apply visibility / lock attributes from layers panel
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.querySelectorAll<HTMLElement>("[data-studio-id]").forEach((el) => {
      const id = el.dataset.studioId || "";
      const state = getElementState(id);
      if (!state) return;
      el.style.display = state.visible ? "" : "none";
      el.style.pointerEvents = state.locked ? "none" : "";
      el.dataset.locked = state.locked ? "true" : "false";
    });
  }, [getElementState, refreshKey, html]);

  // Measure currently selected element to position the bounding box
  const measureSelection = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !selectedId) {
      setSelectionRect(null);
      return;
    }
    const el = stage.querySelector<HTMLElement>(
      `[data-studio-id="${CSS.escape(selectedId)}"]`,
    );
    if (!el) {
      setSelectionRect(null);
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setSelectionRect({
      top: (r.top - stageRect.top) / zoom,
      left: (r.left - stageRect.left) / zoom,
      width: r.width / zoom,
      height: r.height / zoom,
    });
  }, [selectedId, zoom]);

  useLayoutEffect(() => {
    measureSelection();
  }, [measureSelection, refreshKey, html]);

  // Handle clicks within the stage to select elements
  const onStageClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const hit = target.closest<HTMLElement>("[data-studio-id]");
    if (hit && hit.dataset.locked !== "true") {
      onSelect(hit.dataset.studioId || null);
    } else {
      onSelect(null);
    }
  };

  // Double-click to enter inline text editing
  const onStageDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const hit = target.closest<HTMLElement>("[data-studio-id]");
    if (!hit || hit.dataset.elementType !== "text") return;
    hit.setAttribute("contenteditable", "true");
    hit.focus();
    const onBlur = () => {
      hit.setAttribute("contenteditable", "false");
      hit.removeEventListener("blur", onBlur);
      onElementMutated();
    };
    hit.addEventListener("blur", onBlur);
  };

  // Drag to move + resize
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    origTop: number;
    origLeft: number;
    origWidth: number;
    origHeight: number;
    el: HTMLElement;
  } | null>(null);

  const beginDrag = (mode: DragMode) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage || !selectedId) return;
    const el = stage.querySelector<HTMLElement>(
      `[data-studio-id="${CSS.escape(selectedId)}"]`,
    );
    if (!el) return;
    const cs = window.getComputedStyle(el);
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origTop: parseFloat(cs.top) || 0,
      origLeft: parseFloat(cs.left) || 0,
      origWidth: el.getBoundingClientRect().width / zoom,
      origHeight: el.getBoundingClientRect().height / zoom,
      el,
    };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  };

  const onDragMove = (e: MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;
    if (d.mode === "move") {
      d.el.style.left = `${d.origLeft + dx}px`;
      d.el.style.top = `${d.origTop + dy}px`;
    } else if (d.mode === "resize-br") {
      d.el.style.width = `${Math.max(20, d.origWidth + dx)}px`;
      d.el.style.height = `${Math.max(20, d.origHeight + dy)}px`;
    } else if (d.mode === "resize-bl") {
      d.el.style.width = `${Math.max(20, d.origWidth - dx)}px`;
      d.el.style.height = `${Math.max(20, d.origHeight + dy)}px`;
      d.el.style.left = `${d.origLeft + dx}px`;
    } else if (d.mode === "resize-tr") {
      d.el.style.width = `${Math.max(20, d.origWidth + dx)}px`;
      d.el.style.height = `${Math.max(20, d.origHeight - dy)}px`;
      d.el.style.top = `${d.origTop + dy}px`;
    } else if (d.mode === "resize-tl") {
      d.el.style.width = `${Math.max(20, d.origWidth - dx)}px`;
      d.el.style.height = `${Math.max(20, d.origHeight - dy)}px`;
      d.el.style.top = `${d.origTop + dy}px`;
      d.el.style.left = `${d.origLeft + dx}px`;
    }
    measureSelection();
  };

  const onDragEnd = () => {
    if (dragRef.current) {
      dragRef.current = null;
      onElementMutated();
    }
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
  };

  useEffect(
    () => () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div
      className="overflow-hidden rounded-sm relative bg-white"
      style={{ width: width * zoom, height: height * zoom }}
    >
      {/* Stage — actual editable HTML at native size, scaled via transform */}
      <div
        ref={stageRef}
        onClick={onStageClick}
        onDoubleClick={onStageDoubleClick}
        style={{
          width,
          height,
          position: "relative",
          overflow: "hidden",
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
        }}
      />

      {/* Selection bounding box overlay (drawn in stage's pre-scale coords, scaled here) */}
      {selectionRect && selectedId && (
        <div
          className="absolute"
          style={{
            top: selectionRect.top * zoom,
            left: selectionRect.left * zoom,
            width: selectionRect.width * zoom,
            height: selectionRect.height * zoom,
            border: "2px solid hsl(var(--primary))",
            cursor: "move",
            pointerEvents: "auto",
          }}
          onMouseDown={beginDrag("move")}
        >
          {/* Corner handles */}
          {(["tl", "tr", "bl", "br"] as const).map((pos) => (
            <div
              key={pos}
              onMouseDown={beginDrag(`resize-${pos}` as DragMode)}
              className="absolute w-2.5 h-2.5 rounded-[2px] bg-primary border border-background"
              style={{
                top: pos.startsWith("t") ? -5 : "auto",
                bottom: pos.startsWith("b") ? -5 : "auto",
                left: pos.endsWith("l") ? -5 : "auto",
                right: pos.endsWith("r") ? -5 : "auto",
                cursor:
                  pos === "tl" || pos === "br" ? "nwse-resize" : "nesw-resize",
              }}
            />
          ))}
          {/* Edge midpoint indicators */}
          {(["t", "r", "b", "l"] as const).map((side) => (
            <div
              key={side}
              className="absolute w-2 h-2 rounded-[2px] bg-primary border border-background pointer-events-none"
              style={{
                top:
                  side === "t" ? -4 : side === "b" ? "auto" : "calc(50% - 4px)",
                bottom: side === "b" ? -4 : "auto",
                left:
                  side === "l" ? -4 : side === "r" ? "auto" : "calc(50% - 4px)",
                right: side === "r" ? -4 : "auto",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Helper: read & write inline style on an element by id within a host
export function mutateElement(
  host: HTMLElement | null,
  id: string,
  apply: (el: HTMLElement) => void,
) {
  if (!host) return;
  const el = host.querySelector<HTMLElement>(
    `[data-studio-id="${CSS.escape(id)}"]`,
  );
  if (el) apply(el);
}
