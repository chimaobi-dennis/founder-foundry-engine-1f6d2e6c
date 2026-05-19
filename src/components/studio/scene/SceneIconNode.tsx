import { memo } from "react";
import type { IconNode } from "@/types/scene";

interface Props {
  node: IconNode;
}

function SceneIconNodeImpl({ node }: Props) {
  const size = Math.min(node.width, node.height);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: node.color || "#000000",
      }}
    >
      <svg
        width={size - 8}
        height={size - 8}
        viewBox={`0 0 ${size - 8} ${size - 8}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={node.strokeWidth || 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx={(size - 8) / 2} cy={(size - 8) / 2} r={(size - 8) / 2 - 2} />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          stroke="none"
          fontSize={Math.max(8, size * 0.2)}
          fontFamily="Inter"
        >
          {node.iconName || "?"}
        </text>
      </svg>
    </div>
  );
}

export const SceneIconNode = memo(SceneIconNodeImpl);
