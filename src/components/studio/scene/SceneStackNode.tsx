import { memo } from "react";
import type { StackNode } from "@/types/scene";
import { SceneNodeRenderer } from "./SceneNodeRenderer";

interface Props {
  node: StackNode;
}

function SceneStackNodeImpl({ node }: Props) {
  const isH = node.direction === "horizontal";
  const sorted = [...node.children].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: isH ? "row" : "column",
        gap: node.gap || 0,
        padding: node.padding || 0,
        alignItems: mapAlign(node.align),
        justifyContent: mapJustify(node.justify),
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {sorted.map((child) => (
        <SceneNodeRenderer key={child.id} node={child} interactive={false} />
      ))}
    </div>
  );
}

function mapAlign(align?: string): string {
  switch (align) {
    case "center": return "center";
    case "end": return "flex-end";
    case "stretch": return "stretch";
    default: return "flex-start";
  }
}

function mapJustify(justify?: string): string {
  switch (justify) {
    case "center": return "center";
    case "end": return "flex-end";
    case "space-between": return "space-between";
    default: return "flex-start";
  }
}

export const SceneStackNode = memo(SceneStackNodeImpl);
