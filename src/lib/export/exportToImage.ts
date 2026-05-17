import * as htmlToImage from "html-to-image";

// Debug mode flag
const DEBUG_EXPORT = false;

export interface ExportOptions {
  width: number;
  height: number;
  pixelRatio?: number;
  backgroundColor?: string;
  format?: "png" | "jpeg";
  quality?: number;
}

export interface ExportResult {
  dataUrl: string;
  width: number;
  height: number;
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
          console.warn("[Export] Image load timeout:", img.src);
        }
        resolve();
      }, 5000);

      img.addEventListener(
        "load",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true }
      );

      img.addEventListener(
        "error",
        () => {
          clearTimeout(timeout);
          if (DEBUG_EXPORT) {
            console.warn("[Export] Image load error:", img.src);
          }
          resolve();
        },
        { once: true }
      );
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
 * Strip unsupported CSS properties that cause export issues
 */
function stripUnsupportedCss(node: HTMLElement): string {
  const computed = window.getComputedStyle(node);
  const unsupported = [
    "backdrop-filter",
    "mix-blend-mode",
    "filter",
    "clip-path",
    "mask",
    "mask-image",
    "isolation",
    "contain-intrinsic-size",
  ];

  let needsReset = false;
  for (const prop of unsupported) {
    const value = computed.getPropertyValue(prop);
    if (value && value !== "none" && value !== "auto") {
      needsReset = true;
      if (DEBUG_EXPORT) {
        console.log(`[Export] Removing unsupported CSS: ${prop} = ${value}`);
      }
    }
  }

  if (needsReset) {
    const original = node.getAttribute("style") || "";
    const cleanStyles = unsupported
      .map((prop) => `${prop}: none !important;`)
      .join(" ");
    node.setAttribute(
      "style",
      `${original} ${cleanStyles}`.trim()
    );
    return original;
  }

  return "";
}

/**
 * Convert position: fixed to position: absolute for export
 */
function fixPositionFixed(node: HTMLElement): void {
  const elements = node.querySelectorAll("[style*=" + '"position: fixed"' + "]");
  elements.forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.position = "absolute";
      if (DEBUG_EXPORT) {
        console.log("[Export] Converted position: fixed to absolute");
      }
    }
  });
}

/**
 * Freeze all animations by injecting CSS
 */
function freezeAnimations(node: HTMLElement): HTMLStyleElement | null {
  const style = document.createElement("style");
  style.textContent = `
    * {
      animation: none !important;
      transition: none !important;
    }
  `;
  node.appendChild(style);
  return style;
}

/**
 * Export a single node to PNG
 * CRITICAL: Captures ONLY the provided node, never parents or editor UI
 */
export async function exportNodeToPng(
  node: HTMLElement,
  options: ExportOptions
): Promise<ExportResult | null> {
  const {
    width,
    height,
    pixelRatio = 2,
    backgroundColor = "#ffffff",
  } = options;

  if (DEBUG_EXPORT) {
    console.log("[Export] Starting export:", { width, height, pixelRatio });
  }

  // Verify dimensions
  if (width === 0 || height === 0) {
    console.error("[Export] ABORT: Invalid dimensions", { width, height });
    return null;
  }

  // Force exact dimensions
  const originalStyles: string[] = [];
  const styleProps = ["width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight"];
  
  styleProps.forEach((prop) => {
    originalStyles.push(node.style.getPropertyValue(prop));
  });

  node.style.width = `${width}px`;
  node.style.height = `${height}px`;
  node.style.minWidth = `${width}px`;
  node.style.minHeight = `${height}px`;
  node.style.maxWidth = `${width}px`;
  node.style.maxHeight = `${height}px`;

  // Fix transform and zoom
  const originalTransform = node.style.transform;
  const originalZoom = (node.style as any).zoom;
  node.style.transform = "none";
  (node.style as any).zoom = "1";

  // Strip unsupported CSS
  const originalCss = stripUnsupportedCss(node);

  // Fix position: fixed elements
  fixPositionFixed(node);

  // Freeze animations
  const animationStyle = freezeAnimations(node);

  // Wait for stabilization
  await waitForRenderStabilization();
  await document.fonts.ready;
  await waitForImages(node);

  // Verify dimensions after stabilization
  const rect = node.getBoundingClientRect();
  if (DEBUG_EXPORT) {
    console.log("[Export] Pre-capture dimensions:", {
      width: rect.width,
      height: rect.height,
      expected: `${width}x${height}`,
    });
  }

  if (rect.width === 0 || rect.height === 0) {
    console.error("[Export] ABORT: Node has 0x0 dimensions after stabilization");
    return null;
  }

  try {
    const dataUrl = await htmlToImage.toPng(node, {
      width: width,
      height: height,
      canvasWidth: width * pixelRatio,
      canvasHeight: height * pixelRatio,
      pixelRatio: pixelRatio,
      backgroundColor: backgroundColor,
      cacheBust: true,
      skipAutoScale: true,
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;
        // Filter out editor UI elements
        const isEditorUi =
          node.classList?.contains("editor-overlay") ||
          node.classList?.contains("editor-ui") ||
          node.classList?.contains("drag-handle") ||
          node.hasAttribute?.("data-editor-overlay");
        
        if (DEBUG_EXPORT && isEditorUi) {
          console.log("[Export] Filtering out editor UI:", node.className);
        }
        
        return !isEditorUi;
      },
    });

    const exportedWidth = width * pixelRatio;
    const exportedHeight = height * pixelRatio;

    if (DEBUG_EXPORT) {
      console.log("[Export] Export complete", {
        expected: `${exportedWidth}x${exportedHeight}`,
        dataUrlLength: dataUrl.length,
      });
    }

    // Cleanup
    if (animationStyle) {
      animationStyle.remove();
    }
    
    // Restore original styles
    styleProps.forEach((prop, index) => {
      node.style.setProperty(prop, originalStyles[index]);
    });
    node.style.transform = originalTransform;
    (node.style as any).zoom = originalZoom;

    return {
      dataUrl,
      width: exportedWidth,
      height: exportedHeight,
    };
  } catch (error) {
    console.error("[Export] Export failed:", error);
    
    // Cleanup on error
    if (animationStyle) {
      animationStyle.remove();
    }
    
    return null;
  }
}

/**
 * Export a single node to JPEG
 */
export async function exportNodeToJpeg(
  node: HTMLElement,
  options: ExportOptions
): Promise<ExportResult | null> {
  const result = await exportNodeToPng(node, options);
  if (!result) return null;

  // Convert PNG data URL to JPEG if needed
  // For now, return PNG - JPEG conversion can be added later
  return result;
}

/**
 * Export to Blob for PDF generation
 */
export async function exportNodeToBlob(
  node: HTMLElement,
  options: ExportOptions
): Promise<Blob | null> {
  const result = await exportNodeToPng(node, options);
  if (!result) return null;

  // Convert data URL to Blob
  const response = await fetch(result.dataUrl);
  return await response.blob();
}
