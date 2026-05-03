import { useEffect, useRef, useState, type ReactNode } from "react";
import { CanvasGenerating } from "./CanvasGenerating";

interface Props {
  isGenerating: boolean;
  hasHtml: boolean;
  platformName: string;
  width: number;
  height: number;
  zoom: number;
  children: ReactNode;
}

const FADE_MS = 350;

/**
 * Crossfade between the generating skeleton and the real canvas.
 *
 * Behavior:
 *  - While `isGenerating`, only the skeleton is visible.
 *  - When generation completes, the real canvas is mounted but kept invisible
 *    until its images have loaded (or a short safety timeout elapses). Then the
 *    skeleton fades out and the canvas fades in simultaneously.
 *  - The skeleton stays mounted until the fade is complete to avoid flashes.
 */
export function CanvasCrossfade({
  isGenerating,
  hasHtml,
  platformName,
  width,
  height,
  zoom,
  children,
}: Props) {
  const [showSkeleton, setShowSkeleton] = useState(isGenerating || !hasHtml);
  const [canvasReady, setCanvasReady] = useState(!isGenerating && hasHtml);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const skeletonTimerRef = useRef<number | null>(null);

  // When generation starts, immediately show the skeleton and hide the canvas.
  useEffect(() => {
    if (isGenerating) {
      setShowSkeleton(true);
      setCanvasReady(false);
      if (skeletonTimerRef.current) {
        window.clearTimeout(skeletonTimerRef.current);
        skeletonTimerRef.current = null;
      }
    }
  }, [isGenerating]);

  // When generation completes, wait for the canvas to be fully rendered before
  // swapping. We wait for: next paint + all <img> elements inside to load.
  useEffect(() => {
    if (isGenerating || !hasHtml) return;

    let cancelled = false;
    setCanvasReady(false);

    const waitForReady = async () => {
      // Wait two frames so the new HTML has been painted.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled) return;

      const root = canvasWrapRef.current;
      if (root) {
        const imgs = Array.from(root.querySelectorAll("img"));
        const pending = imgs
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise<void>((resolve) => {
                const done = () => resolve();
                img.addEventListener("load", done, { once: true });
                img.addEventListener("error", done, { once: true });
              }),
          );
        // Safety cap so we never hang on a slow asset.
        await Promise.race([
          Promise.all(pending),
          new Promise((r) => window.setTimeout(r, 800)),
        ]);
      }
      if (cancelled) return;

      setCanvasReady(true);
      // Unmount skeleton after fade completes.
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
  }, [isGenerating, hasHtml]);

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      {/* Real canvas — mounted but hidden until ready */}
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

      {/* Skeleton overlay */}
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
