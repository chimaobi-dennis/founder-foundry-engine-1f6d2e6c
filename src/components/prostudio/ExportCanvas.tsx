import { useRef, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import html2canvas from "html2canvas";
import { CreativeRenderer, CreativeData } from "./CreativeRenderer";

export interface ExportCanvasHandle {
  /** Capture the current creative to a canvas */
  capture: (options?: CaptureOptions) => Promise<HTMLCanvasElement | null>;
  /** Validate export dimensions against expected */
  validateDimensions: (expectedWidth: number, expectedHeight: number) => boolean;
}

export interface CaptureOptions {
  /** Pixel ratio for capture (default: 2 for retina) */
  pixelRatio?: number;
  /** Background color (default: null for transparent) */
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
 * Wait for all images in the container to load
 */
async function waitForImages(container: HTMLElement): Promise<void> {
  const images = container.querySelectorAll("img");
  const promises = Array.from(images).map((img) => {
    if (img.complete && img.naturalHeight !== 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn("[ExportCanvas] Image load timeout:", img.src);
        resolve(); // Continue anyway
      }, 5000);
      
      img.addEventListener("load", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      
      img.addEventListener("error", () => {
        clearTimeout(timeout);
        console.warn("[ExportCanvas] Image load error:", img.src);
        resolve(); // Continue anyway
      }, { once: true });
    });
  });
  
  await Promise.all(promises);
}

/**
 * Wait for next animation frame
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Wait for render stabilization - double rAF ensures paint completes
 */
async function waitForRenderStabilization(): Promise<void> {
  // First rAF schedules the callback before next repaint
  await nextFrame();
  // Second rAF schedules callback after paint has occurred
  await nextFrame();
}

/**
 * Debug mode flag - set to true to render export artboard visibly
 */
const DEBUG_EXPORT = false;

/**
 * ExportCanvas - Dedicated export artboard with NO wrapper containers
 * 
 * CRITICAL ARCHITECTURE:
 * - Single artboard div with fixed dimensions
 * - NO parent containers with transforms/padding/margins
 * - Positioned offscreen at left: -99999px
 * - Captures ONLY the artboard node, never parent containers
 * 
 * Required fixes implemented:
 * 1. Fixed dimensions per platform - never responsive
 * 2. No zoom, no transform: scale()
 * 3. NO editor wrappers or overlays
 * 4. Image loading wait before capture
 * 5. Font loading wait before capture
 * 6. Correct html2canvas settings per requirements
 */
