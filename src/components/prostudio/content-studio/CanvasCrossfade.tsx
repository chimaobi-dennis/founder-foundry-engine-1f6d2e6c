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

function initialFor(canvasId: string, isGenerating: boolean, hasHtml: boolean): CanvasProgressState {
  const stored = getCanvasProgress(canvasId);
  if (stored) return stored;
  if (!isGenerating && hasHtml) {
    return { progress: 100, phase: "ready", ready: true, updatedAt: Date.now() };
  }
  return {
    progress: isGenerating ? 10 : 0,
    phase: isGenerating ? "generating" : "loading",
    ready: false,
    updatedAt: Date.now(),
  };
}

/**
 * Crossfade between the generating skeleton and the real canvas, with a
 * persistent top progress bar. Progress is keyed by `canvasId` and stored in
 * a small in-memory + sessionStorage cache so switching tabs / platforms
 * resumes the indicator instead of restarting it.
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
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const skeletonTimerRef = useRef<number | null>(null);
  const trickleRef = useRef<number | null>(null);

  // Re-sync local state when canvasId changes (user switched platforms).
  useEffect(() => {
    const s = initialFor(canvasId, isGenerating, hasHtml);
    setProgress(s.progress);
    setCanvasReady(s.ready);
    setShowSkeleton(!s.ready);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  // Subscribe to external updates for this canvas (e.g. another mount of the
  // crossfade while we navigate away — keeps progress in sync).
  useEffect(() => {
    return subscribeCanvasProgress(canvasId, (s) => {
      setProgress(s.progress);
      if (s.ready) {
        setCanvasReady(true);
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
      writeProgress({ phase: "generating", ready: false });
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
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled) return;
      setProgress((p) => Math.max(p, 55));
      writeProgress({ progress: 55 });

      const root = canvasWrapRef.current;
      if (root) {
        const imgs = Array.from(root.querySelectorAll("img"));
        const total = imgs.length;
        let loaded = imgs.filter((img) => img.complete).length;

        const reportProgress = () => {
          if (total === 0) return;
          const ratio = loaded / total;
          const next = 55 + Math.round(ratio * 40);
          setProgress(next);
          writeProgress({ progress: next });
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
      writeProgress({ progress: 100, phase: "ready", ready: true });
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
