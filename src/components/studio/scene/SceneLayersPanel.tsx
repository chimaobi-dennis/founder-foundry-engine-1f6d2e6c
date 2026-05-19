import { useState } from "react";
import { Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, ChevronRight, Type, Image as ImageIcon, Square, Layers, Box, AlignVerticalJustifyStart, Code, Star, MousePointer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSceneStore } from "./sceneStore";
import type { SceneNode } from "@/types/scene";
import { cn } from "@/lib/utils";

function nodeIcon(n: SceneNode) {
  switch (n.type) {
    case "text": return <Type className="h-3.5 w-3.5" />;
    case "image": return <ImageIcon className="h-3.5 w-3.5" />;
    case "shape": return <Square className="h-3.5 w-3.5" />;
    case "group": return <Layers className="h-3.5 w-3.5" />;
    case "frame": return <Box className="h-3.5 w-3.5" />;
    case "stack": return <AlignVerticalJustifyStart className="h-3.5 w-3.5" />;
    case "svg": return <Code className="h-3.5 w-3.5" />;
    case "icon": return <Star className="h-3.5 w-3.5" />;
    case "button": return <MousePointer className="h-3.5 w-3.5" />;
    default: return <Square className="h-3.5 w-3.5" />;
  }
}

function nodeLabel(n: SceneNode) {
  if (n.type === "text") return n.text.slice(0, 24) || "Text";
  if (n.type === "button") return (n as any).label?.slice(0, 24) || "Button";
  if (n.type === "icon") return (n as any).iconName || "Icon";
  return n.type.charAt(0).toUpperCase() + n.type.slice(1);
}

function hasChildren(n: SceneNode): n is SceneNode & { children: SceneNode[] } {
  return "children" in n && Array.isArray((n as any).children);
}

function LayerRow({
  node,
  depth,
  selectedIds,
  setSelection,
  reorder,
  dispatch,
  ui,
  expanded,
  toggleExpand,
}: {
  node: SceneNode;
  depth: number;
  selectedIds: string[];
  setSelection: (ids: string[]) => void;
  reorder: (id: string, direction: "up" | "down" | "top" | "bottom") => void;
  dispatch: React.Dispatch<any>;
  ui: Record<string, { hidden?: boolean; locked?: boolean }>;
  expanded: Record<string, boolean>;
  toggleExpand: (id: string) => void;
}) {
  const selected = selectedIds.includes(node.id);
  const u = ui[node.id] ?? {};
  const isContainer = hasChildren(node);

  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (e.shiftKey) {
            setSelection(
              selected
                ? selectedIds.filter((id) => id !== node.id)
                : [...selectedIds, node.id]
            );
          } else {
            setSelection([node.id]);
          }
        }}
        className={cn(
          "group flex items-center gap-1 py-1.5 text-xs cursor-pointer border-b border-border/40",
          selected ? "bg-primary/10 text-foreground" : "hover:bg-muted/50 text-foreground/80"
        )}
        style={{ paddingLeft: 8 + depth * 16, paddingRight: 8 }}
      >
        {isContainer ? (
          <button
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
          >
            <ChevronRight
              className={cn("h-3 w-3 transition-transform", expanded[node.id] && "rotate-90")}
            />
          </button>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <span className="text-muted-foreground flex-shrink-0">{nodeIcon(node)}</span>
        <span className="flex-1 truncate">{nodeLabel(node)}</span>
        <button
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); reorder(node.id, "up"); }}
          title="Bring forward"
        ><ChevronUp className="h-3 w-3" /></button>
        <button
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); reorder(node.id, "down"); }}
          title="Send back"
        ><ChevronDown className="h-3 w-3" /></button>
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); dispatch({ type: "toggle_ui", id: node.id, key: "hidden" }); }}
        >
          {u.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); dispatch({ type: "toggle_ui", id: node.id, key: "locked" }); }}
        >
          {u.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
        </button>
      </div>
      {isContainer && expanded[node.id] && (
        [...node.children].sort((a, b) => b.zIndex - a.zIndex).map((child) => (
          <LayerRow
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedIds={selectedIds}
            setSelection={setSelection}
            reorder={reorder}
            dispatch={dispatch}
            ui={ui}
            expanded={expanded}
            toggleExpand={toggleExpand}
          />
        ))
      )}
    </>
  );
}

export function SceneLayersPanel() {
  const { document, selectedIds, setSelection, reorder, dispatch, ui } = useSceneStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const sorted = [...document.nodes].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border flex items-center justify-between">
        <span>Layers</span>
        <span className="text-[10px] font-normal">{document.nodes.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="px-3 py-6 text-xs text-muted-foreground text-center">No layers yet</div>
        )}
        {sorted.map((n) => (
          <LayerRow
            key={n.id}
            node={n}
            depth={0}
            selectedIds={selectedIds}
            setSelection={setSelection}
            reorder={reorder}
            dispatch={dispatch}
            ui={ui}
            expanded={expanded}
            toggleExpand={toggleExpand}
          />
        ))}
      </div>
    </div>
  );
}
