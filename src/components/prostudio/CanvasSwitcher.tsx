// CanvasSwitcher — used by ProStudio (image variants), ReelBuilder (scenes),
// and future slide/document editors. A universal bottom strip that lets users
// switch between, add, duplicate, reorder, and delete canvases of any kind.

import { useRef, useState } from "react";
import { Check, Plus, MoreHorizontal, Copy, Trash2, Star, FileText, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface CanvasItem {
  id: string;
  /** Optional rendered HTML preview (ProStudio variants).
   *  When omitted, the thumbnail shows a blank-page placeholder. */
  html?: string | null;
  /** Optional image URL preview (e.g. ReelBuilder scene poster) */
  thumbnailUrl?: string | null;
  // Content Studio specific fields
  /** Platform name (e.g. "Instagram", "Email") - shown in content-studio mode */
  label?: string;
  /** Platform icon (emoji or component) - shown in content-studio mode */
  platformIcon?: string;
  /** Platform slug (e.g. "instagram", "email") */
  platformSlug?: string;
  /** Copy text for the platform */
  copyText?: string | null;
  /** Headline for the platform */
  headline?: string | null;
  /** Hashtags array (social platforms only) */
  hashtags?: string[] | null;
  /** Subject line (email only) */
  subjectLine?: string | null;
  /** Character limit for the platform */
  characterLimit?: number | null;
  /** Canvas width in pixels */
  canvasWidth?: number;
  /** Canvas height in pixels */
  canvasHeight?: number;
  /** Status: ready, generating, failed, scheduled */
  status?: string;
  /** Whether the creative is approved */
  isApproved?: boolean;
}

interface Props {
  canvases: CanvasItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAddBlank?: () => void;
  onAddFromTemplate?: () => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSetMain?: (id: string) => void;
  /** Hide the + button when host doesn't support adding (rare). */
  canAdd?: boolean;
  /** Custom background color for the switcher strip */
  backgroundColor?: string;
}

export function CanvasSwitcher({
  canvases,
  activeId,
  onSelect,
  onAddBlank,
  onAddFromTemplate,
  onDuplicate,
  onDelete,
  onSetMain,
  canAdd = true,
  backgroundColor,
}: Props) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div
      className="h-[100px] flex-shrink-0 border-t border-border flex items-center"
      style={{
        backgroundColor: backgroundColor || "hsl(var(--card))",
      }}
    >
      <div
        ref={stripRef}
        className="flex-1 flex items-center justify-center gap-2 overflow-x-auto px-4 h-full"
        style={{ scrollbarWidth: "thin" }}
      >
        {canvases.map((c, i) => {
          const active = c.id === activeId;
          return (
            <CanvasThumb
              key={c.id}
              index={i + 1}
              active={active}
              canvas={c}
              canDelete={canvases.length > 1}
              onClick={() => onSelect(c.id)}
              onDuplicate={onDuplicate ? () => onDuplicate(c.id) : undefined}
              onDelete={onDelete ? () => onDelete(c.id) : undefined}
              onSetMain={onSetMain ? () => onSetMain(c.id) : undefined}
            />
          );
        })}

        {canAdd && (onAddBlank || onAddFromTemplate) && (
          <Popover open={addOpen} onOpenChange={setAddOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-[80px] h-[60px] rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/60 hover:bg-primary/5 transition-colors flex items-center justify-center flex-shrink-0"
                title="Add canvas"
              >
                <Plus size={18} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="end"
              className="w-[200px] p-1.5"
            >
              {onAddBlank && (
                <button
                  onClick={() => {
                    onAddBlank();
                    setAddOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] font-ui text-foreground hover:bg-muted transition-colors text-left"
                >
                  <FileText size={14} className="text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">Blank page</div>
                    <div className="text-[10.5px] text-muted-foreground">
                      Empty canvas, same size
                    </div>
                  </div>
                </button>
              )}
              {onAddFromTemplate && (
                <button
                  onClick={() => {
                    onAddFromTemplate();
                    setAddOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] font-ui text-foreground hover:bg-muted transition-colors text-left"
                >
                  <LayoutTemplate size={14} className="text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">From template</div>
                    <div className="text-[10.5px] text-muted-foreground">
                      Generate a new variant
                    </div>
                  </div>
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

/* ============================== Thumbnail ============================== */

interface ThumbProps {
  index: number;
  active: boolean;
  canvas: CanvasItem;
  canDelete: boolean;
  onClick: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onSetMain?: () => void;
}

function CanvasThumb({
  index,
  active,
  canvas,
  canDelete,
  onClick,
  onDuplicate,
  onDelete,
  onSetMain,
}: ThumbProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasContent = !!(canvas.html || canvas.thumbnailUrl);

  return (
    <div className="relative group flex-shrink-0">
      <button
        onClick={onClick}
        className={cn(
          "w-[80px] h-[60px] rounded-md overflow-hidden relative bg-white transition-all",
          active
            ? "ring-2 ring-offset-1 ring-offset-card"
            : "border border-border hover:border-foreground/30",
        )}
        style={{
          boxShadow: active
            ? "0 0 0 2px #D4A017"
            : undefined,
          borderColor: active ? "#D4A017" : undefined,
        }}
      >
        {canvas.thumbnailUrl ? (
          <img
            src={canvas.thumbnailUrl}
            alt={`Canvas ${index}`}
            className="w-full h-full object-cover"
          />
        ) : canvas.html ? (
          // Render HTML at small scale (assumes 600x600 design surface)
          <div
            className="w-full h-full"
            style={{
              transform: "scale(0.1333)",
              transformOrigin: "top left",
              width: 600,
              height: 600,
              pointerEvents: "none",
            }}
            dangerouslySetInnerHTML={{ __html: canvas.html }}
          />
        ) : (
          <div className="w-full h-full bg-muted/40 flex items-center justify-center">
            <span className="text-[9px] font-ui text-muted-foreground">
              Blank
            </span>
          </div>
        )}

        {/* Number badge or platform label — bottom-left */}
        <span
          className={cn(
            "absolute bottom-1 left-1 min-w-[16px] h-4 px-1 rounded-[3px] text-[9.5px] font-ui font-semibold tabular-nums flex items-center justify-center",
            active
              ? "bg-[#D4A017] text-[#0D1B2A]"
              : "bg-black/60 text-white backdrop-blur-sm",
          )}
        >
          {canvas.label || index}
        </span>

        {/* Status dot — top-left for content-studio */}
        {(canvas.status || canvas.isApproved !== undefined) && (
          <div className="absolute top-1 left-1">
            <StatusDot status={canvas.status || "ready"} approved={canvas.isApproved} />
          </div>
        )}
      </button>

      {/* Hover menu */}
      {(onDuplicate || onDelete || onSetMain) && (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={e => e.stopPropagation()}
              className={cn(
                "absolute top-1 right-1 w-5 h-5 rounded-[3px] bg-card/90 border border-border flex items-center justify-center transition-opacity backdrop-blur-sm",
                menuOpen
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100",
              )}
              title="More"
            >
              <MoreHorizontal size={11} className="text-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-[160px] p-1">
            {onSetMain && (
              <MenuRow icon={<Star size={12} />} label="Set as main" onClick={() => { onSetMain(); setMenuOpen(false); }} />
            )}
            {onDuplicate && (
              <MenuRow icon={<Copy size={12} />} label="Duplicate" onClick={() => { onDuplicate(); setMenuOpen(false); }} />
            )}
            {onDelete && (
              <MenuRow
                icon={<Trash2 size={12} />}
                label="Delete"
                destructive
                disabled={!canDelete}
                onClick={() => { onDelete(); setMenuOpen(false); }}
              />
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
  destructive,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-[12px] font-ui transition-colors text-left",
        destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatusDot({ status, approved }: { status: string; approved?: boolean }) {
  if (approved) return <Check size={10} className="text-emerald-500" />;
  if (status === "generating")
    return <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />;
  if (status === "ready")
    return <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />;
  if (status === "failed")
    return <span className="w-1.5 h-1.5 rounded-full bg-destructive" />;
  return <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />;
}
