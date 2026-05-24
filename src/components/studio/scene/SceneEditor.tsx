import { ReactNode } from "react";
import type { SceneDocument } from "@/types/scene";
import { SceneStoreProvider, useSceneStore } from "./sceneStore";
import { SceneCanvas } from "./SceneCanvas";
import { SceneToolbar } from "./SceneToolbar";
import { SceneLayersPanel } from "./SceneLayersPanel";
import { ScenePropertiesPanel } from "./ScenePropertiesPanel";
import { FitToViewport } from "./FitToViewport";
import { cn } from "@/lib/utils";

interface Props {
  document: SceneDocument;
  onChange?: (doc: SceneDocument) => void;
  /** Override panels (e.g. hide layers, custom right rail). */
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  /** AI copilot panel (chat). */
  copilotPanel?: ReactNode;
}

/**
 * Top-level scene editor shell. Composes toolbar + canvas + panels and
 * wires up the SceneStoreProvider.
 *
 * Sits at the same architectural level as `StudioEditor` (HTML mode).
 * Choose between them via render-engine switching at the call site.
 */
export function SceneEditor({ document, onChange, leftPanel, rightPanel, copilotPanel }: Props) {
  return (
    <SceneStoreProvider initialDocument={document} onChange={onChange}>
      <SceneEditorInner
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        copilotPanel={copilotPanel}
      />
    </SceneStoreProvider>
  );
}

function SceneEditorInner({
  leftPanel,
  rightPanel,
  copilotPanel,
}: {
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  copilotPanel?: ReactNode;
}) {
  const { focusMode, aiPending, aiMessage, document: doc, camera } = useSceneStore();

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground">
      {/* Toolbar — hidden in focus mode */}
      <div
        className={cn(
          "transition-all duration-300 ease-out overflow-hidden",
          focusMode ? "max-h-0 opacity-0" : "max-h-16 opacity-100"
        )}
      >
        <SceneToolbar />
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left panel — layers */}
        <aside
          className={cn(
            "border-r border-border bg-card/80 backdrop-blur-sm hidden md:flex flex-col transition-all duration-300 ease-out",
            focusMode ? "w-0 opacity-0 overflow-hidden" : "w-56 opacity-100"
          )}
        >
          {leftPanel ?? <SceneLayersPanel />}
        </aside>

        {/* Main canvas — auto-fits to available viewport */}
        <main className="flex-1 min-w-0 relative overflow-hidden">
          <FitToViewport
            sceneWidth={doc.width}
            sceneHeight={doc.height}
            userZoom={camera.zoom || 1}
          >
            {({ finalScale }) => (
              <SceneCanvas
                width={doc.width}
                height={doc.height}
                zoom={finalScale}
                forceFillStage
              />
            )}
          </FitToViewport>

          {/* AI status indicator */}
          {aiPending && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 backdrop-blur-md border border-primary/20 shadow-lg">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-medium text-primary">
                  {aiMessage || "AI is thinking..."}
                </span>
              </div>
            </div>
          )}
        </main>

        {/* Right panel — properties or copilot */}
        <aside
          className={cn(
            "border-l border-border bg-card/80 backdrop-blur-sm hidden md:flex flex-col transition-all duration-300 ease-out",
            focusMode ? "w-0 opacity-0 overflow-hidden" : "w-72 opacity-100"
          )}
        >
          {copilotPanel
            ? copilotPanel
            : (rightPanel ?? <ScenePropertiesPanel />)}
        </aside>
      </div>
    </div>
  );
}
