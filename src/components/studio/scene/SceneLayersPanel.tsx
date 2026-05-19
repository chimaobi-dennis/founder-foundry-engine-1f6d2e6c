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

export function SceneLayersPanel() {
  const { document, selectedIds, setSelection, reorder, dispatch, ui } = useSceneStore();
  const [renaming, setRenaming] = useState<string | null>(null);
  const sorted = [...document.nodes].sort((a, b) => b.zIndex - a.zIndex); // top first

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
        Layers
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="px-3 py-6 text-xs text-muted-foreground text-center">No layers yet</div>
        )}
        {sorted.map((n) => {
          const selected = selectedIds.includes(n.id);
          const u = ui[n.id] ?? {};
          return (
            <div
              key={n.id}
              onClick={() => setSelection([n.id])}
              className={cn(
                "group flex items-center gap-1.5 px-2 py-1.5 text-xs cursor-pointer border-b border-border/40",
                selected ? "bg-primary/10 text-foreground" : "hover:bg-muted/50 text-foreground/80"
              )}
            >
              <span className="text-muted-foreground">{nodeIcon(n)}</span>
              {renaming === n.id && n.type === "text" ? (
                <Input
                  autoFocus
                  defaultValue={n.text}
                  onBlur={(e) => { dispatch({ type: "update_node", id: n.id, patch: { text: e.target.value } as Partial<SceneNode> }); setRenaming(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="h-6 text-xs"
                />
              ) : (
                <span
                  className="flex-1 truncate"
                  onDoubleClick={() => n.type === "text" && setRenaming(n.id)}
                >
                  {nodeLabel(n)}
                </span>
              )}
              <button
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); reorder(n.id, "up"); }}
                title="Bring forward"
              ><ChevronUp className="h-3 w-3" /></button>
              <button
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); reorder(n.id, "down"); }}
                title="Send back"
              ><ChevronDown className="h-3 w-3" /></button>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); dispatch({ type: "toggle_ui", id: n.id, key: "hidden" }); }}
              >
                {u.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); dispatch({ type: "toggle_ui", id: n.id, key: "locked" }); }}
              >
                {u.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
