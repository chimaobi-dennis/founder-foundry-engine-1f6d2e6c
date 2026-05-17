import { useRef, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import * as htmlToImage from "html-to-image";
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
  /** Background color (default: #ffffff) */
  backgroundColor?: string;
  /** Timeout for capture (default: 30000ms) */
  timeout?: number;
  /** Export format */
  format?: "png" | "jpeg";
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
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (DEBUG_EXPORT) {
          console.warn("[ExportCanvas] Image load timeout:", img.src);
        }
        resolve();
      }, 5000);
      
      img.addEventListener("load", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      
      img.addEventListener("error", () => {
        clearTimeout(timeout);
        if (DEBUG_EXPORT) {
          console.warn("[ExportCanvas] Image load error:", img.src);
        }
        resolve();
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
  await nextFrame();
  await nextFrame();
}

/**
 * Convert data URL to HTMLCanvasElement
 */
function dataUrlToCanvas(dataUrl: string, width: number, height: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("Failed to load data URL into image"));
    img.src = dataUrl;
  });
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
 * - Captures ONLY the artboard node, never parent containers
 * 
 * Uses html-to-image library for reliable exports.
 * 
 * Required fixes implemented:
 * 1. Fixed dimensions per platform - never responsive
 * 2. No zoom, no transform: scale()
 * 3. NO editor wrappers or overlays
 * 4. Image loading wait before capture
 * 5. Font loading wait before capture
 * 6. Proper CSS filtering for editor UI
 * 7. Animation freezing before capture
 */
