import { memo } from "react";
import type { TextNode } from "@/types/scene";
import { resolveFont } from "@/lib/renderers/sceneRenderPipeline";

interface Props {
  node: TextNode;
}

function SceneTextNodeImpl({ node }: Props) {
  const font = resolveFont(node.fontFamily, node.fontWeight, node.fontSize, node.lineHeight, node.letterSpacing);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        fontFamily: `"${font.family}"`,
        fontSize: font.size,
        fontWeight: font.weight,
        lineHeight: font.lineHeight,
        letterSpacing: font.letterSpacing !== 0 ? font.letterSpacing : undefined,
        color: node.color || "#000000",
        textAlign: node.align || "left",
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
