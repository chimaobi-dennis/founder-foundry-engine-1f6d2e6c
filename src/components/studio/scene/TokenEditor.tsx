import { useCallback, useMemo } from "react";
import { Palette, Type, Space, RectangleHorizontal } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSceneStore } from "./sceneStore";
import {
  extractTokensFromScene,
  applyTokens,
  type DesignTokens,
  type ColorTokens,
  type TypographyTokens,
} from "@/lib/scene/sceneTokens";

// ─── Component ───────────────────────────────────────────────

export function TokenEditor() {
  const { document: scene, applyScene } = useSceneStore();

  const tokens = useMemo(() => extractTokensFromScene(scene), [scene]);

  const update = useCallback(
    (partial: Partial<DesignTokens>) => {
      const merged: DesignTokens = {
        colors: { ...tokens.colors, ...(partial.colors || {}) },
        typography: { ...tokens.typography, ...(partial.typography || {}) },
        spacing: { ...tokens.spacing, ...(partial.spacing || {}) },
        radii: { ...tokens.radii, ...(partial.radii || {}) },
      };
      const updated = applyTokens(scene, merged);
      applyScene(updated);
    },
    [scene, tokens, applyScene]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Palette className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground/90 uppercase tracking-wider">
          Design Tokens
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-5">
          {/* Colors */}
          <TokenSection label="Colors" icon={<Palette className="h-3 w-3" />}>
            <ColorSwatch
              label="Background"
              value={tokens.colors.background}
              onChange={(v) => update({ colors: { ...tokens.colors, background: v } })}
            />
            <ColorSwatch
              label="Foreground"
              value={tokens.colors.foreground}
              onChange={(v) => update({ colors: { ...tokens.colors, foreground: v } })}
            />
            <ColorSwatch
              label="Primary"
              value={tokens.colors.primary}
              onChange={(v) => update({ colors: { ...tokens.colors, primary: v } })}
            />
            <ColorSwatch
              label="Accent"
              value={tokens.colors.accent}
              onChange={(v) => update({ colors: { ...tokens.colors, accent: v } })}
            />
            <ColorSwatch
              label="CTA Fill"
              value={tokens.colors.ctaFill}
              onChange={(v) => update({ colors: { ...tokens.colors, ctaFill: v } })}
            />
            <ColorSwatch
              label="CTA Text"
              value={tokens.colors.ctaText}
              onChange={(v) => update({ colors: { ...tokens.colors, ctaText: v } })}
            />
          </TokenSection>

          {/* Typography */}
          <TokenSection label="Typography" icon={<Type className="h-3 w-3" />}>
            <TokenField
              label="Heading Font"
              value={tokens.typography.headingFont}
              onChange={(v) => update({ typography: { ...tokens.typography, headingFont: v } })}
            />
            <TokenField
              label="Body Font"
              value={tokens.typography.bodyFont}
              onChange={(v) => update({ typography: { ...tokens.typography, bodyFont: v } })}
            />
            <TokenNumberField
              label="Base Size"
              value={tokens.typography.baseSize}
              min={8}
              max={32}
              onChange={(v) => update({ typography: { ...tokens.typography, baseSize: v } })}
            />
            <TokenNumberField
              label="Heading Weight"
              value={tokens.typography.headingWeight}
              min={100}
              max={900}
              step={100}
              onChange={(v) => update({ typography: { ...tokens.typography, headingWeight: v } })}
            />
            <TokenSlider
              label="Scale Ratio"
              value={tokens.typography.scaleRatio}
              min={1.05}
              max={2}
              step={0.05}
              onChange={(v) => update({ typography: { ...tokens.typography, scaleRatio: v } })}
            />
          </TokenSection>

          {/* Spacing */}
          <TokenSection label="Spacing" icon={<Space className="h-3 w-3" />}>
            {(["xs", "sm", "md", "lg", "xl"] as const).map((key) => (
              <TokenNumberField
                key={key}
                label={key.toUpperCase()}
                value={tokens.spacing[key]}
                min={0}
                max={120}
                onChange={(v) => update({ spacing: { ...tokens.spacing, [key]: v } })}
              />
            ))}
          </TokenSection>

          {/* Radii */}
          <TokenSection label="Corner Radius" icon={<RectangleHorizontal className="h-3 w-3" />}>
            {(["sm", "md", "lg"] as const).map((key) => (
              <TokenSlider
                key={key}
                label={key.toUpperCase()}
                value={tokens.radii[key]}
                min={0}
                max={32}
                step={1}
                onChange={(v) => update({ radii: { ...tokens.radii, [key]: v } })}
              />
            ))}
          </TokenSection>
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function TokenSection({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value.startsWith("#") ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-6 rounded border border-border bg-transparent cursor-pointer shrink-0"
      />
      <span className="text-[10px] text-muted-foreground w-16">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 text-[10px] flex-1"
      />
    </div>
  );
}

function TokenField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-20 shrink-0">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 text-[10px] flex-1"
      />
    </div>
  );
}

function TokenNumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-20 shrink-0">{label}</span>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-6 text-[10px] flex-1"
      />
    </div>
  );
}

function TokenSlider({
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
      <span className="text-[10px] text-muted-foreground w-20 shrink-0">{label}</span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="flex-1"
      />
      <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums">
        {Number.isInteger(value) ? value : value.toFixed(2)}
      </span>
    </div>
  );
}
