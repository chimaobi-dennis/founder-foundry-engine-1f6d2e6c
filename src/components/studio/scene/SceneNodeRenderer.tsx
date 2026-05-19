import { memo, useCallback, PointerEvent as RPE } from "react";
import type { SceneNode } from "@/types/scene";
import { isGroupNode, isImageNode, isShapeNode, isTextNode } from "@/types/scene";
import { SceneTextNode } from "./SceneTextNode";
import { SceneImageNode } from "./SceneImageNode";
import { SceneShapeNode } from "./SceneShapeNode";
import { SceneGroupNode } from "./SceneGroupNode";
import { useSceneStoreSafe } from "./sceneStore";

interface Props {
  node: SceneNode;
  /** When false, no pointer events / selection (used for export and groups). */
  interactive?: boolean;
}

function SceneNodeRendererImpl({ node, interactive = true }: Props) {
  const store = useSceneStoreSafe();
  const canInteract = interactive && !!store;
  const selected = store?.selectedIds.includes(node.id) ?? false;
  const ui = store?.ui[node.id] ?? {};

  const onPointerDown = useCallback(
    (e: RPE<HTMLDivElement>) => {
      if (!store || ui.locked) return;
      e.stopPropagation();
      const multi = e.shiftKey;
      const ids = multi
        ? selected
          ? store.selectedIds.filter((id) => id !== node.id)
          : [...store.selectedIds, node.id]
        : [node.id];
      store.setSelection(ids);
    },
    [store, ui.locked, selected, node.id]
  );

  if (ui.hidden) return null;

  const style: React.CSSProperties = {
    position: "absolute",
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
    transform: `rotate(${node.rotation}deg)`,
    transformOrigin: "center center",
    opacity: node.opacity,
    zIndex: node.zIndex,
    cursor: canInteract ? (ui.locked ? "not-allowed" : "move") : "default",
    outline: selected ? "1.5px solid hsl(var(--primary))" : "none",
    outlineOffset: 1,
  };

  return (
    <div
      data-scene-node={node.id}
      style={style}
      onPointerDown={canInteract ? onPointerDown : undefined}
    >
      {isTextNode(node) && <SceneTextNode node={node} />}
      {isImageNode(node) && <SceneImageNode node={node} />}
      {isShapeNode(node) && <SceneShapeNode node={node} />}
      {isGroupNode(node) && <SceneGroupNode node={node} />}
    </div>
  );
}

export const SceneNodeRenderer = memo(SceneNodeRendererImpl);
