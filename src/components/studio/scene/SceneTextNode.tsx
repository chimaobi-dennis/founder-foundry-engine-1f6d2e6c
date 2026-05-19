import { memo, useCallback, useRef, useState } from "react";
import type { TextNode, SceneNode } from "@/types/scene";
import { resolveFont } from "@/lib/renderers/sceneRenderPipeline";
import { useSceneStoreSafe } from "./sceneStore";

interface Props {
  node: TextNode;
}

function SceneTextNodeImpl({ node }: Props) {
  const font = resolveFont(node.fontFamily, node.fontWeight, node.fontSize, node.lineHeight, node.letterSpacing);
  const store = useSceneStoreSafe();
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const commitEdit = useCallback(() => {
    if (!ref.current || !store) return;
    const newText = ref.current.innerText || "";
    if (newText !== node.text) {
      store.updateNode(node.id, { text: newText } as Partial<SceneNode>);
    }
    setEditing(false);
  }, [store, node.id, node.text]);

  const onDoubleClick = useCallback(() => {
    if (!store) return;
    setEditing(true);
    // Focus after React re-renders with contentEditable
    requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.focus();
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    });
  }, [store]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      // Revert
      if (ref.current) ref.current.innerText = node.text;
      setEditing(false);
    }
    // Stop propagation so keyboard shortcuts don't fire while editing
    e.stopPropagation();
  }, [node.text]);

  return (
    <div
      ref={ref}
      contentEditable={editing}
      suppressContentEditableWarning
      onDoubleClick={onDoubleClick}
      onBlur={editing ? commitEdit : undefined}
      onKeyDown={editing ? onKeyDown : undefined}
      style={{
        width: "100%",
        height: "100%",
        fontFamily: `"${font.family}"`,
        fontSize: font.size,
        fontWeight: font.weight,
        lineHeight: font.lineHeight,
        letterSpacing: font.letterSpacing !== 0 ? font.letterSpacing : undefined,
        color: node.color || "#000000",
        textAlign: (node.align || "left") as any,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflow: "hidden",
        userSelect: editing ? "text" : "none",
        cursor: editing ? "text" : "inherit",
        outline: editing ? "1px solid hsl(var(--primary) / 0.5)" : "none",
        outlineOffset: 2,
      }}
    >
      {node.text}
    </div>
  );
}

export const SceneTextNode = memo(SceneTextNodeImpl);
