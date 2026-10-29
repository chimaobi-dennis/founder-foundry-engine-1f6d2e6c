import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The board's surface: a pannable, zoomable sheet that Kinika draws on. The
 * founder never arranges anything here; the layout is Kinika's, so panning
 * and zooming are the only gestures. Space grows in any direction as Kinika
 * adds circles, and the view can always be brought back with fit().
 */
export interface Camera { x: number; y: number; scale: number }

export function BoardCanvas({ children, camera, onCamera, className, cursor }: {
  children: ReactNode;
  camera: Camera;
  onCamera: (c: Camera) => void;
  className?: string;
  /** Kinika's cursor on the sheet, in sheet coordinates. */
  cursor?: { x: number; y: number; label: string; busy?: boolean } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    onCamera({ ...camera, x: drag.current.cx + (e.clientX - drag.current.x), y: drag.current.cy + (e.clientY - drag.current.y) });
  };
  const onPointerUp = () => { drag.current = null; setDragging(false); };

  // Wheel pans; with ctrl or cmd (and on trackpad pinch) it zooms around the pointer.
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const el = ref.current; if (!el) return;
    if (e.ctrlKey || e.metaKey) {
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const next = Math.min(2.5, Math.max(0.35, camera.scale * (1 - e.deltaY * 0.0025)));
      const k = next / camera.scale;
      onCamera({ scale: next, x: px - (px - camera.x) * k, y: py - (py - camera.y) * k });
    } else {
      onCamera({ ...camera, x: camera.x - e.deltaX, y: camera.y - e.deltaY });
    }
  }, [camera, onCamera]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  return (
    <div ref={ref} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      className={cn("relative w-full h-full overflow-hidden select-none touch-none", dragging ? "cursor-grabbing" : "cursor-grab", className)}
      style={{ backgroundImage: "radial-gradient(hsl(var(--border)) 1px, transparent 1px)", backgroundSize: `${24 * camera.scale}px ${24 * camera.scale}px`, backgroundPosition: `${camera.x}px ${camera.y}px` }}
      aria-label="The board">
      <div className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
        {children}
        {cursor && <KinikaCursor x={cursor.x} y={cursor.y} label={cursor.label} busy={cursor.busy} />}
      </div>
    </div>
  );
}

/** Kinika's pointer on the sheet, moved by Kinika as it places each circle. */
export function KinikaCursor({ x, y, label, busy }: { x: number; y: number; label: string; busy?: boolean }) {
  return (
    <div className="absolute left-0 top-0 pointer-events-none z-10" style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 650ms cubic-bezier(.2,.8,.2,1)" }} role="img" aria-label={`Kinika: ${label}`}>
      <MousePointer2 size={20} className="text-primary fill-primary drop-shadow" />
      <span className={cn("absolute left-4 top-4 whitespace-nowrap rounded-md bg-primary text-primary-foreground font-ui text-[11px] px-2 py-1 shadow", busy && "animate-pulse")}>
        <span className="font-semibold">Kinika</span>{label ? <span className="opacity-90"> · {label}</span> : null}
      </span>
    </div>
  );
}

/** A camera that shows a sheet-space box with a margin, centred in the viewport. */
export function fitCamera(viewport: { width: number; height: number }, box: { width: number; height: number }, margin = 48): Camera {
  const scale = Math.min(1, (viewport.width - margin * 2) / Math.max(1, box.width), (viewport.height - margin * 2) / Math.max(1, box.height));
  return { scale, x: (viewport.width - box.width * scale) / 2, y: Math.max(margin, (viewport.height - box.height * scale) / 2) };
}
