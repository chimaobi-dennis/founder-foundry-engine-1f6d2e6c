import { useEffect, useRef, useState, type ReactNode } from "react";
import { CanvasGenerating } from "./CanvasGenerating";
import {
  getCanvasProgress,
  setCanvasProgress,
  subscribeCanvasProgress,
  type CanvasProgressState,
} from "./canvasProgressStore";

interface Props {
  /** Stable id for the canvas (e.g. creative id). Used to persist progress
   *  across tab switches and platform navigation. */
  canvasId: string;
  isGenerating: boolean;
  hasHtml: boolean;
  platformName: string;
  width: number;
  height: number;
  zoom: number;
  children: ReactNode;
}

const FADE_MS = 350;

const STALE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Reconcile stored progress with the live props so a refresh or platform
 * switch always restores the correct phase.
 *
 * Truth rules (props win over stored):
 *  - Live `isGenerating` → phase is always "generating".
 *  - No HTML yet         → phase is "loading" at minimum.
 *  - Stored entry stale  → discard.
 *  - Otherwise           → use stored value verbatim.
 */
function initialFor(
  canvasId: string,
  isGenerating: boolean,
  hasHtml: boolean,
): CanvasProgressState {
  const stored = getCanvasProgress(canvasId);
  const fresh = stored && Date.now() - stored.updatedAt < STALE_MS ? stored : undefined;

  if (isGenerating) {
    return {
      progress: Math.min(fresh?.progress ?? 10, 30),
      phase: "generating",
      ready: false,
      step: fresh?.step || "Generating…",
      updatedAt: Date.now(),
    };
  }
  if (!hasHtml) {
    return {
      progress: fresh?.progress ?? 0,
      phase: fresh?.phase === "ready" ? "loading" : fresh?.phase ?? "loading",
      ready: false,
      step: fresh?.step || "Waiting for output…",
      updatedAt: Date.now(),
    };
  }
  if (fresh) return fresh;
  // Have HTML, no stored entry — assume already-rendered ready state.
  return {
    progress: 100,
    phase: "ready",
    ready: true,
    step: "Ready",
    updatedAt: Date.now(),
  };
}

/**
 * Crossfade between the generating skeleton and the real canvas, with a
 * persistent top progress bar. Progress is keyed by `canvasId` and stored in
 * a small in-memory + sessionStorage cache so switching tabs / platforms /
 * refreshing the page resumes the indicator instead of restarting it.
 */