export const ExportCanvas = forwardRef<ExportCanvasHandle, ExportCanvasProps>(
  ({ data, className }, ref) => {
    const artboardRef = useRef<HTMLDivElement>(null);
    const [isReady, setIsReady] = useState(false);
    const [artboardReady, setArtboardReady] = useState(false);

    /**
     * Called when CreativeRenderer reports it's ready (fonts loaded, layout done)
     */
    const handleArtboardReady = useCallback(() => {
      if (DEBUG_EXPORT) {
        console.log("[ExportCanvas] Artboard reports ready");
      }
      setArtboardReady(true);
    }, []);

    /**
     * Full stabilization before capture:
     * 1. Wait for artboard to be ready
     * 2. Double rAF for render stabilization
     * 3. Font loading
     * 4. Image loading
     * 5. Additional delay for safety
     */
    const stabilizeForCapture = useCallback(async (): Promise<void> => {
      // CRITICAL: Wait for artboard to report ready first
      if (!artboardReady) {
        if (DEBUG_EXPORT) {
          console.log("[ExportCanvas] Waiting for artboard to be ready...");
        }
        // Wait up to 5 seconds for artboard to be ready
        let attempts = 0;
        while (!artboardReady && attempts < 50) {
          await new Promise((r) => setTimeout(r, 100));
          attempts++;
        }
      }
      
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
    }, [artboardReady]);

    /**
     * Freeze animations by injecting CSS
     */
    const freezeAnimations = useCallback((node: HTMLElement): (() => void) => {
      const style = document.createElement("style");
      style.textContent = `
        * {
          animation: none !important;
          transition: none !important;
        }
      `;
      node.appendChild(style);
      
      return () => {
        style.remove();
      };
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
          backgroundColor = "#ffffff",
          timeout = 30000,
          format = "png",
        } = options;

        const artboard = artboardRef.current;
        if (!artboard) {
          console.error("[ExportCanvas] Artboard ref not available");
          return null;
        }

        // CRITICAL: Get the actual content dimensions
        const scrollWidth = artboard.scrollWidth;
        const scrollHeight = artboard.scrollHeight;
        const rect = artboard.getBoundingClientRect();
        
        // Use expected dimensions, but ensure we capture full content
        const captureWidth = Math.max(data.width, scrollWidth, rect.width);
        const captureHeight = Math.max(data.height, scrollHeight, rect.height);
        
        if (DEBUG_EXPORT) {
          console.log("[ExportCanvas] Dimension analysis:", {
            expected: `${data.width}x${data.height}`,
            scroll: `${scrollWidth}x${scrollHeight}`,
            rect: `${rect.width}x${rect.height}`,
            capture: `${captureWidth}x${captureHeight}`,
          });
        }

        // CRITICAL: Force exact dimensions before capture
        const originalStyles: Record<string, string> = {};
        const stylesToSave = ["width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight", "transform", "position", "overflow"];
        stylesToSave.forEach(prop => {
          originalStyles[prop] = artboard.style.getPropertyValue(prop);
        });

        // Set dimensions to match expected platform size
        artboard.style.width = `${data.width}px`;
        artboard.style.height = `${data.height}px`;
        artboard.style.minWidth = `${data.width}px`;
        artboard.style.minHeight = `${data.height}px`;
        // REMOVED: maxWidth/maxHeight that was causing clipping
        artboard.style.transform = "none";
        artboard.style.position = "relative";
        artboard.style.display = "block";
        artboard.style.visibility = "visible";
        artboard.style.opacity = "1";
        artboard.style.overflow = "visible"; // Allow content to be fully captured

        // Stabilize before capture
        await stabilizeForCapture();

        // Freeze animations
        const unfreezeAnimations = freezeAnimations(artboard);

        // Verify dimensions are correct after stabilization
        const finalRect = artboard.getBoundingClientRect();
        if (DEBUG_EXPORT) {
          console.log(`[ExportCanvas] Pre-capture dimensions: ${finalRect.width}x${finalRect.height}`, {
            platform: data.platformName,
            expected: `${data.width}x${data.height}`,
          });
        }
        
        if (finalRect.width === 0 || finalRect.height === 0) {
          console.error("[ExportCanvas] ABORT: Export node has 0x0 dimensions!", {
            finalRect,
            artboardStyle: {
              width: artboard.style.width,
              height: artboard.style.height,
            },
          });
          unfreezeAnimations();
          return null;
        }

        try {
          if (DEBUG_EXPORT) {
            console.log(`[ExportCanvas] Capturing ${data.platformName || "canvas"} at ${captureWidth}x${captureHeight} (scale: ${pixelRatio})`);
          }
          
          // CRITICAL: Use capture dimensions to avoid clipping
          // If content is wider than expected, we capture it all
          const exportOptions = {
            width: captureWidth,
            height: captureHeight,
            canvasWidth: captureWidth * pixelRatio,
            canvasHeight: captureHeight * pixelRatio,
            pixelRatio: pixelRatio,
            backgroundColor: backgroundColor,
            cacheBust: true,
            skipAutoScale: true,
            filter: (node: Node) => {
              if (!(node instanceof HTMLElement)) return true;
              const isEditorUi =
                node.classList?.contains("editor-overlay") ||
                node.classList?.contains("editor-ui") ||
                node.classList?.contains("drag-handle") ||
                node.hasAttribute?.("data-editor-overlay");
              
              if (DEBUG_EXPORT && isEditorUi) {
                console.log("[ExportCanvas] Filtering out:", node.className);
              }
              
              return !isEditorUi;
            },
          };

          let dataUrl: string;
          
          if (format === "jpeg") {
            dataUrl = await Promise.race([
              htmlToImage.toJpeg(artboard, exportOptions),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Export capture timeout")), timeout)
              ),
            ]);
          } else {
            dataUrl = await Promise.race([
              htmlToImage.toPng(artboard, exportOptions),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Export capture timeout")), timeout)
              ),
            ]);
          }

          // Convert data URL to canvas
          // Use capture dimensions to match what was actually captured
          const outputWidth = Math.round(captureWidth * pixelRatio);
          const outputHeight = Math.round(captureHeight * pixelRatio);
          const canvas = await dataUrlToCanvas(dataUrl, outputWidth, outputHeight);

          // Cleanup
          unfreezeAnimations();
          
          // Restore original styles
          stylesToSave.forEach(prop => {
            artboard.style.setProperty(prop, originalStyles[prop]);
          });

          if (DEBUG_EXPORT) {
            console.log("[ExportCanvas] Export complete", {
              expected: `${data.width}x${data.height}`,
              captured: `${captureWidth}x${captureHeight}`,
              output: `${canvas.width}x${canvas.height}`,
              platform: data.platformName,
            });
          }
          
          return canvas;
        } catch (error) {
          console.error("[ExportCanvas] Capture failed:", error);
          return null;
        }
      },
      [data.width, data.height, data.platformName, stabilizeForCapture, freezeAnimations]
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
    const debugStyles: React.CSSProperties = DEBUG_EXPORT ? {
      position: "fixed",
      left: "10px",
      top: "10px",
      zIndex: 9999,
      border: "2px solid red",
    } : {
      // CRITICAL: Use renderable offscreen positioning
      // NEVER use display:none, visibility:hidden, or opacity:0
      // NEVER use left:-99999px (causes browser rendering instability)
      position: "fixed",
      left: 0,
      top: 0,
      opacity: 0.01,
      pointerEvents: "none" as const,
      zIndex: -1,
      contain: "layout style paint",
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
          onRenderComplete={handleArtboardReady}
        />
      </div>
    );
  }
);

ExportCanvas.displayName = "ExportCanvas";

export default ExportCanvas;
