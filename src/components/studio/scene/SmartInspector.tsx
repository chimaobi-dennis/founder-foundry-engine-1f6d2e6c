import { useState } from "react";
import {
  ChevronDown, ChevronRight, Sparkles, Palette,
  Type, Move, Eye, Layers, Settings2
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useSceneStore } from "./sceneStore";
import { isTextNode, isImageNode, isShapeNode, type SceneNode, type TextNode } from "@/types/scene";
import { AiQuickActions } from "./AiQuickActions";

// ─── Component ───────────────────────────────────────────────

export function SmartInspector() {
  const { selectedNode, updateNode, document: scene } = useSceneStore();

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full">
        <InspectorHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Settings2 className="h-5 w-5 text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">Select a layer to inspect</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {scene.nodes.length} layer{scene.nodes.length !== 1 ? "s" : ""} · {scene.width}×{scene.height}
          </p>
        </div>
      </div>
    );
  }

  const n = selectedNode;
  const set = (patch: Partial<SceneNode>) => updateNode(n.id, patch);

  return (
    <div className="flex flex-col h-full">
      <InspectorHeader>
        <AiQuickActions />
      </InspectorHeader>

      <div className="flex-1 overflow-y-auto">
        {/* Transform */}
        <InspectorGroup label="Transform" icon={<Move className="h-3 w-3" />} defaultOpen>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <MiniField label="X" value={n.x} onChange={(v) => set({ x: v } as Partial<SceneNode>)} />
            <MiniField label="Y" value={n.y} onChange={(v) => set({ y: v } as Partial<SceneNode>)} />
            <MiniField label="W" value={n.width} onChange={(v) => set({ width: v } as Partial<SceneNode>)} />
            <MiniField label="H" value={n.height} onChange={(v) => set({ height: v } as Partial<SceneNode>)} />
            <MiniField label="Rot" value={n.rotation} onChange={(v) => set({ rotation: v } as Partial<SceneNode>)} />
            <MiniField label="Z" value={n.zIndex} onChange={(v) => set({ zIndex: v } as Partial<SceneNode>)} />
          </div>
        </InspectorGroup>

        {/* Appearance */}
        <InspectorGroup label="Appearance" icon={<Eye className="h-3 w-3" />} defaultOpen>
          <MiniSlider label="Opacity" value={n.opacity} min={0} max={1} step={0.01} onChange={(v) => set({ opacity: v } as Partial<SceneNode>)} />
        </InspectorGroup>

        {/* Text */}
        {isTextNode(n) && (
          <InspectorGroup label="Typography" icon={<Type className="h-3 w-3" />} defaultOpen>
            <div className="space-y-2">
              <textarea
                value={n.text}
                onChange={(e) => set({ text: e.target.value } as Partial<SceneNode>)}
                className="w-full bg-muted/30 border border-border/50 rounded-md px-2 py-1.5 text-xs resize-none min-h-[48px] outline-none focus:border-primary/40"
                rows={2}
              />
              <MiniTextField label="Font" value={n.fontFamily} onChange={(v) => set({ fontFamily: v } as Partial<SceneNode>)} />
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <MiniField label="Size" value={n.fontSize} onChange={(v) => set({ fontSize: v } as Partial<SceneNode>)} />
                <MiniField label="Weight" value={n.fontWeight} step={100} onChange={(v) => set({ fontWeight: v } as Partial<SceneNode>)} />
                <MiniField label="Leading" value={n.lineHeight} step={0.05} onChange={(v) => set({ lineHeight: v } as Partial<SceneNode>)} />
                <MiniField label="Tracking" value={n.letterSpacing} step={0.1} onChange={(v) => set({ letterSpacing: v } as Partial<SceneNode>)} />
              </div>
              <MiniColorField label="Color" value={n.color} onChange={(v) => set({ color: v } as Partial<SceneNode>)} />
            </div>
          </InspectorGroup>
        )}

        {/* Image */}
        {isImageNode(n) && (
          <InspectorGroup label="Image" icon={<Layers className="h-3 w-3" />} defaultOpen>
            <MiniTextField label="Source" value={n.src} onChange={(v) => set({ src: v } as Partial<SceneNode>)} />
            <MiniField label="Radius" value={n.borderRadius} onChange={(v) => set({ borderRadius: v } as Partial<SceneNode>)} />
          </InspectorGroup>
        )}

        {/* Shape */}
        {isShapeNode(n) && (
          <InspectorGroup label="Shape" icon={<Palette className="h-3 w-3" />} defaultOpen>
            <MiniColorField label="Fill" value={n.fill} onChange={(v) => set({ fill: v } as Partial<SceneNode>)} />
            <MiniColorField label="Stroke" value={n.stroke} onChange={(v) => set({ stroke: v } as Partial<SceneNode>)} />
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <MiniField label="Stroke W" value={n.strokeWidth} onChange={(v) => set({ strokeWidth: v } as Partial<SceneNode>)} />
              <MiniField label="Radius" value={n.radius} onChange={(v) => set({ radius: v } as Partial<SceneNode>)} />
            </div>
          </InspectorGroup>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function InspectorHeader({ children }: { children?: React.ReactNode }) {
  return (
    <div className="px-3 py-2 border-b border-border flex items-center gap-2">
      <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs font-semibold text-foreground/90 uppercase tracking-wider flex-1">
        Inspector
      </span>
      {children}
    </div>
  );
}

function InspectorGroup({
  label,
  icon,
  defaultOpen = false,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
        {icon}
        {label}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function MiniField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground/70 w-8 shrink-0 uppercase">{label}</span>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-6 text-[10px] px-1.5"
      />
    </div>
  );
}

function MiniTextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground/70 w-8 shrink-0 uppercase">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-6 text-[10px] px-1.5" />
    </div>
  );
}

function MiniColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground/70 w-8 shrink-0 uppercase">{label}</span>
      <input
        type="color"
        value={value.startsWith("#") ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-6 rounded border border-border cursor-pointer shrink-0"
      />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-6 text-[10px] px-1.5 flex-1" />
    </div>
  );
}

function MiniSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-muted-foreground/70 w-12 shrink-0 uppercase">{label}</span>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} className="flex-1" />
      <span className="text-[9px] text-muted-foreground w-8 text-right tabular-nums">
        {Number.isInteger(value) ? value : (value * 100).toFixed(0) + "%"}
      </span>
    </div>
  );
}
