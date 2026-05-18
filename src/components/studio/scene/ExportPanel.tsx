import { useState, useCallback } from "react";
import {
  Download, Image as ImageIcon, FileText, FileCode,
  Monitor, Loader2, Check, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useSceneStore } from "./sceneStore";
import {
  exportScene,
  downloadExport,
  type ExportFormat,
  type ExportResult,
} from "@/lib/scene/sceneExportManager";

// ─── Format Config ──────────────────────────────────────────

const FORMATS: Array<{
  format: ExportFormat;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  { format: "png", label: "PNG", icon: <ImageIcon className="h-4 w-4" />, description: "Lossless, transparent" },
  { format: "jpeg", label: "JPEG", icon: <ImageIcon className="h-4 w-4" />, description: "Smaller file, no transparency" },
  { format: "svg", label: "SVG", icon: <FileCode className="h-4 w-4" />, description: "Vector, scalable" },
  { format: "pdf", label: "PDF", icon: <FileText className="h-4 w-4" />, description: "Print-ready" },
];

const SCALES = [
  { label: "1x", value: 1 },
  { label: "2x (Retina)", value: 2 },
  { label: "3x", value: 3 },
];

// ─── Component ───────────────────────────────────────────────

export function ExportPanel() {
  const { document: scene } = useSceneStore();
  const [format, setFormat] = useState<ExportFormat>("png");
  const [scale, setScale] = useState(2);
  const [quality, setQuality] = useState(0.92);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<ExportResult | null>(null);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setProgress(0);
    setLastResult(null);

    const result = await exportScene(
      {
        id: `export_${Date.now().toString(36)}`,
        scene,
        format,
        pixelRatio: scale,
        quality,
        fileName: `scene_${scene.width}x${scene.height}`,
      },
      (_current, _total, status) => {
        switch (status) {
          case "preloading": setProgress(20); break;
          case "rendering": setProgress(50); break;
          case "encoding": setProgress(80); break;
          case "complete": setProgress(100); break;
          case "error": setProgress(0); break;
        }
      }
    );

    setLastResult(result);
    setIsExporting(false);

    if (result.success) {
      downloadExport(result);
    }
  }, [scene, format, scale, quality]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Download className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground/90 uppercase tracking-wider">
          Export
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Format */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Format</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {FORMATS.map((f) => (
              <button
                key={f.format}
                onClick={() => setFormat(f.format)}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 rounded-md border text-xs transition-colors",
                  format === f.format
                    ? "border-primary/40 bg-primary/5 text-foreground"
                    : "border-border bg-card hover:bg-muted/50 text-muted-foreground"
                )}
              >
                <span className={format === f.format ? "text-primary" : ""}>{f.icon}</span>
                <div className="text-left">
                  <div className="font-medium">{f.label}</div>
                  <div className="text-[9px] text-muted-foreground">{f.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Scale (raster only) */}
        {(format === "png" || format === "jpeg") && (
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Scale</Label>
            <div className="flex gap-1.5">
              {SCALES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setScale(s.value)}
                  className={cn(
                    "flex-1 text-xs py-1.5 rounded-md border transition-colors",
                    scale === s.value
                      ? "border-primary/40 bg-primary/5 text-foreground font-medium"
                      : "border-border bg-card hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Output</Label>
          <div className="rounded-md border border-border bg-muted/30 p-3 text-center space-y-1">
            <Monitor className="h-5 w-5 mx-auto text-muted-foreground/50" />
            <p className="text-xs font-medium text-foreground/80">
              {scene.width * scale} × {scene.height * scale}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {format.toUpperCase()} · {scale}x · {format === "jpeg" ? `${Math.round(quality * 100)}% quality` : "lossless"}
            </p>
          </div>
        </div>
      </div>

      {/* Export button */}
      <div className="px-3 py-3 border-t border-border space-y-2">
        {isExporting && (
          <Progress value={progress} className="h-1" />
        )}

        {lastResult && !isExporting && (
          <div className={cn(
            "text-[10px] flex items-center gap-1",
            lastResult.success ? "text-emerald-600" : "text-destructive"
          )}>
            {lastResult.success ? (
              <>
                <Check className="h-3 w-3" />
                Exported in {lastResult.durationMs}ms
              </>
            ) : (
              <>Export failed: {lastResult.error}</>
            )}
          </div>
        )}

        <Button
          className="w-full h-8 text-xs"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-3 w-3 mr-1.5" />
              Export {format.toUpperCase()}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
