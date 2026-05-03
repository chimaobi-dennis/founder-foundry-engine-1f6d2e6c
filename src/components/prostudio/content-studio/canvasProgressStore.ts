/**
 * Tiny in-memory store for canvas loading progress, keyed by canvas id.
 *
 * Lets the CanvasCrossfade resume its progress bar when the user switches
 * tabs or jumps between platforms — instead of always restarting at 10%.
 *
 * Also mirrors to sessionStorage so progress survives soft route changes
 * within the editor session (cleared on tab close).
 */

export type CanvasPhase = "idle" | "generating" | "loading" | "ready";

export interface CanvasProgressState {
  progress: number; // 0–100
  phase: CanvasPhase;
  ready: boolean;
  updatedAt: number;
}

const STORAGE_KEY = "studio:canvasProgress";
const store = new Map<string, CanvasProgressState>();
const listeners = new Map<string, Set<(s: CanvasProgressState) => void>>();

// Hydrate from sessionStorage once.
(() => {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CanvasProgressState>;
    Object.entries(parsed).forEach(([id, s]) => store.set(id, s));
  } catch {
    // ignore
  }
})();

function persist() {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, CanvasProgressState> = {};
    store.forEach((v, k) => (obj[k] = v));
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore quota
  }
}

export function getCanvasProgress(id: string): CanvasProgressState | undefined {
  return store.get(id);
}

export function setCanvasProgress(id: string, patch: Partial<CanvasProgressState>) {
  const prev = store.get(id) || {
    progress: 0,
    phase: "idle" as CanvasPhase,
    ready: false,
    updatedAt: Date.now(),
  };
  const next: CanvasProgressState = {
    ...prev,
    ...patch,
    updatedAt: Date.now(),
  };
  store.set(id, next);
  persist();
  listeners.get(id)?.forEach((fn) => fn(next));
}

export function clearCanvasProgress(id: string) {
  store.delete(id);
  persist();
}

export function subscribeCanvasProgress(
  id: string,
  fn: (s: CanvasProgressState) => void,
): () => void {
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) listeners.delete(id);
  };
}
