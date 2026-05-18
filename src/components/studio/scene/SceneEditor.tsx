import { ReactNode } from "react";
import type { SceneDocument } from "@/types/scene";
import { SceneStoreProvider } from "./sceneStore";
import { SceneCanvas } from "./SceneCanvas";
import { SceneToolbar } from "./SceneToolbar";
import { SceneLayersPanel } from "./SceneLayersPanel";
import { ScenePropertiesPanel } from "./ScenePropertiesPanel";

interface Props {
  document: SceneDocument;
  onChange?: (doc: SceneDocument) => void;
  /** Override panels (e.g. hide layers, custom right rail). */
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
}

/**
 * Top-level scene editor shell. Composes toolbar + canvas + panels and
 * wires up the SceneStoreProvider.
 *
 * Sits at the same architectural level as `StudioEditor` (HTML mode).
 * Choose between them via render-engine switching at the call site.
 */
export function SceneEditor({ document, onChange, leftPanel, rightPanel }: Props) {
  return (
    <SceneStoreProvider initialDocument={document} onChange={onChange}>
      <div className="flex flex-col h-full w-full bg-background text-foreground">
        <SceneToolbar />
        <div className="flex-1 flex min-h-0">
          <aside className="w-56 border-r border-border bg-card hidden md:flex flex-col">
            {leftPanel ?? <SceneLayersPanel />}
          </aside>
          <main className="flex-1 min-w-0 relative">
            <SceneCanvas />
          </main>
          <aside className="w-64 border-l border-border bg-card hidden md:flex flex-col">
            {rightPanel ?? <ScenePropertiesPanel />}
          </aside>
        </div>
      </div>
    </SceneStoreProvider>
  );
}
