import { useEffect, useRef, useState, ReactNode } from "react";

interface Props {
  /** Native scene width in px (e.g. document.width) */
  sceneWidth: number;
  /** Native scene height in px */
  sceneHeight: number;
  /** User-controlled zoom multiplier on top of auto-fit scale. Default 1. */
  userZoom?: number;
  /** Padding (px) reserved around the scene inside the viewport. Default 32. */
  padding?: number;
  /** Render-prop receives the final fitted dimensions (already includes userZoom). */
  children: (fit: {
    fitScale: number;
    finalScale: number;
    width: number;
    height: number;
  }) => ReactNode;
}

/**
 * FitToViewport — measures its own container and computes a uniform
 * scale that fits a (sceneWidth × sceneHeight) artwork into the
 * available area while preserving aspect ratio.
 *
 *   finalScale = min(availW / sceneW, availH / sceneH) * userZoom
 *
 * The artwork is centered both axes via flexbox. No nested transforms,
 * no hardcoded dimensions, no flex constraints leaking out.
 */
export function FitToViewport({
  sceneWidth,
  sceneHeight,
  userZoom = 1,
  padding = 32,
  children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const availW = Math.max(0, size.w - padding * 2);
  const availH = Math.max(0, size.h - padding * 2);

  const fitScale =
    availW > 0 && availH > 0 && sceneWidth > 0 && sceneHeight > 0
      ? Math.min(availW / sceneWidth, availH / sceneHeight)
      : 0;

  const finalScale = fitScale * (userZoom || 1);
  const width = sceneWidth * finalScale;
  const height = sceneHeight * finalScale;

  return (
    <div
      ref={ref}
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      {finalScale > 0 && children({ fitScale, finalScale, width, height })}
    </div>
  );
}
