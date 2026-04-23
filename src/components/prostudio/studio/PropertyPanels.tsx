import { useEffect, useState } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  FlipHorizontal2,
  FlipVertical2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mutator type — caller wires this to update the actual DOM element by id
export type ApplyStyle = (style: Partial<CSSStyleDeclaration> | Record<string, string>) => void;
export type ApplyAttr = (attrs: Record<string, string>) => void;
export type ReadStyle = (prop: keyof CSSStyleDeclaration | string) => string;

const FONT_FAMILIES = [
  "Playfair Display",
  "DM Sans",
  "Inter",
  "Helvetica Neue",
  "Georgia",
  "Times New Roman",
  "Roboto",
  "Lora",
  "Space Grotesk",
];

/* ========================================================================== */
/*  Shared bits                                                                */
/* ========================================================================== */

export function PropGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-ui font-semibold uppercase tracking-[0.1em] mb-2 text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  suffix,
  onChange,
}: {
  value: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center h-8 rounded-md px-2.5 text-[12px] font-ui bg-background border border-border text-foreground">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 bg-transparent outline-none min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {suffix && <span className="text-muted-foreground text-[11px]">{suffix}</span>}
    </div>
  );
}

function ColorSwatch({
  value,
  onChange,
  brandColors,
}: {
  value: string;
  onChange: (v: string) => void;
  brandColors?: string[];
}) {
  const documentColors = ["#0D1B2A", "#F5F0E8", "#D4A017", "#1A2A3A", "#8A96A3"];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="relative w-7 h-7 rounded-md flex-shrink-0 border border-border overflow-hidden cursor-pointer">
          <input
            type="color"
            value={normalizeColor(value)}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <div className="w-full h-full" style={{ backgroundColor: value }} />
        </label>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-8 rounded-md px-2.5 text-[12px] font-ui bg-background border border-border text-foreground outline-none"
        />
      </div>
      {(brandColors?.length || documentColors.length) > 0 && (
        <div className="space-y-1">
          {brandColors && brandColors.length > 0 && (
            <SwatchRow label="Brand" colors={brandColors} onPick={onChange} />
          )}
          <SwatchRow label="Document" colors={documentColors} onPick={onChange} />
        </div>
      )}
    </div>
  );
}

