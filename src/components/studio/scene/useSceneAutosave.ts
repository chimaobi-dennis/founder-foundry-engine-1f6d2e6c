import { useEffect, useRef } from "react";
import type { SceneDocument } from "@/types/scene";

/**
 * Debounced autosave hook for SceneDocument.
 *
 * The caller passes a save fn (typically from the service layer) — this
 * hook only handles debouncing and skipping the initial mount.
 */
export function useSceneAutosave(
  document: SceneDocument,
  save: (doc: SceneDocument) => Promise<void> | void,
  delay = 600
) {
  const timer = useRef<number | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      Promise.resolve(save(document)).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[useSceneAutosave] save failed", err);
      });
    }, delay);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document]);
}
