import { createContext, useContext, useState, ReactNode } from "react";
import type { CanvasItem } from "@/components/prostudio/CanvasSwitcher";

export interface StudioSession {
  templateName: string;
  variationId: string;
  variationHtml: string | null;
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

interface Ctx {
  session: StudioSession | null;
  setSession: (s: StudioSession | null) => void;
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
