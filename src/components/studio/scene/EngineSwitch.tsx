import type { ReactNode } from "react";
import type { RenderEngine, SceneDocument } from "@/types/scene";
import { SceneEditor } from "./SceneEditor";

interface Props {
  renderEngine: RenderEngine | null | undefined;
  sceneDocument?: SceneDocument | null;
  onSceneChange?: (doc: SceneDocument) => void;
  /** Existing HTML editor / renderer passed as children. Used when engine !== 'scene'. */
  children: ReactNode;
}

/**
 * Switches between the legacy HTML editor and the new scene editor based on
 * the `render_engine` discriminator. Backward-compatible: when engine is
 * unset or 'html', the existing children render unchanged.
 */
export function EngineSwitch({ renderEngine, sceneDocument, onSceneChange, children }: Props) {
  if (renderEngine === "scene" && sceneDocument) {
    return <SceneEditor document={sceneDocument} onChange={onSceneChange} />;
  }
  return <>{children}</>;
}