function SwatchRow({
  label,
  colors,
  onPick,
}: {
  label: string;
  colors: string[];
  onPick: (c: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-ui uppercase tracking-wider text-muted-foreground w-12">
        {label}
      </span>
      <div className="flex gap-1">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            title={c}
            className="w-4 h-4 rounded-sm border border-border hover:scale-110 transition-transform"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

function normalizeColor(c: string): string {
  if (c.startsWith("#") && (c.length === 4 || c.length === 7)) return c.length === 4
    ? "#" + c.slice(1).split("").map((x) => x + x).join("")
    : c;
  // rgb() or other — fall back to black for native picker
  if (c.startsWith("rgb")) {
    const m = c.match(/\d+/g);
    if (m && m.length >= 3) {
      const [r, g, b] = m.map(Number);
      return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
    }
  }
  return "#000000";
}

function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 appearance-none rounded-full cursor-pointer bg-background"
      style={{ accentColor: "hsl(var(--primary))" }}
    />
  );
}

/* ========================================================================== */
/*  Text properties                                                            */
/* ========================================================================== */

export function TextProperties({
  apply,
  read,
  brandColors,
}: {
  apply: ApplyStyle;
  read: ReadStyle;
  brandColors?: string[];
}) {
  const [fontFamily, setFontFamily] = useState(stripQuotes(read("fontFamily")) || "DM Sans");
  const [fontSize, setFontSize] = useState(parseFloat(read("fontSize")) || 16);
  const [fontWeight, setFontWeight] = useState(read("fontWeight") || "400");
  const [italic, setItalic] = useState(read("fontStyle") === "italic");
  const [decoration, setDecoration] = useState(read("textDecorationLine") || "none");
  const [textAlign, setTextAlign] = useState((read("textAlign") || "left") as string);
  const [color, setColor] = useState(read("color") || "#000000");
  const [letterSpacing, setLetterSpacing] = useState(parseFloat(read("letterSpacing")) || 0);
  const [lineHeight, setLineHeight] = useState(
    parseFloat(read("lineHeight")) || 1.2,
  );

  // Re-pull when underlying selection changes
  useEffect(() => {
    setFontFamily(stripQuotes(read("fontFamily")) || "DM Sans");
    setFontSize(parseFloat(read("fontSize")) || 16);
    setFontWeight(read("fontWeight") || "400");
    setItalic(read("fontStyle") === "italic");
    setDecoration(read("textDecorationLine") || "none");
    setTextAlign(read("textAlign") || "left");
    setColor(read("color") || "#000000");
    setLetterSpacing(parseFloat(read("letterSpacing")) || 0);
    setLineHeight(parseFloat(read("lineHeight")) || 1.2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDecoration = (kind: "underline" | "line-through") => {
    const parts = new Set(decoration.split(" ").filter((p) => p && p !== "none"));
    if (parts.has(kind)) parts.delete(kind); else parts.add(kind);
    const next = parts.size ? Array.from(parts).join(" ") : "none";
    setDecoration(next);
    apply({ textDecoration: next });
  };

  return (
    <>
      <PropGroup label="Typography">
        <div className="space-y-2">
          <select
            value={fontFamily}
            onChange={(e) => {
              setFontFamily(e.target.value);
              apply({ fontFamily: `'${e.target.value}', sans-serif` });
              ensureGoogleFont(e.target.value);
            }}
            className="w-full h-8 rounded-md px-2 text-[12px] font-ui bg-background border border-border text-foreground outline-none"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center h-8 rounded-md bg-background border border-border overflow-hidden">
              <button
                onClick={() => { const v = Math.max(6, fontSize - 1); setFontSize(v); apply({ fontSize: v + "px" }); }}
                className="w-7 h-full text-[14px] text-muted-foreground hover:bg-muted"
              >−</button>
              <input
                type="number"
                value={fontSize}
                onChange={(e) => { const v = Number(e.target.value); setFontSize(v); apply({ fontSize: v + "px" }); }}
                className="flex-1 bg-transparent outline-none text-center text-[12px] font-ui min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => { const v = fontSize + 1; setFontSize(v); apply({ fontSize: v + "px" }); }}
                className="w-7 h-full text-[14px] text-muted-foreground hover:bg-muted"
              >+</button>
            </div>
            <select
              value={fontWeight}
              onChange={(e) => { setFontWeight(e.target.value); apply({ fontWeight: e.target.value }); }}
              className="h-8 rounded-md px-2 text-[12px] font-ui bg-background border border-border text-foreground outline-none"
            >
              {["300", "400", "500", "600", "700", "800"].map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>
      </PropGroup>

      <PropGroup label="Style">
        <div className="flex gap-1.5">
          <StyleToggle
            active={Number(fontWeight) >= 600}
            onClick={() => {
              const next = Number(fontWeight) >= 600 ? "400" : "700";
              setFontWeight(next); apply({ fontWeight: next });
            }}
          ><Bold size={13} /></StyleToggle>
          <StyleToggle active={italic} onClick={() => { const v = !italic; setItalic(v); apply({ fontStyle: v ? "italic" : "normal" }); }}>
            <Italic size={13} />
          </StyleToggle>
          <StyleToggle active={decoration.includes("underline")} onClick={() => toggleDecoration("underline")}>
            <Underline size={13} />
          </StyleToggle>
          <StyleToggle active={decoration.includes("line-through")} onClick={() => toggleDecoration("line-through")}>
            <Strikethrough size={13} />
          </StyleToggle>
        </div>
      </PropGroup>

      <PropGroup label="Alignment">
        <div className="flex gap-1 p-1 rounded-md bg-background border border-border">
          {[
            { id: "left", icon: AlignLeft },
            { id: "center", icon: AlignCenter },
            { id: "right", icon: AlignRight },
            { id: "justify", icon: AlignJustify },
          ].map(({ id, icon: I }) => (
            <button
              key={id}
              onClick={() => { setTextAlign(id); apply({ textAlign: id }); }}
              className={cn(
                "flex-1 h-7 rounded flex items-center justify-center transition-colors",
                textAlign === id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <I size={13} />
            </button>
          ))}
        </div>
      </PropGroup>

      <PropGroup label="Color">
        <ColorSwatch
          value={color}
          onChange={(v) => { setColor(v); apply({ color: v }); }}
          brandColors={brandColors}
        />
      </PropGroup>

      <PropGroup label={`Letter spacing — ${letterSpacing}px`}>
        <Slider
          min={-2}
          max={20}
          step={0.1}
          value={letterSpacing}
          onChange={(v) => { setLetterSpacing(v); apply({ letterSpacing: v + "px" }); }}
        />
      </PropGroup>

      <PropGroup label={`Line height — ${lineHeight.toFixed(2)}`}>
        <Slider
          min={0.8}
          max={3}
          step={0.05}
          value={lineHeight}
          onChange={(v) => { setLineHeight(v); apply({ lineHeight: String(v) }); }}
        />
      </PropGroup>

      <PropGroup label="Effects">
        <button
          disabled
          className="w-full h-8 rounded-md text-[11px] font-ui text-muted-foreground bg-background border border-border opacity-60 cursor-not-allowed"
        >
          Shadow & outline · Coming soon
        </button>
      </PropGroup>
    </>
  );
}

function StyleToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-8 h-8 rounded-md flex items-center justify-center transition-colors border",
        active
          ? "bg-primary/15 text-primary border-primary/40"
          : "bg-background border-border text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function stripQuotes(s: string) {
  return s.replace(/^['"]|['"]$/g, "").split(",")[0].trim();
}

const loadedFonts = new Set<string>();
function ensureGoogleFont(family: string) {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const id = "gf-" + family.replace(/\s+/g, "-");
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family,
  )}:wght@300;400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}

/* ========================================================================== */
/*  Image properties                                                           */
/* ========================================================================== */

export function ImageProperties({
  apply,
  applyAttr,
  read,
  readAttr,
  onPickAsset,
}: {
  apply: ApplyStyle;
  applyAttr: ApplyAttr;
  read: ReadStyle;
  readAttr: (a: string) => string;
  onPickAsset?: () => void;
}) {
  const [opacity, setOpacity] = useState(Math.round((parseFloat(read("opacity")) || 1) * 100));
  const [borderRadius, setBorderRadius] = useState(parseFloat(read("borderRadius")) || 0);
  const [fit, setFit] = useState((read("objectFit") || "cover") as string);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [src, setSrc] = useState(readAttr("src"));

  const applyTransform = (h: boolean, v: boolean) => {
    const parts: string[] = [];
    if (h) parts.push("scaleX(-1)");
    if (v) parts.push("scaleY(-1)");
    apply({ transform: parts.join(" ") || "none" });
  };

  return (
    <>
      <PropGroup label="Source">
        <div className="space-y-2">
          <button
            onClick={onPickAsset}
            className="w-full h-8 rounded-md text-[12px] font-ui font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Replace image
          </button>
          <input
            value={src}
            onChange={(e) => { setSrc(e.target.value); applyAttr({ src: e.target.value }); }}
            placeholder="Image URL"
            className="w-full h-8 rounded-md px-2.5 text-[11px] font-ui bg-background border border-border text-foreground outline-none truncate"
          />
        </div>
      </PropGroup>

      <PropGroup label="Fit">
        <div className="flex p-1 rounded-md bg-background border border-border">
          {(["cover", "contain", "fill"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFit(f); apply({ objectFit: f }); }}
              className={cn(
                "flex-1 h-7 rounded text-[11px] font-ui capitalize transition-colors",
                fit === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </PropGroup>

      <PropGroup label="Flip">
        <div className="flex gap-1.5">
          <StyleToggle active={flipH} onClick={() => { const v = !flipH; setFlipH(v); applyTransform(v, flipV); }}>
            <FlipHorizontal2 size={13} />
          </StyleToggle>
          <StyleToggle active={flipV} onClick={() => { const v = !flipV; setFlipV(v); applyTransform(flipH, v); }}>
            <FlipVertical2 size={13} />
          </StyleToggle>
        </div>
      </PropGroup>

      <PropGroup label={`Opacity — ${opacity}%`}>
        <Slider
          min={0} max={100} value={opacity}
          onChange={(v) => { setOpacity(v); apply({ opacity: String(v / 100) }); }}
        />
      </PropGroup>

      <PropGroup label={`Border radius — ${borderRadius}px`}>
        <Slider
          min={0} max={200} value={borderRadius}
          onChange={(v) => { setBorderRadius(v); apply({ borderRadius: v + "px" }); }}
        />
      </PropGroup>
    </>
  );
}

/* ========================================================================== */
/*  Background properties                                                      */
/* ========================================================================== */

export function BackgroundProperties({
  apply,
  read,
  brandColors,
}: {
  apply: ApplyStyle;
  read: ReadStyle;
  brandColors?: string[];
}) {
  const initial = read("backgroundImage");
  const [type, setType] = useState<"solid" | "gradient">(initial && initial !== "none" ? "gradient" : "solid");
  const [solid, setSolid] = useState(read("backgroundColor") || "#FFFFFF");
  const [from, setFrom] = useState("#2D4A3E");
  const [to, setTo] = useState("#F5F0E8");
  const [angle, setAngle] = useState(135);
  const [opacity, setOpacity] = useState(Math.round((parseFloat(read("opacity")) || 1) * 100));

  const applyGradient = (a: number, f: string, t: string) => {
    apply({
      backgroundImage: `linear-gradient(${a}deg, ${f} 0%, ${t} 100%)`,
      backgroundColor: "transparent",
    });
  };

  return (
    <>
      <PropGroup label="Fill type">
        <div className="flex p-1 rounded-md bg-background border border-border">
          {(["solid", "gradient"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setType(t);
                if (t === "solid") apply({ backgroundImage: "none", backgroundColor: solid });
                else applyGradient(angle, from, to);
              }}
              className={cn(
                "flex-1 h-7 rounded text-[11px] font-ui capitalize transition-colors",
                type === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </PropGroup>

      {type === "solid" ? (
        <PropGroup label="Color">
          <ColorSwatch
            value={solid}
            onChange={(v) => { setSolid(v); apply({ backgroundColor: v, backgroundImage: "none" }); }}
            brandColors={brandColors}
          />
        </PropGroup>
      ) : (
        <>
          <PropGroup label="From">
            <ColorSwatch
              value={from}
              onChange={(v) => { setFrom(v); applyGradient(angle, v, to); }}
              brandColors={brandColors}
            />
          </PropGroup>
          <PropGroup label="To">
            <ColorSwatch
              value={to}
              onChange={(v) => { setTo(v); applyGradient(angle, from, v); }}
              brandColors={brandColors}
            />
          </PropGroup>
          <PropGroup label={`Angle — ${angle}°`}>
            <Slider
              min={0} max={360} value={angle}
              onChange={(v) => { setAngle(v); applyGradient(v, from, to); }}
            />
          </PropGroup>
        </>
      )}

      <PropGroup label={`Opacity — ${opacity}%`}>
        <Slider
          min={0} max={100} value={opacity}
          onChange={(v) => { setOpacity(v); apply({ opacity: String(v / 100) }); }}
        />
      </PropGroup>
    </>
  );
}

/* ========================================================================== */
/*  Shape / decoration properties                                              */
/* ========================================================================== */

export function ShapeProperties({
  apply,
  read,
  brandColors,
}: {
  apply: ApplyStyle;
  read: ReadStyle;
  brandColors?: string[];
}) {
  const [fill, setFill] = useState(read("backgroundColor") || "#D4A017");
  const [stroke, setStroke] = useState("#D4A017");
  const [strokeWidth, setStrokeWidth] = useState(parseFloat(read("borderWidth")) || 0);
  const [opacity, setOpacity] = useState(Math.round((parseFloat(read("opacity")) || 1) * 100));
  const [rotate, setRotate] = useState(0);

  return (
    <>
      <PropGroup label="Fill">
        <ColorSwatch
          value={fill}
          onChange={(v) => { setFill(v); apply({ backgroundColor: v }); }}
          brandColors={brandColors}
        />
      </PropGroup>

      <PropGroup label="Stroke">
        <div className="space-y-2">
          <ColorSwatch
            value={stroke}
            onChange={(v) => { setStroke(v); apply({ borderColor: v, borderStyle: "solid" }); }}
            brandColors={brandColors}
          />
          <NumberInput
            value={strokeWidth}
            suffix="px"
            onChange={(v) => { setStrokeWidth(v); apply({ borderWidth: v + "px", borderStyle: "solid" }); }}
          />
        </div>
      </PropGroup>

      <PropGroup label={`Opacity — ${opacity}%`}>
        <Slider
          min={0} max={100} value={opacity}
          onChange={(v) => { setOpacity(v); apply({ opacity: String(v / 100) }); }}
        />
      </PropGroup>

      <PropGroup label="Rotate">
        <NumberInput
          value={rotate}
          suffix="°"
          onChange={(v) => { setRotate(v); apply({ transform: `rotate(${v}deg)` }); }}
        />
      </PropGroup>
    </>
  );
}
