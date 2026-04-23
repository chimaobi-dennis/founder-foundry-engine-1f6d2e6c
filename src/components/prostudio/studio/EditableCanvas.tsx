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
  // Lookup so canvas knows which elements are visible/locked from layers panel
  getElementState: (id: string) => { visible: boolean; locked: boolean } | undefined;
  // Pulse counter to force re-measure (e.g. after applying property changes)
  refreshKey: number;
}

type DragMode = null | "move" | "resize-tl" | "resize-tr" | "resize-bl" | "resize-br";

export function EditableCanvas({
  html,
  zoom,
  width,
  height,
  selectedId,
  onSelect,
  onElementsParsed,
  onElementMutated,
  getElementState,
  refreshKey,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);

  // Inject HTML & wire selection. Re-runs when html changes.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.innerHTML = html;

    const nodes = Array.from(
      stage.querySelectorAll<HTMLElement>("[data-element]"),
    );

    const elements: StudioElement[] = nodes.map((el) => ({
      id: el.dataset.element || "",
      type: (el.dataset.elementType as StudioElement["type"]) || "shape",
      name: el.dataset.elementName || el.dataset.element || "Element",
      visible: true,
      locked: false,
    }));
    onElementsParsed(elements);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  // Apply visibility / lock attributes from layers panel
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.querySelectorAll<HTMLElement>("[data-element]").forEach((el) => {
      const id = el.dataset.element || "";
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
      `[data-element="${CSS.escape(selectedId)}"]`,
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
    const hit = target.closest<HTMLElement>("[data-element]");
    if (hit && hit.dataset.locked !== "true") {
      onSelect(hit.dataset.element || null);
    } else {
      onSelect(null);
    }
  };

  // Double-click to enter inline text editing
  const onStageDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const hit = target.closest<HTMLElement>("[data-element]");
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
      `[data-element="${CSS.escape(selectedId)}"]`,
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
    `[data-element="${CSS.escape(id)}"]`,
  );
  if (el) apply(el);
}
