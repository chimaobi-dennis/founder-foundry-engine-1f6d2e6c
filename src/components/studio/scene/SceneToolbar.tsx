import { Type, Image as ImageIcon, Square, Trash2, Copy, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSceneStore, sceneHelpers } from "./sceneStore";
import type { SceneNode } from "@/types/scene";

function newId(prefix: string) {
  return sceneHelpers.makeId(prefix);
}

export function SceneToolbar() {
  const { addNode, deleteSelected, duplicateSelected, undo, redo, camera, setZoom, setPan, selectedIds } = useSceneStore();
  const zoom = camera.zoom;

  const addText = () => {
    const node: SceneNode = {
      id: newId("text"),
      type: "text",
      x: 100, y: 100, width: 320, height: 80, rotation: 0, opacity: 1, zIndex: 0,
      text: "New text",
      fontSize: 32, fontFamily: "DM Sans, sans-serif", fontWeight: 500,
      lineHeight: 1.2, letterSpacing: 0, color: "#111111", align: "left",
    };
    addNode(node);
  };
  const addShape = () => {
    const node: SceneNode = {
      id: newId("shape"), type: "shape",
      x: 120, y: 120, width: 240, height: 160, rotation: 0, opacity: 1, zIndex: 0,
      fill: "#D4A017", stroke: "transparent", strokeWidth: 0, radius: 12,
    };
    addNode(node);
  };
  const addImage = () => {
    const url = window.prompt("Image URL");
    if (!url) return;
    const node: SceneNode = {
      id: newId("image"), type: "image",
      x: 100, y: 100, width: 360, height: 240, rotation: 0, opacity: 1, zIndex: 0,
      src: url, objectFit: "cover", borderRadius: 8,
    };
    addNode(node);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card">
      <Button variant="ghost" size="sm" onClick={addText} title="Add text"><Type className="h-4 w-4" /></Button>
      <Button variant="ghost" size="sm" onClick={addImage} title="Add image"><ImageIcon className="h-4 w-4" /></Button>
      <Button variant="ghost" size="sm" onClick={addShape} title="Add shape"><Square className="h-4 w-4" /></Button>
      <div className="w-px h-5 bg-border mx-1" />
      <Button variant="ghost" size="sm" onClick={duplicateSelected} disabled={!selectedIds.length} title="Duplicate"><Copy className="h-4 w-4" /></Button>
      <Button variant="ghost" size="sm" onClick={deleteSelected} disabled={!selectedIds.length} title="Delete"><Trash2 className="h-4 w-4" /></Button>
      <div className="w-px h-5 bg-border mx-1" />
      <Button variant="ghost" size="sm" onClick={undo} title="Undo"><Undo2 className="h-4 w-4" /></Button>
      <Button variant="ghost" size="sm" onClick={redo} title="Redo"><Redo2 className="h-4 w-4" /></Button>
      <div className="flex-1" />
      <Button variant="ghost" size="sm" onClick={() => setZoom(zoom - 0.1)}><ZoomOut className="h-4 w-4" /></Button>
      <span className="text-xs tabular-nums w-12 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
      <Button variant="ghost" size="sm" onClick={() => setZoom(zoom + 0.1)}><ZoomIn className="h-4 w-4" /></Button>
      <Button variant="ghost" size="sm" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset view">
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
