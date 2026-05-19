/**
 * SceneDebugOverlay.tsx
 *
 * Debug visualization for scene rendering.
 * Shows: node bounds, clipping masks, text baselines,
 * pivots, transforms, render regions.
 *
 * Activate via `debug={true}` prop on SceneRenderer.
 */

import { memo, useMemo } from "react";
import type { SceneDocument, SceneNode } from "@/types/scene";
import { clampRadius } from "@/lib/renderers/sceneRenderPipeline";

interface Props {
  document: SceneDocument;
}

interface FlatNode {
  node: SceneNode;
  depth: number;
}

function SceneDebugOverlayImpl({ document: doc }: Props) {
  const flatNodes = useMemo(() => {
    const result: FlatNode[] = [];
    function walk(nodes: SceneNode[], depth: number) {
      for (const node of nodes) {
        result.push({ node, depth });
        if ("children" in node && Array.isArray(node.children)) {
          walk(node.children, depth + 1);
        }
      }
    }
    walk(doc.nodes, 0);
    return result;
  }, [doc.nodes]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 99999,
      }}
    >
      {flatNodes.map(({ node, depth }) => (
        <NodeDebugBox key={node.id} node={node} depth={depth} />
      ))}
    </div>
  );
}

const DEPTH_COLORS = [
  "rgba(255, 0, 0, 0.4)",
  "rgba(0, 128, 255, 0.4)",
  "rgba(0, 200, 0, 0.4)",
  "rgba(200, 0, 200, 0.4)",
  "rgba(255, 165, 0, 0.4)",
];

function NodeDebugBox({ node, depth }: { node: SceneNode; depth: number }) {
  const color = DEPTH_COLORS[depth % DEPTH_COLORS.length];
  const isText = node.type === "text";
  const hasRadius =
    (node.type === "shape" && node.radius > 0) ||
    (node.type === "image" && node.borderRadius > 0) ||
    (node.type === "frame" && node.radius > 0) ||
    (node.type === "button" && node.radius > 0);

  const radiusValue =
    node.type === "shape" ? clampRadius(node.radius, node.width, node.height).radius :
    node.type === "image" ? clampRadius(node.borderRadius, node.width, node.height).radius :
    node.type === "frame" ? clampRadius(node.radius, node.width, node.height).radius :
    node.type === "button" ? clampRadius(node.radius, node.width, node.height).radius :
    0;

  return (
    <>
      {/* Bounding box */}
      <div
        style={{
          position: "absolute",
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
          border: `1px solid ${color}`,
          borderRadius: hasRadius ? radiusValue : undefined,
          transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
          transformOrigin: "center center",
          boxSizing: "border-box",
        }}
      >
        {/* Node label */}
        <span
          style={{
            position: "absolute",
            top: -14,
            left: 0,
            fontSize: 9,
            fontFamily: "monospace",
            color,
            whiteSpace: "nowrap",
            lineHeight: 1,
            background: "rgba(0,0,0,0.7)",
            padding: "1px 3px",
            borderRadius: 2,
          }}
        >
          {node.type}:{node.id.slice(0, 6)} z{node.zIndex}
        </span>

        {/* Pivot indicator */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Text baseline indicator */}
        {isText && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: (node as any).fontSize || 16,
              height: 1,
              background: "rgba(255, 255, 0, 0.6)",
            }}
          />
        )}
      </div>
    </>
  );
}

export const SceneDebugOverlay = memo(SceneDebugOverlayImpl);
