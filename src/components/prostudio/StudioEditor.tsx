import { useState, useRef, useEffect, useMemo } from "react";
import {
  X,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  Save,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Type,
  Image as ImageIcon,
  Square,
  Layers as LayersIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  MousePointer2,
  Hand,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Layer {
  id: string;
  name: string;
  type: "background" | "image" | "text" | "shape";
  visible: boolean;
  locked: boolean;
  icon: typeof Type;
}

interface Props {
  open: boolean;
  onClose: () => void;
  templateName: string;
  variationHtml: string | null;
  variationId: string;
  onDownload?: () => void;
  onSaveToLibrary?: () => void;
}

// Mock layers for the shell — would be parsed from generated HTML in a follow-up
const buildMockLayers = (): Layer[] => [
  { id: "l-bg", name: "Background", type: "background", visible: true, locked: false, icon: Square },
  { id: "l-overlay", name: "Gradient overlay", type: "shape", visible: true, locked: false, icon: Square },
  { id: "l-product", name: "Product image", type: "image", visible: true, locked: false, icon: ImageIcon },
  { id: "l-headline", name: "Headline", type: "text", visible: true, locked: false, icon: Type },
  { id: "l-tagline", name: "Tagline", type: "text", visible: true, locked: false, icon: Type },
  { id: "l-logo", name: "Brand mark", type: "image", visible: true, locked: true, icon: ImageIcon },
];

export function StudioEditor({
  open,
  onClose,
  templateName,
  variationHtml,
  variationId,
  onDownload,
  onSaveToLibrary,
}: Props) {
  const [layers, setLayers] = useState<Layer[]>(buildMockLayers());
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("l-headline");
  const [zoom, setZoom] = useState(0.7);
  const [tool, setTool] = useState<"select" | "hand">("select");
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Restore mock layers when reopened on a different variation
  useEffect(() => {
    if (open) {
      setLayers(buildMockLayers());
      setSelectedLayerId("l-headline");
      setZoom(0.7);
    }
  }, [open, variationId]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "v") setTool("select");
      if (e.key === "h") setTool("hand");
      if ((e.key === "=" || e.key === "+") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setZoom(z => Math.min(2, z + 0.1));
      }
      if (e.key === "-" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setZoom(z => Math.max(0.2, z - 0.1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const selectedLayer = useMemo(
    () => layers.find(l => l.id === selectedLayerId) || null,
    [layers, selectedLayerId],
  );

  const toggleVisibility = (id: string) => {
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, visible: !l.visible } : l)));
  };
  const toggleLock = (id: string) => {
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, locked: !l.locked } : l)));
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ backgroundColor: "#0D1B2A", color: "#F5F0E8" }}
    >
      {/* Top toolbar */}
      <div
        className="h-12 flex items-center justify-between px-3 border-b flex-shrink-0"
        style={{ backgroundColor: "#1A2A3A", borderColor: "#2A3A4A" }}
      >
        <div className="flex items-center gap-1.5">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-white/5"
            title="Close studio"
          >
            <X size={16} />
          </button>
          <div className="w-px h-5 mx-1" style={{ backgroundColor: "#2A3A4A" }} />
          <div className="flex items-center gap-2 px-2">
            <div
              className="w-5 h-5 rounded-sm flex items-center justify-center"
              style={{ backgroundColor: "#D4A017" }}
            >
              <LayersIcon size={11} style={{ color: "#0D1B2A" }} />
            </div>
            <span className="text-[12px] font-ui font-medium" style={{ color: "#F5F0E8" }}>
              {templateName}
            </span>
            <span className="text-[11px] font-ui" style={{ color: "#8A96A3" }}>
              · Studio
            </span>
          </div>
        </div>

        {/* Centre: tool group */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton title="Undo (⌘Z)">
            <Undo2 size={15} />
          </ToolbarButton>
          <ToolbarButton title="Redo (⌘⇧Z)">
            <Redo2 size={15} />
          </ToolbarButton>
          <div className="w-px h-5 mx-1.5" style={{ backgroundColor: "#2A3A4A" }} />
          <ToolbarButton title="Zoom out" onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}>
            <ZoomOut size={15} />
          </ToolbarButton>
          <button
            className="h-8 px-2.5 text-[11px] font-ui rounded-md transition-colors hover:bg-white/5 tabular-nums"
            style={{ color: "#F5F0E8", minWidth: 56 }}
            onClick={() => setZoom(0.7)}
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ToolbarButton title="Zoom in" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
            <ZoomIn size={15} />
          </ToolbarButton>
          <div className="w-px h-5 mx-1.5" style={{ backgroundColor: "#2A3A4A" }} />
          <div
            className="h-8 px-3 flex items-center text-[11px] font-ui rounded-md tabular-nums"
            style={{ color: "#8A96A3", backgroundColor: "rgba(255,255,255,0.03)" }}
          >
            600 × 600 px
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onDownload}
            className="h-8 px-3 rounded-md text-[12px] font-ui font-medium flex items-center gap-1.5 transition-colors hover:bg-white/5"
            style={{ color: "#F5F0E8", border: "1px solid #2A3A4A" }}
          >
            <Download size={13} /> Export
          </button>
          <button
            onClick={onSaveToLibrary}
            className="h-8 px-3.5 rounded-md text-[12px] font-ui font-semibold flex items-center gap-1.5 transition-all hover:opacity-90"
            style={{ backgroundColor: "#D4A017", color: "#0D1B2A" }}
          >
            <Save size={13} /> Save to Library
          </button>
        </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 flex min-h-0">
        {/* Left: layers panel */}
        <div
          className="w-[240px] flex-shrink-0 flex flex-col border-r"
          style={{ backgroundColor: "#1A2A3A", borderColor: "#2A3A4A" }}
        >
          <div
            className="h-9 flex items-center justify-between px-3 border-b flex-shrink-0"
            style={{ borderColor: "#2A3A4A" }}
          >
            <span
              className="text-[10px] font-ui font-semibold uppercase tracking-[0.08em]"
              style={{ color: "#8A96A3" }}
            >
              Layers
            </span>
            <span className="text-[10px] font-ui tabular-nums" style={{ color: "#8A96A3" }}>
              {layers.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {layers.map(layer => {
              const Icon = layer.icon;
              const selected = selectedLayerId === layer.id;
              return (
                <div
                  key={layer.id}
                  onClick={() => setSelectedLayerId(layer.id)}
                  className={cn(
                    "group flex items-center gap-2 mx-1.5 my-0.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                  )}
                  style={{
                    backgroundColor: selected ? "rgba(212, 160, 23, 0.12)" : "transparent",
                    borderLeft: selected ? "2px solid #D4A017" : "2px solid transparent",
                  }}
                  onMouseEnter={e => {
                    if (!selected)
                      (e.currentTarget as HTMLDivElement).style.backgroundColor =
                        "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={e => {
                    if (!selected) (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
                  }}
                >
                  <Icon
                    size={13}
                    style={{ color: selected ? "#D4A017" : "#8A96A3", flexShrink: 0 }}
                  />
                  <span
                    className="text-[12px] font-ui flex-1 truncate"
                    style={{
                      color: selected ? "#F5F0E8" : layer.visible ? "#F5F0E8" : "#8A96A3",
                      opacity: layer.visible ? 1 : 0.5,
                    }}
                  >
                    {layer.name}
                  </span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      toggleVisibility(layer.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                    style={{ color: "#8A96A3" }}
                    title={layer.visible ? "Hide" : "Show"}
                  >
                    {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      toggleLock(layer.id);
                    }}
                    className={cn(
                      "transition-opacity p-0.5",
                      layer.locked ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    )}
                    style={{ color: layer.locked ? "#D4A017" : "#8A96A3" }}
                    title={layer.locked ? "Unlock" : "Lock"}
                  >
                    {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
                  </button>
                </div>
              );
            })}
          </div>
          <div
            className="px-3 py-2 border-t flex items-center justify-between"
            style={{ borderColor: "#2A3A4A" }}
          >
            <span className="text-[10px] font-ui" style={{ color: "#8A96A3" }}>
              Auto-detected
            </span>
            <span
              className="text-[10px] font-ui px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "rgba(212,160,23,0.1)", color: "#D4A017" }}
            >
              Beta
            </span>
          </div>
        </div>

        {/* Centre: canvas */}
        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
            backgroundSize: "22px 22px",
            backgroundColor: "#0D1B2A",
          }}
        >
          {/* Floating tool dock */}
          <div className="absolute left-[256px] top-[64px] flex flex-col gap-1 p-1 rounded-lg z-10"
            style={{ backgroundColor: "#1A2A3A", border: "1px solid #2A3A4A" }}>
            <ToolButton active={tool === "select"} onClick={() => setTool("select")} title="Select (V)">
              <MousePointer2 size={14} />
            </ToolButton>
            <ToolButton active={tool === "hand"} onClick={() => setTool("hand")} title="Pan (H)">
              <Hand size={14} />
            </ToolButton>
          </div>

          <div
            ref={canvasContainerRef}
            className="flex-1 overflow-auto flex items-center justify-center p-8"
          >
            <div
              className="relative"
              style={{
                width: 600 * zoom,
                height: 600 * zoom,
              }}
            >
              {/* Canvas frame shadow */}
              <div
                className="absolute inset-0 rounded-sm"
                style={{
                  boxShadow:
                    "0 30px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(212, 160, 23, 0.15)",
                }}
              />
              {/* Canvas content */}
              <div
                className="overflow-hidden rounded-sm relative"
                style={{
                  width: 600 * zoom,
                  height: 600 * zoom,
                  backgroundColor: "#FFFFFF",
                }}
              >
                {variationHtml ? (
                  <div
                    style={{
                      width: 600,
                      height: 600,
                      transform: `scale(${zoom})`,
                      transformOrigin: "top left",
                    }}
                    dangerouslySetInnerHTML={{ __html: variationHtml }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#1A2A3A" }}>
                    <span className="text-[12px] font-ui" style={{ color: "#8A96A3" }}>
                      No design loaded
                    </span>
                  </div>
                )}

                {/* Selection bounding box (mock — sits over text area top-centre) */}
                {selectedLayer && selectedLayer.id === "l-headline" && (
                  <SelectionBox zoom={zoom} top={60} left={60} width={480} height={90} />
                )}
                {selectedLayer && selectedLayer.id === "l-tagline" && (
                  <SelectionBox zoom={zoom} top={170} left={60} width={420} height={50} />
                )}
                {selectedLayer && selectedLayer.id === "l-product" && (
                  <SelectionBox zoom={zoom} top={250} left={210} width={180} height={240} />
                )}
                {selectedLayer && selectedLayer.id === "l-bg" && (
                  <SelectionBox zoom={zoom} top={2} left={2} width={596} height={596} dashed />
                )}
              </div>
            </div>
          </div>

          {/* Bottom status bar */}
          <div
            className="h-7 flex items-center justify-between px-3 border-t text-[10px] font-ui flex-shrink-0"
            style={{ backgroundColor: "#1A2A3A", borderColor: "#2A3A4A", color: "#8A96A3" }}
          >
            <div className="flex items-center gap-3">
              <span>
                Tool: <span style={{ color: "#F5F0E8" }}>{tool === "select" ? "Select" : "Pan"}</span>
              </span>
              {selectedLayer && (
                <span>
                  Selected: <span style={{ color: "#F5F0E8" }}>{selectedLayer.name}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 tabular-nums">
              <span>x: 0 y: 0</span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Right: properties panel */}
        <div
          className="w-[260px] flex-shrink-0 flex flex-col border-l"
          style={{ backgroundColor: "#1A2A3A", borderColor: "#2A3A4A" }}
        >
          <div
            className="h-9 flex items-center justify-between px-3 border-b flex-shrink-0"
            style={{ borderColor: "#2A3A4A" }}
          >
            <span
              className="text-[10px] font-ui font-semibold uppercase tracking-[0.08em]"
              style={{ color: "#8A96A3" }}
            >
              Properties
            </span>
            {selectedLayer && (
              <span className="text-[10px] font-ui truncate max-w-[120px]" style={{ color: "#F5F0E8" }}>
                {selectedLayer.name}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {!selectedLayer ? (
              <div className="text-center py-10">
                <Maximize2 size={20} className="mx-auto mb-2" style={{ color: "#8A96A3", opacity: 0.5 }} />
                <p className="text-[11px] font-ui" style={{ color: "#8A96A3" }}>
                  Select a layer to edit its properties
                </p>
              </div>
            ) : selectedLayer.type === "text" ? (
              <TextProperties />
            ) : selectedLayer.type === "image" ? (
              <ImageProperties />
            ) : (
              <BackgroundProperties />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== UI bits ============================== */

function ToolbarButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-white/5"
      style={{ color: "#F5F0E8" }}
    >
      {children}
    </button>
  );
}

function ToolButton({
  children,
  title,
  active,
  onClick,
}: {
  children: React.ReactNode;
  title?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
      style={{
        backgroundColor: active ? "rgba(212, 160, 23, 0.18)" : "transparent",
        color: active ? "#D4A017" : "#F5F0E8",
      }}
    >
      {children}
    </button>
  );
}

function SelectionBox({
  zoom,
  top,
  left,
  width,
  height,
  dashed,
}: {
  zoom: number;
  top: number;
  left: number;
  width: number;
  height: number;
  dashed?: boolean;
}) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: top * zoom,
        left: left * zoom,
        width: width * zoom,
        height: height * zoom,
        border: `1.5px ${dashed ? "dashed" : "solid"} #D4A017`,
        boxShadow: "0 0 0 1px rgba(13, 27, 42, 0.4)",
      }}
    >
      {!dashed &&
        ["tl", "tr", "bl", "br"].map(pos => (
          <div
            key={pos}
            className="absolute w-2 h-2 rounded-[1px]"
            style={{
              backgroundColor: "#D4A017",
              border: "1px solid #0D1B2A",
              top: pos.startsWith("t") ? -4 : "auto",
              bottom: pos.startsWith("b") ? -4 : "auto",
              left: pos.endsWith("l") ? -4 : "auto",
              right: pos.endsWith("r") ? -4 : "auto",
            }}
          />
        ))}
    </div>
  );
}

/* ============================ Property panels ============================ */

function PropGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="text-[9px] font-ui font-semibold uppercase tracking-[0.1em] mb-2"
        style={{ color: "#8A96A3" }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function PropInput({
  value,
  suffix,
  onChange,
}: {
  value: string;
  suffix?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div
      className="flex items-center h-8 rounded-md px-2.5 text-[12px] font-ui"
      style={{
        backgroundColor: "#0D1B2A",
        border: "1px solid #2A3A4A",
        color: "#F5F0E8",
      }}
    >
      <input
        value={value}
        onChange={e => onChange?.(e.target.value)}
        className="flex-1 bg-transparent outline-none min-w-0"
      />
      {suffix && <span style={{ color: "#8A96A3" }}>{suffix}</span>}
    </div>
  );
}

function ColorRow({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-7 h-7 rounded-md flex-shrink-0"
        style={{
          backgroundColor: color,
          border: "1px solid #2A3A4A",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      />
      <div className="flex-1">
        <PropInput value={color} />
      </div>
    </div>
  );
}

function TextProperties() {
  const [font, setFont] = useState("Playfair Display");
  const [size, setSize] = useState("48");
  const [weight, setWeight] = useState("600");
  const [align, setAlign] = useState<"left" | "center" | "right">("left");

  return (
    <>
      <PropGroup label="Typography">
        <div className="space-y-2">
          <PropInput value={font} onChange={setFont} />
          <div className="grid grid-cols-2 gap-2">
            <PropInput value={size} suffix="px" onChange={setSize} />
            <PropInput value={weight} onChange={setWeight} />
          </div>
        </div>
      </PropGroup>

      <PropGroup label="Alignment">
        <div className="flex gap-1 p-1 rounded-md" style={{ backgroundColor: "#0D1B2A", border: "1px solid #2A3A4A" }}>
          {[
            { id: "left" as const, icon: AlignLeft },
            { id: "center" as const, icon: AlignCenter },
            { id: "right" as const, icon: AlignRight },
          ].map(({ id, icon: I }) => (
            <button
              key={id}
              onClick={() => setAlign(id)}
              className="flex-1 h-7 rounded flex items-center justify-center transition-colors"
              style={{
                backgroundColor: align === id ? "rgba(212,160,23,0.15)" : "transparent",
                color: align === id ? "#D4A017" : "#8A96A3",
              }}
            >
              <I size={13} />
            </button>
          ))}
        </div>
      </PropGroup>

      <PropGroup label="Style">
        <div className="flex gap-1.5">
          <button
            className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
            style={{ backgroundColor: "#0D1B2A", border: "1px solid #2A3A4A", color: "#F5F0E8" }}
          >
            <Bold size={13} />
          </button>
          <button
            className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
            style={{ backgroundColor: "#0D1B2A", border: "1px solid #2A3A4A", color: "#F5F0E8" }}
          >
            <Italic size={13} />
          </button>
        </div>
      </PropGroup>

      <PropGroup label="Color">
        <ColorRow label="Fill" color="#0D1B2A" />
      </PropGroup>

      <PropGroup label="Letter spacing">
        <PropInput value="0" suffix="px" />
      </PropGroup>
    </>
  );
}

function ImageProperties() {
  const [opacity, setOpacity] = useState(100);
  const [scale, setScale] = useState(100);

  return (
    <>
      <PropGroup label="Position">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-ui mb-1" style={{ color: "#8A96A3" }}>X</p>
            <PropInput value="210" suffix="px" />
          </div>
          <div>
            <p className="text-[10px] font-ui mb-1" style={{ color: "#8A96A3" }}>Y</p>
            <PropInput value="250" suffix="px" />
          </div>
        </div>
      </PropGroup>

      <PropGroup label="Dimensions">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-ui mb-1" style={{ color: "#8A96A3" }}>W</p>
            <PropInput value="180" suffix="px" />
          </div>
          <div>
            <p className="text-[10px] font-ui mb-1" style={{ color: "#8A96A3" }}>H</p>
            <PropInput value="240" suffix="px" />
          </div>
        </div>
      </PropGroup>

      <PropGroup label={`Opacity — ${opacity}%`}>
        <input
          type="range"
          min={0}
          max={100}
          value={opacity}
          onChange={e => setOpacity(Number(e.target.value))}
          className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
          style={{ accentColor: "#D4A017", backgroundColor: "#0D1B2A" }}
        />
      </PropGroup>

      <PropGroup label={`Scale — ${scale}%`}>
        <input
          type="range"
          min={20}
          max={200}
          value={scale}
          onChange={e => setScale(Number(e.target.value))}
          className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
          style={{ accentColor: "#D4A017", backgroundColor: "#0D1B2A" }}
        />
      </PropGroup>

      <PropGroup label="Effects">
        <div className="space-y-2">
          <div
            className="flex items-center justify-between h-8 px-2.5 rounded-md text-[12px] font-ui"
            style={{ backgroundColor: "#0D1B2A", border: "1px solid #2A3A4A", color: "#F5F0E8" }}
          >
            <span>Drop shadow</span>
            <div
              className="w-7 h-4 rounded-full relative"
              style={{ backgroundColor: "#D4A017" }}
            >
              <div className="absolute right-0.5 top-0.5 w-3 h-3 rounded-full bg-white" />
            </div>
          </div>
        </div>
      </PropGroup>
    </>
  );
}

function BackgroundProperties() {
  const [type, setType] = useState<"solid" | "gradient">("solid");

  return (
    <>
      <PropGroup label="Fill type">
        <div
          className="flex p-1 rounded-md"
          style={{ backgroundColor: "#0D1B2A", border: "1px solid #2A3A4A" }}
        >
          {(["solid", "gradient"] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="flex-1 h-7 rounded text-[11px] font-ui capitalize transition-colors"
              style={{
                backgroundColor: type === t ? "rgba(212,160,23,0.15)" : "transparent",
                color: type === t ? "#D4A017" : "#8A96A3",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </PropGroup>

      {type === "solid" ? (
        <PropGroup label="Color">
          <ColorRow label="Fill" color="#F5F0E8" />
        </PropGroup>
      ) : (
        <>
          <PropGroup label="Gradient stops">
            <div className="space-y-2">
              <ColorRow label="From" color="#2D4A3E" />
              <ColorRow label="To" color="#F5F0E8" />
            </div>
          </PropGroup>
          <PropGroup label="Angle">
            <PropInput value="135" suffix="°" />
          </PropGroup>
        </>
      )}

      <PropGroup label="Dimensions">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-ui mb-1" style={{ color: "#8A96A3" }}>W</p>
            <PropInput value="600" suffix="px" />
          </div>
          <div>
            <p className="text-[10px] font-ui mb-1" style={{ color: "#8A96A3" }}>H</p>
            <PropInput value="600" suffix="px" />
          </div>
        </div>
      </PropGroup>
    </>
  );
}
