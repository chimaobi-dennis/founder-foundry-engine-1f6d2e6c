import { memo } from "react";
import type { TextNode } from "@/types/scene";

interface Props {
  node: TextNode;
}

function SceneTextNodeImpl({ node }: Props) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        fontFamily: node.fontFamily,
        fontSize: node.fontSize,
        fontWeight: node.fontWeight,
        lineHeight: node.lineHeight,
        letterSpacing: node.letterSpacing,
        color: node.color,
        textAlign: node.align,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {node.text}
    </div>
  );
}

export const SceneTextNode = memo(SceneTextNodeImpl);
