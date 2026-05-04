import { useEffect, useRef, useState } from "react";
import type { CanvasItem } from "../CanvasSwitcher";

interface Props {
  canvases: CanvasItem[];
  activeCanvasId: string | null;
  /** True when the user explicitly hit "Regenerate visual" on the active canvas. */
  regenerating: boolean;
}

const SINGLE_DURATION_MS = 8000;
const SINGLE_TARGET = 95;
const COLLAPSE_MS = 200;

/**
 * Slim progress strip that sits between the editor toolbar and the canvas.
 * - During an initial bulk generation it shows "Generating X of Y platforms…"
 *   with progress derived from how many canvases have finished.
 * - During a single Regenerate-visual run it shows
 *   "Regenerating <Platform> visual…" with a time-based animation that eases
 *   to ~95% over ~8s and snaps to 100% on completion.
 * - Collapses to height 0 (200ms) when no generation is in flight.
 */
export function ContentStudioGenerationStrip({
  canvases,
  activeCanvasId,
  regenerating,
}: Props) {
  const generatingCount = canvases.filter((c) => c.status === "generating").length;
  const failedCount = canvases.filter((c) => c.status === "failed").length;
  const readyCount = canvases.filter(
    (c) => c.status === "ready" || c.status === "approved" || c.status === "scheduled" || c.isApproved,
  ).length;
  const total = canvases.length;
  const active = canvases.find((c) => c.id === activeCanvasId) || null;

  const isSingle =
    regenerating || (generatingCount === 1 && total > 1 ? true : generatingCount === 1);
  const isFull = generatingCount > 1;
  const visible = isFull || regenerating || generatingCount > 0 || failedCount > 0;

  // ---- Single-regen time-based animation ----
  const [singlePct, setSinglePct] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const isSingleActive = visible && !isFull;
    if (!isSingleActive) {
      startedAtRef.current = null;
      setSinglePct(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    if (startedAtRef.current == null) startedAtRef.current = performance.now();
    const tick = () => {
      const t = (performance.now() - (startedAtRef.current || 0)) / SINGLE_DURATION_MS;
      // ease-out, capped at SINGLE_TARGET
      const eased = 1 - Math.pow(1 - Math.min(1, t), 2);
      setSinglePct(Math.min(SINGLE_TARGET, eased * SINGLE_TARGET));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, isFull]);

  // Snap to 100 briefly when transitioning from visible → hidden so the bar
  // visually completes before the strip collapses.
  const [snapFull, setSnapFull] = useState(false);
  const wasVisible = useRef(false);
  useEffect(() => {
    if (wasVisible.current && !visible) {
      setSnapFull(true);
      const t = window.setTimeout(() => setSnapFull(false), COLLAPSE_MS);
      return () => window.clearTimeout(t);
    }
    wasVisible.current = visible;
  }, [visible]);

  // ---- Compute label + percentage to render ----
  let label = "";
  let pct = 0;
  if (isFull) {
    const done = total - generatingCount;
    label = `Generating ${done + 1} of ${total} platforms…`;
    pct = total ? (done / total) * 100 : 0;
  } else if (generatingCount > 0 || regenerating) {
    const name = active?.label || "platform";
    label = `Regenerating ${name} visual…`;
    pct = singlePct;
  } else if (failedCount > 0) {
    // Generation finished but some platforms failed
    pct = 100;
    label = `${readyCount} ready · ${failedCount} failed`;
  }
  // If multiple states present and we're in "full" mode, surface a richer summary.
  if (isFull && failedCount > 0) {
    label = `${readyCount} ready · ${failedCount} failed · ${generatingCount} generating`;
  }
  if (snapFull) pct = 100;

  const showStrip = visible || snapFull;
  const failedPct = total ? (failedCount / total) * 100 : 0;
  const hasFailed = failedCount > 0;

  return (
    <div
      className="relative w-full overflow-hidden flex-shrink-0"
      style={{
        height: showStrip ? 38 : 0,
        transition: `height ${COLLAPSE_MS}ms ease`,
        borderBottom: showStrip ? "1px solid hsl(var(--border))" : "none",
        background: "hsl(var(--card) / 0.6)",
        backdropFilter: "blur(6px)",
      }}
      aria-hidden={!showStrip}
    >
      {/* Amber fill */}
      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: `${pct}%`,
          background: hasFailed
            ? "linear-gradient(90deg, rgba(224,92,92,0.18), rgba(224,92,92,0.32))"
            : "linear-gradient(90deg, rgba(212,160,23,0.18), rgba(212,160,23,0.32))",
          transition: "width 220ms ease",
        }}
      />
      {/* Red overlay portion for failed share */}
      {hasFailed && (
        <div
          className="absolute inset-y-0 right-0"
          style={{
            width: `${failedPct}%`,
            background: "linear-gradient(90deg, rgba(224,92,92,0.25), rgba(224,92,92,0.4))",
          }}
        />
      )}
      {/* Top hairline accent */}
      <div
        className="absolute top-0 left-0 h-[2px]"
        style={{
          width: `${pct}%`,
          background: hasFailed ? "#E05C5C" : "#D4A017",
          boxShadow: hasFailed ? "0 0 8px rgba(224,92,92,0.6)" : "0 0 8px rgba(212,160,23,0.6)",
          transition: "width 220ms ease",
        }}
      />
      <div className="relative h-full flex items-center justify-center gap-2 px-4">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{
            background: hasFailed ? "#E05C5C" : "#D4A017",
            boxShadow: hasFailed ? "0 0 6px rgba(224,92,92,0.7)" : "0 0 6px rgba(212,160,23,0.7)",
            animation: pct < 100 && !hasFailed ? "pulse 1.4s ease-in-out infinite" : undefined,
          }}
        />
        <span
          className="text-[11px] font-ui tracking-wide truncate"
          style={{ color: hasFailed && generatingCount === 0 ? "#E05C5C" : "hsl(var(--foreground))" }}
        >
          {label}
        </span>
        {generatingCount > 0 && (
          <span className="text-[10px] font-ui text-muted-foreground tabular-nums">
            {Math.round(pct)}%
          </span>
        )}
      </div>
    </div>
  );
}