export function CanvasCrossfade({
  canvasId,
  isGenerating,
  hasHtml,
  platformName,
  width,
  height,
  zoom,
  children,
}: Props) {
  const initial = initialFor(canvasId, isGenerating, hasHtml);
  const [progress, setProgress] = useState(initial.progress);
  const [canvasReady, setCanvasReady] = useState(initial.ready);
  const [showSkeleton, setShowSkeleton] = useState(!initial.ready);
  const [phase, setPhase] = useState<CanvasProgressState["phase"]>(initial.phase);
  const [step, setStep] = useState<string>(initial.step || "Preparing…");
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const skeletonTimerRef = useRef<number | null>(null);
  const trickleRef = useRef<number | null>(null);

  // Stamp the reconciled initial state back into the store on mount so other
  // mounts (e.g. another platform tab) read the corrected value.
  useEffect(() => {
    setCanvasProgress(canvasId, initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  // Re-sync when canvasId OR live props change (props are authoritative).
  useEffect(() => {
    const s = initialFor(canvasId, isGenerating, hasHtml);
    setProgress(s.progress);
    setCanvasReady(s.ready);
    setShowSkeleton(!s.ready);
    setPhase(s.phase);
    setStep(s.step || "Preparing…");
    setCanvasProgress(canvasId, s);
  }, [canvasId, isGenerating, hasHtml]);

  // Subscribe to external store updates for this canvas.
  useEffect(() => {
    return subscribeCanvasProgress(canvasId, (s) => {
      setProgress(s.progress);
      setPhase(s.phase);
      if (s.step) setStep(s.step);
      if (s.ready) {
        setCanvasReady(true);
      } else if (s.phase === "generating" || s.phase === "loading") {
        // Phase regressed — make sure we stop showing it as ready.
        setCanvasReady(false);
        setShowSkeleton(true);
      }
    });
  }, [canvasId]);

  // Persist helper
  const writeProgress = (patch: Partial<CanvasProgressState>) => {
    setCanvasProgress(canvasId, patch);
  };

  // While generating, trickle progress up to ~30%, resuming from current value.
  useEffect(() => {
    if (isGenerating) {
      setShowSkeleton(true);
      setCanvasReady(false);
      setStep("Generating…");
      writeProgress({ phase: "generating", ready: false, step: "Generating…" });
      if (skeletonTimerRef.current) {
        window.clearTimeout(skeletonTimerRef.current);
        skeletonTimerRef.current = null;
      }
      trickleRef.current = window.setInterval(() => {
        setProgress((p) => {
          const next = p < 30 ? p + 1 : p;
          if (next !== p) writeProgress({ progress: next });
          return next;
        });
      }, 250);
      return () => {
        if (trickleRef.current) {
          window.clearInterval(trickleRef.current);
          trickleRef.current = null;
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating, canvasId]);

  // When generation completes, wait for paint + image loads before swapping.
  useEffect(() => {
    if (isGenerating || !hasHtml) return;
    // If we're already marked ready in the store, skip the wait pipeline.
    const stored = getCanvasProgress(canvasId);
    if (stored?.ready) {
      setProgress(100);
      setCanvasReady(true);
      setShowSkeleton(false);
      return;
    }

    let cancelled = false;
    setCanvasReady(false);
    setProgress((p) => Math.max(p, 35));
    writeProgress({ phase: "loading", progress: Math.max(stored?.progress ?? 0, 35) });

    const waitForReady = async () => {
      writeProgress({ step: "Mounting layout…" });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled) return;
      setProgress((p) => Math.max(p, 55));
      writeProgress({ progress: 55, step: "Rendering HTML…" });

      const root = canvasWrapRef.current;
      if (root) {
        const imgs = Array.from(root.querySelectorAll("img"));
        const total = imgs.length;
        let loaded = imgs.filter((img) => img.complete).length;

        const reportProgress = () => {
          if (total === 0) {
            writeProgress({ step: "Finalizing…" });
            return;
          }
          const ratio = loaded / total;
          const next = 55 + Math.round(ratio * 40);
          setProgress(next);
          writeProgress({
            progress: next,
            step: `Loading images (${loaded}/${total})…`,
          });
        };
        reportProgress();

        const pending = imgs
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise<void>((resolve) => {
                const done = () => {
                  loaded += 1;
                  reportProgress();
                  resolve();
                };
                img.addEventListener("load", done, { once: true });
                img.addEventListener("error", done, { once: true });
              }),
          );
        await Promise.race([
          Promise.all(pending),
          new Promise((r) => window.setTimeout(r, 800)),
        ]);
      }
      if (cancelled) return;

      setProgress(100);
      setCanvasReady(true);
      writeProgress({ progress: 100, phase: "ready", ready: true, step: "Ready" });
      skeletonTimerRef.current = window.setTimeout(() => {
        setShowSkeleton(false);
      }, FADE_MS);
    };

    waitForReady();
    return () => {
      cancelled = true;
      if (skeletonTimerRef.current) {
        window.clearTimeout(skeletonTimerRef.current);
        skeletonTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating, hasHtml, canvasId]);

  const showProgress = showSkeleton || progress < 100;

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <div
        className="absolute top-0 left-0 right-0 h-[2px] z-20 overflow-hidden pointer-events-none"
        style={{
          background: "rgba(255,255,255,0.06)",
          opacity: showProgress ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      >
        <div
          className="h-full"
          style={{
            width: `${progress}%`,
            background: "hsl(var(--primary))",
            boxShadow: "0 0 8px hsl(var(--primary) / 0.6)",
            transition: "width 220ms ease",
          }}
        />
      </div>

      {/* Step label chip — phase badge + live step + percentage */}
      {(() => {
        const phaseMeta: Record<string, { label: string; color: string }> = {
          generating: { label: "GENERATING", color: "#D4A017" },
          loading: { label: "LOADING", color: "#5BA9F2" },
          ready: { label: "READY", color: "#4ADE80" },
          idle: { label: "IDLE", color: "#8A96A3" },
        };
        const meta = phaseMeta[phase] || phaseMeta.idle;
        return (
          <div
            className="absolute top-2 right-3 z-20 pointer-events-none flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full font-ui text-[10px] tracking-wide"
            style={{
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(6px)",
              color: "rgba(255,255,255,0.9)",
              border: "1px solid rgba(255,255,255,0.08)",
              opacity: showProgress ? 1 : 0,
              transform: showProgress ? "translateY(0)" : "translateY(-4px)",
              transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
            }}
            title={`${meta.label} — ${step} (${Math.round(progress)}%)`}
          >
            <span
              className="px-1.5 py-[2px] rounded-full text-[9px] font-semibold tracking-[0.08em]"
              style={{
                background: `${meta.color}22`,
                color: meta.color,
                border: `1px solid ${meta.color}55`,
              }}
            >
              {meta.label}
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: meta.color,
                boxShadow: `0 0 6px ${meta.color}cc`,
                animation: progress < 100 ? "pulse 1.4s ease-in-out infinite" : undefined,
              }}
            />
            <span className="text-foreground/90">{step}</span>
            <span className="opacity-60 tabular-nums">{Math.round(progress)}%</span>
          </div>
        );
      })()}

      <div
        ref={canvasWrapRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: canvasReady ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease`,
          pointerEvents: canvasReady ? "auto" : "none",
        }}
      >
        {children}
      </div>

      {showSkeleton && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            opacity: canvasReady ? 0 : 1,
            transition: `opacity ${FADE_MS}ms ease`,
            pointerEvents: canvasReady ? "none" : "auto",
          }}
        >
          <CanvasGenerating
            platformName={platformName}
            width={width}
            height={height}
            scale={zoom}
          />
        </div>
      )}
    </div>
  );
}
