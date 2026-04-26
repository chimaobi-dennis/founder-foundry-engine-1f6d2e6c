import { createContext, useContext, useState, ReactNode } from "react";
import type { CanvasItem } from "@/components/prostudio/CanvasSwitcher";

export interface StudioSession {
  templateName: string;
  variationId: string;
  variationHtml: string | null;
  /** Optional template output ID for the active variant (links back to `template_outputs` row). */
  outputId?: string | null;
  /** All output IDs for the session, indexed by canvas id. */
  outputIdsByCanvas?: Record<string, string>;
  /** Brand id used when persisting the canvas (Save to Library). */
  brandId?: string | null;
  /** Template id used when inserting a new template_outputs row for blank canvases. */
  templateId?: string | null;
  /** Set of canvas ids the user has already saved to library, for "Saved ✓" UI. */
  savedCanvasIds?: string[];
  onDownload?: () => void;
  onSaveToLibrary?: () => void;
  brandColors?: string[];
  canvases?: CanvasItem[];
  activeCanvasId?: string | null;
  onSelectCanvas?: (id: string) => void;
  onAddBlankCanvas?: () => void;
  onAddCanvasFromTemplate?: () => void;
  onDuplicateCanvas?: (id: string) => void;
  onDeleteCanvas?: (id: string) => void;
  onSetMainCanvas?: (id: string) => void;
  /** Called when the user fully exits the studio (after confirm). Resets origin state. */
  onExit?: () => void;
}

type SessionUpdater = StudioSession | null | ((prev: StudioSession | null) => StudioSession | null);

interface Ctx {
  session: StudioSession | null;
  setSession: (s: SessionUpdater) => void;
}

const StudioSessionCtx = createContext<Ctx | null>(null);

export function StudioSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StudioSession | null>(null);
  return (
    <StudioSessionCtx.Provider value={{ session, setSession }}>
      {children}
    </StudioSessionCtx.Provider>
  );
}

export function useStudioSession() {
  const ctx = useContext(StudioSessionCtx);
  if (!ctx) throw new Error("useStudioSession must be used within StudioSessionProvider");
  return ctx;
}
