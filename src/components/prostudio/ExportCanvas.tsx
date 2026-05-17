import { useRef, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import html2canvas from "html2canvas";
import { CreativeRenderer, CreativeData } from "./CreativeRenderer";
import { cn } from "@/lib/utils";

export interface ExportCanvasHandle {
  /** Capture the current creative to a canvas */
  capture: (options?: CaptureOptions) => Promise<HTMLCanvasElement | null>;
  /** Validate export dimensions against expected */
  validateDimensions: (expectedWidth: number, expectedHeight: number) => boolean;
}

export interface CaptureOptions {
  /** Pixel ratio for capture (default: 2 for retina) */
  pixelRatio?: number;
  /** Background color (default: transparent) */
  backgroundColor?: string | null;
  /** Timeout for capture (default: 30000ms) */
  timeout?: number;
}

interface ExportCanvasProps {
  /** Creative data to render */
  data: CreativeData;
  /** Optional className for container */
  className?: string;
}

/**
 * ExportCanvas - Hidden offscreen canvas for high-quality exports
 * 
 * Features:
 * - Renders at scale(1) with fixed dimensions
 * - No responsive transforms
 * - No editor UI
 * - Pre-export font stabilization
 * - Dimension validation
 * 
 * Usage:
 * ```tsx
 * const exportRef = useRef<ExportCanvasHandle>(null);
 * 
 * <ExportCanvas
 *   ref={exportRef}
 *   data={creativeData}
 * />
 * 
 * // Capture:
 * const canvas = await exportRef.current?.capture({ pixelRatio: 2 });
 * ```
 */
export const ExportCanvas = forwardRef<ExportCanvasHandle, ExportCanvasProps>(
  ({ data, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isStabilized, setIsStabilized] = useState(false);

    /**
     * Stabilize fonts and layout before capture.
     * Waits for document.fonts.ready and adds small delay.
     */
    const stabilizeForCapture = useCallback(async (): Promise<void> => {
      // Wait for all fonts to load
      if (typeof document !== "undefined" && "fonts" in document) {
        await document.fonts.ready;
      }
      
      // Additional stabilization delay for layout
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      setIsStabilized(true);
    }, []);

    /**
     * Capture the rendered creative to a canvas.
     * Returns null if capture fails.
     */
    const capture = useCallback(
      async (options: CaptureOptions = {}): Promise<HTMLCanvasElement | null> => {
        const {
          pixelRatio = 2,
          backgroundColor = null,
          timeout = 30000,
        } = options;

        const container = containerRef.current;
        if (!container) {
          console.error("[ExportCanvas] Container ref not available");
          return null;
        }

        // Stabilize before capture
        await stabilizeForCapture();

        try {
          const canvas = await Promise.race([
            html2canvas(container, {
              width: data.width,
              height: data.height,
              scale: pixelRatio,
              backgroundColor,
              useCORS: true,
              logging: false,
              // Critical: ensure we capture the exact dimensions specified
              // not computed dimensions from responsive CSS
              foreignObjectRendering: false,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("Export capture timeout")),
                timeout
              )
            ),
          ]);

          // Validate captured dimensions
          const expectedWidth = data.width * pixelRatio;
          const expectedHeight = data.height * pixelRatio;
          
          if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
            console.warn("[ExportCanvas] Dimension mismatch:", {
              expected: `${expectedWidth}x${expectedHeight}`,
              actual: `${canvas.width}x${canvas.height}`,
              platform: data.platformName,
            });
          }

          return canvas;
        } catch (error) {
          console.error("[ExportCanvas] Capture failed:", error);
          return null;
        }
      },
      [data, stabilizeForCapture]
    );

    /**
     * Validate that the rendered dimensions match expected platform dimensions.
     */
    const validateDimensions = useCallback(
      (expectedWidth: number, expectedHeight: number): boolean => {
        return data.width === expectedWidth && data.height === expectedHeight;
      },
      [data]
    );

    // Expose imperative handle via ref
    useImperativeHandle(ref, () => ({
      capture,
      validateDimensions,
    }));

    return (
      <div
        ref={containerRef}
        className={cn(
          // Offscreen positioning - not visible but in DOM
          "fixed",
          "-left-[99999px]",
          "top-0",
          className
        )}
        style={{
          width: data.width,
          height: data.height,
          overflow: "hidden",
          zIndex: -1,
        }}
        data-export-canvas
        data-platform-id={data.platformId}
        data-stabilized={isStabilized}
      >
        <CreativeRenderer
          mode="export"
          data={data}
          containerRef={containerRef}
        />
      </div>
    );
  }
);

ExportCanvas.displayName = "ExportCanvas";

export default ExportCanvas;
