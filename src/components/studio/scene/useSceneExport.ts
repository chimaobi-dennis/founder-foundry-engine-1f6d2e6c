import type { SceneDocument } from "@/types/scene";
import { renderSceneToBlob, renderSceneToDataUrl } from "@/lib/renderers/renderSceneToImage";

/**
 * Export hook for scene documents. Wraps the deterministic
 * canvas renderer — does NOT use html2canvas.
 *
 * NOTE: `renderSceneToCanvas` node implementations are still scaffolds,
 * so current PNG output only includes the background until those are
 * filled in. UI export buttons should expose this clearly.
 */
export function useSceneExport(document: SceneDocument) {
  return {
    async toPngBlob(pixelRatio = 2): Promise<Blob> {
      return renderSceneToBlob(document, { format: "png", pixelRatio });
    },
    async toPngDataUrl(pixelRatio = 2): Promise<string> {
      return renderSceneToDataUrl(document, { format: "png", pixelRatio });
    },
    async toJpegBlob(pixelRatio = 2, quality = 0.92): Promise<Blob> {
      return renderSceneToBlob(document, { format: "jpeg", pixelRatio, quality });
    },
  };
}
