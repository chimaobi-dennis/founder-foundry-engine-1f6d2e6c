import { memo } from "react";
import type { GroupNode } from "@/types/scene";
import { SceneNodeRenderer } from "./SceneNodeRenderer";

interface Props {
  node: GroupNode;
}

function SceneGroupNodeImpl({ node }: Props) {
  const sorted = [...node.children].sort((a, b) => a.zIndex - b.zIndex);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {sorted.map((child) => (
        <SceneNodeRenderer key={child.id} node={child} interactive={false} />
      ))}
    </div>
  );
}

export const SceneGroupNode = memo(SceneGroupNodeImpl);
