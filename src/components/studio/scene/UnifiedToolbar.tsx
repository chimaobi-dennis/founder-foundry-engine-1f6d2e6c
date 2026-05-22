import {
  Type, Image as ImageIcon, Square, Trash2, Copy, Undo2, Redo2,
  ZoomIn, ZoomOut, Maximize2, Sparkles, Download, Clock, Palette,
  Command, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSceneStore, sceneHelpers } from "./sceneStore";
import { FocusModeToggle } from "./FocusMode";
import type { SceneNode } from "@/types/scene";

// ─── Props ───────────────────────────────────────────────────

interface Props {
  /** Which right panel to show. */
  activePanel?: string;
  onPanelChange?: (panel: string) => void;
  className?: string;
}

// ─── Component ───────────────────────────────────────────────

/**
 * Unified toolbar that converges ContentStudio and ProStudio UI language.
 * Shares icons, spacing rhythm, and interaction patterns.
 */
export function UnifiedToolbar({ activePanel, onPanelChange, className }: Props) {
  const {
    addNode, deleteSelected, duplicateSelected,
    undo, redo, camera, setZoom, setPan, selectedIds
  } = useSceneStore();
  const zoom = camera.zoom;

  const addText = () => {
    const node: SceneNode = {
      id: sceneHelpers.makeId("text"),
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
      id: sceneHelpers.makeId("shape"), type: "shape",
      x: 120, y: 120, width: 240, height: 160, rotation: 0, opacity: 1, zIndex: 0,
      fill: "#D4A017", stroke: "transparent", strokeWidth: 0, radius: 12,
    };
    addNode(node);
  };

  const addImage = () => {
    const url = window.prompt("Image URL");
    if (!url) return;
    const node: SceneNode = {
      id: sceneHelpers.makeId("image"), type: "image",
      x: 100, y: 100, width: 360, height: 240, rotation: 0, opacity: 1, zIndex: 0,
      src: url, objectFit: "cover", borderRadius: 8,
    };
    addNode(node);
  };

  return (
    <div className={cn(
      "flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-card/90 backdrop-blur-sm",
      className
    )}>
      {/* Insert tools */}
      <ToolBtn icon={<Type />} label="Text" onClick={addText} />
      <ToolBtn icon={<ImageIcon />} label="Image" onClick={addImage} />
      <ToolBtn icon={<Square />} label="Shape" onClick={addShape} />

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Edit tools */}
      <ToolBtn icon={<Copy />} label="Duplicate" onClick={duplicateSelected} disabled={!selectedIds.length} />
      <ToolBtn icon={<Trash2 />} label="Delete" onClick={deleteSelected} disabled={!selectedIds.length} />

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* History */}
      <ToolBtn icon={<Undo2 />} label="Undo" onClick={undo} />
      <ToolBtn icon={<Redo2 />} label="Redo" onClick={redo} />

      <div className="flex-1" />

      {/* Panel toggles */}
      <PanelToggle icon={<Sparkles />} label="AI" panelId="copilot" active={activePanel} onToggle={onPanelChange} />
      <PanelToggle icon={<Layers />} label="Inspector" panelId="inspector" active={activePanel} onToggle={onPanelChange} />
      <PanelToggle icon={<Palette />} label="Tokens" panelId="tokens" active={activePanel} onToggle={onPanelChange} />
      <PanelToggle icon={<Clock />} label="Timeline" panelId="timeline" active={activePanel} onToggle={onPanelChange} />
      <PanelToggle icon={<Download />} label="Export" panelId="export" active={activePanel} onToggle={onPanelChange} />

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Zoom */}
      <ToolBtn icon={<ZoomOut />} label="Zoom out" onClick={() => setZoom(zoom - 0.1)} />
      <span className="text-[10px] tabular-nums w-10 text-center text-muted-foreground select-none">
        {Math.round(zoom * 100)}%
      </span>
      <ToolBtn icon={<ZoomIn />} label="Zoom in" onClick={() => setZoom(zoom + 0.1)} />

      <Separator orientation="vertical" className="h-5 mx-1" />

      <FocusModeToggle />

      {/* Command palette hint */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-1.5 text-[10px] text-muted-foreground gap-0.5"
        onClick={() => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
        }}
        title="Command Palette"
      >
        <Command className="h-3 w-3" />K
      </Button>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function ToolBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      <span className="h-3.5 w-3.5 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
    </Button>
  );
}

function PanelToggle({
  icon,
  label,
  panelId,
  active,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  panelId: string;
  active?: string;
  onToggle?: (id: string) => void;
}) {
  const isActive = active === panelId;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-7 w-7 p-0 transition-colors",
        isActive && "text-primary bg-primary/10"
      )}
      onClick={() => onToggle?.(isActive ? "" : panelId)}
      title={label}
    >
      <span className="h-3.5 w-3.5 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
    </Button>
  );
}