export const ExportCanvas = forwardRef<ExportCanvasHandle, ExportCanvasProps>(
  ({ data, className }, ref) => {
    const artboardRef = useRef<HTMLDivElement>(null);
    const [isReady, setIsReady] = useState(false);

    /**
     * Full stabilization before capture:
     * 1. Double rAF for render stabilization
     * 2. Font loading
     * 3. Image loading
     * 4. Additional delay for safety
     */
    const stabilizeForCapture = useCallback(async (): Promise<void> => {
      // CRITICAL: Double rAF ensures paint has completed
      await waitForRenderStabilization();
      
      // Wait for all fonts to load
      if (typeof document !== "undefined" && "fonts" in document) {
        await document.fonts.ready;
      }
      
      // Wait for images to load
      const artboard = artboardRef.current;
      if (artboard) {
        await waitForImages(artboard);
      }
      
      // Additional safety delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      setIsReady(true);
    }, []);

    /**
     * Capture the rendered creative to a canvas.
     * Returns null if capture fails.
     * 
     * CRITICAL: Captures ONLY the artboard node, not any parent containers.
     */
    const capture = useCallback(
      async (options: CaptureOptions = {}): Promise<HTMLCanvasElement | null> => {
        const {
          pixelRatio = 2,
          backgroundColor = null,
          timeout = 30000,
        } = options;

        const artboard = artboardRef.current;
        if (!artboard) {
          console.error("[ExportCanvas] Artboard ref not available");
          return null;
        }

        // CRITICAL: Ensure artboard is properly positioned before capture
        // Remove any display:none, visibility:hidden, opacity:0
        artboard.style.display = "block";
        artboard.style.visibility = "visible";
        artboard.style.opacity = "1";
        
        // Force exact dimensions
        artboard.style.width = `${data.width}px`;
        artboard.style.height = `${data.height}px`;
        artboard.style.transform = "none";
        artboard.style.zoom = "1";
        artboard.style.position = "relative";
        artboard.style.overflow = "hidden";

        // Stabilize before capture
        await stabilizeForCapture();

        // Verify dimensions are correct
        const rect = artboard.getBoundingClientRect();
        console.log(`[ExportCanvas] Pre-capture dimensions: ${rect.width}x${rect.height}`, {
          platform: data.platformName,
          expected: `${data.width}x${data.height}`,
        });
        
        if (rect.width === 0 || rect.height === 0) {
          console.error("[ExportCanvas] ABORT: Export node has 0x0 dimensions!", {
            rect,
            artboardStyle: {
              width: artboard.style.width,
              height: artboard.style.height,
              display: artboard.style.display,
              visibility: artboard.style.visibility,
            },
          });
          return null;
        }

        try {
          console.log(`[ExportCanvas] Capturing ${data.platformName || "canvas"} at ${data.width}x${data.height} (scale: ${pixelRatio})`);
          
          const canvas = await Promise.race([
            html2canvas(artboard, {
              // Use exact artboard dimensions
              width: data.width,
              height: data.height,
              // Scale for retina/quality
              scale: pixelRatio,
              // Transparent background (let artboard bg show through)
              backgroundColor: backgroundColor,
              // CORS for external images
              useCORS: true,
              // Allow tainted canvas (for cross-origin images that allow it)
              allowTaint: true,
              // Enable foreign object rendering for SVGs
              foreignObjectRendering: true,
              // Logging for debugging - always log in development
              logging: true,
              // Remove unnecessary overlays
              ignoreElements: (element) => {
                // Ignore any editor overlays
                return element.hasAttribute("data-editor-overlay") ||
                       element.classList.contains("editor-ui") ||
                       element.classList.contains("drag-handle");
              },
            }),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("Export capture timeout")),
                timeout
              )
            ),
          ]);

          // Validate captured dimensions
          const expectedWidth = Math.round(data.width * pixelRatio);
          const expectedHeight = Math.round(data.height * pixelRatio);
          
          if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
            console.warn("[ExportCanvas] Dimension mismatch:", {
              platform: data.platformName,
              expected: `${expectedWidth}x${expectedHeight}`,
              actual: `${canvas.width}x${canvas.height}`,
              artboardSize: `${artboard.offsetWidth}x${artboard.offsetHeight}`,
            });
          } else {
            console.log(`[ExportCanvas] Captured successfully: ${canvas.width}x${canvas.height}`);
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
        const match = data.width === expectedWidth && data.height === expectedHeight;
        if (!match) {
          console.warn("[ExportCanvas] Dimension validation failed:", {
            expected: `${expectedWidth}x${expectedHeight}`,
            actual: `${data.width}x${data.height}`,
            platform: data.platformName,
          });
        }
        return match;
      },
      [data]
    );

    // Expose imperative handle via ref
    useImperativeHandle(ref, () => ({
      capture,
      validateDimensions,
    }));

    // Generate unique ID for this export artboard
    const artboardId = `export-artboard-${data.platformId || "default"}`;

    // Debug mode: render visibly on screen
    const debugStyles = DEBUG_EXPORT ? {
      position: "fixed" as const,
      left: "10px",
      top: "10px",
      zIndex: 9999,
      border: "2px solid red",
    } : {
      // CRITICAL: Use visibility-friendly offscreen positioning
      // NEVER use display:none, visibility:hidden, or opacity:0
      position: "fixed" as const,
      left: "-99999px",
      top: 0,
      // Wrapper needs proper overflow handling but NOT 0x0 dimensions
      overflow: "visible",
      zIndex: -1,
    };

    return (
      <div
        id={artboardId}
        data-export-artboard-wrapper
        style={debugStyles}
        className={className}
      >
        {/* 
          The CreativeRenderer outputs a SINGLE div with data-artboard="true"
          This is the ONLY element we capture - no parents, no wrappers
        */}
        <CreativeRenderer
          ref={artboardRef}
          mode="export"
          data={data}
          id={`artboard-${data.platformId || "default"}`}
        />
      </div>
    );
  }
);

ExportCanvas.displayName = "ExportCanvas";

export default ExportCanvas;
