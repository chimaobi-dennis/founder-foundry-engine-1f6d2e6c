import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanvasItem } from "../CanvasSwitcher";

interface PlatformsPanelProps {
  canvases: CanvasItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function PlatformsPanel({ canvases, activeId, onSelect }: PlatformsPanelProps) {
  return (
    <div className="w-[220px] flex-shrink-0 flex flex-col border-r border-border bg-card/30">
      <div className="p-3 border-b border-border">
        <p className="text-[10px] font-ui text-muted-foreground uppercase tracking-wider">
          Platforms
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-0.5">
          {canvases.map((canvas) => {
            const selected = activeId === canvas.id;
            const status = canvas.status || "ready";
            return (
              <button
                key={canvas.id}
                onClick={() => onSelect(canvas.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-[13px] font-ui transition-colors relative",
                  selected
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                {selected && (
                  <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r" />
                )}
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: canvas.platformIcon || "#8A96A3" }}
                />
                <span className="flex-1 truncate">{canvas.label || "Platform"}</span>
                {status === "generating" ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] font-ui text-primary">Generating…</span>
                  </span>
                ) : status === "failed" ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#E05C5C" }} />
                    <span className="text-[10px] font-ui" style={{ color: "#E05C5C" }}>Failed · Retry →</span>
                  </span>
                ) : (
                  <StatusDot status={status} approved={canvas.isApproved} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status, approved }: { status: string; approved?: boolean }) {
  if (approved) return <Check size={12} className="text-emerald-500" />;
  if (status === "generating")
    return <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />;
  if (status === "ready")
    return <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />;
  if (status === "failed")
    return <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#E05C5C" }} />;
  return <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />;
}
