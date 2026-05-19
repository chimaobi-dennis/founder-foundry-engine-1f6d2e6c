import { memo } from "react";
import type { SvgNode } from "@/types/scene";

interface Props {
  node: SvgNode;
}

function SceneSvgNodeImpl({ node }: Props) {
  if (!node.svgContent) {
    return (
      <div style={{ width: "100%", height: "100%", background: "#f0f0f0" }} />
    );
  }

  if (node.svgContent.startsWith("data:")) {
    return (
      <img
        src={node.svgContent}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />
    );
  }

  return (
    <div
      style={{ width: "100%", height: "100%" }}
      dangerouslySetInnerHTML={{ __html: node.svgContent }}
    />
  );
}

export const SceneSvgNode = memo(SceneSvgNodeImpl);
