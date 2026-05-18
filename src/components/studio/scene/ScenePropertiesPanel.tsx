import { useSceneStore } from "./sceneStore";
import { isTextNode, isImageNode, isShapeNode, type SceneNode } from "@/types/scene";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-7 text-xs"
      />
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs" />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value.startsWith("#") ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 rounded border border-border bg-transparent cursor-pointer"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs flex-1" />
      </div>
    </div>
  );
}

export function ScenePropertiesPanel() {
  const { selectedNode, updateNode } = useSceneStore();

  if (!selectedNode) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Select a layer to edit its properties.
      </div>
    );
  }

  const n = selectedNode;
  const set = (patch: Partial<SceneNode>) => updateNode(n.id, patch);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
        Properties · {n.type}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={n.x} onChange={(v) => set({ x: v } as Partial<SceneNode>)} />
          <NumberField label="Y" value={n.y} onChange={(v) => set({ y: v } as Partial<SceneNode>)} />
          <NumberField label="W" value={n.width} onChange={(v) => set({ width: v } as Partial<SceneNode>)} />
          <NumberField label="H" value={n.height} onChange={(v) => set({ height: v } as Partial<SceneNode>)} />
          <NumberField label="Rotation" value={n.rotation} onChange={(v) => set({ rotation: v } as Partial<SceneNode>)} />
          <NumberField label="Opacity" value={n.opacity} step={0.05} onChange={(v) => set({ opacity: Math.max(0, Math.min(1, v)) } as Partial<SceneNode>)} />
        </div>

        {isTextNode(n) && (
          <div className="space-y-2 pt-2 border-t border-border">
            <TextField label="Text" value={n.text} onChange={(v) => set({ text: v } as Partial<SceneNode>)} />
            <TextField label="Font family" value={n.fontFamily} onChange={(v) => set({ fontFamily: v } as Partial<SceneNode>)} />
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Size" value={n.fontSize} onChange={(v) => set({ fontSize: v } as Partial<SceneNode>)} />
              <NumberField label="Weight" value={n.fontWeight} step={100} onChange={(v) => set({ fontWeight: v } as Partial<SceneNode>)} />
              <NumberField label="Line height" value={n.lineHeight} step={0.05} onChange={(v) => set({ lineHeight: v } as Partial<SceneNode>)} />
              <NumberField label="Tracking" value={n.letterSpacing} step={0.1} onChange={(v) => set({ letterSpacing: v } as Partial<SceneNode>)} />
            </div>
            <ColorField label="Color" value={n.color} onChange={(v) => set({ color: v } as Partial<SceneNode>)} />
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Align</Label>
              <select
                value={n.align}
                onChange={(e) => set({ align: e.target.value as TextAlign } as Partial<SceneNode>)}
                className="h-7 text-xs w-full rounded border border-input bg-background px-2"
              >
                {(["left", "center", "right", "justify"] as const).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {isImageNode(n) && (
          <div className="space-y-2 pt-2 border-t border-border">
            <TextField label="Source" value={n.src} onChange={(v) => set({ src: v } as Partial<SceneNode>)} />
            <NumberField label="Radius" value={n.borderRadius} onChange={(v) => set({ borderRadius: v } as Partial<SceneNode>)} />
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Object fit</Label>
              <select
                value={n.objectFit}
                onChange={(e) => set({ objectFit: e.target.value as ObjectFit } as Partial<SceneNode>)}
                className="h-7 text-xs w-full rounded border border-input bg-background px-2"
              >
                {(["cover", "contain", "fill", "none"] as const).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {isShapeNode(n) && (
          <div className="space-y-2 pt-2 border-t border-border">
            <ColorField label="Fill" value={n.fill} onChange={(v) => set({ fill: v } as Partial<SceneNode>)} />
            <ColorField label="Stroke" value={n.stroke} onChange={(v) => set({ stroke: v } as Partial<SceneNode>)} />
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Stroke width" value={n.strokeWidth} onChange={(v) => set({ strokeWidth: v } as Partial<SceneNode>)} />
              <NumberField label="Radius" value={n.radius} onChange={(v) => set({ radius: v } as Partial<SceneNode>)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type TextAlign = "left" | "center" | "right" | "justify";
type ObjectFit = "cover" | "contain" | "fill" | "none";
