import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Pill } from "./shared/Pill";
import { StudioButton } from "./shared/StudioButton";
import type { SaveFormat } from "./SaveFormatModal";

export interface ExportPlatform {
  id: string;
  name: string;
  width: number;
  height: number;
  color?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platforms: ExportPlatform[];
  onConfirm: (selectedIds: string[], format: SaveFormat) => void;
  exporting?: boolean;
  /** Per-platform progress 0..1 while exporting */
  progress?: Record<string, number>;
  /** ProStudio variant mode: ask current vs all */
  variantMode?: boolean;
}

const FORMATS: { value: SaveFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "pdf", label: "PDF" },
];

export function ExportModal({
  open,
  onOpenChange,
  platforms,
  onConfirm,
  exporting,
  progress,
  variantMode,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<SaveFormat>("png");

  useEffect(() => {
    if (open) setSelected(new Set(platforms.map((p) => p.id)));
  }, [open, platforms]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const selectedIds = platforms.filter((p) => selected.has(p.id)).map((p) => p.id);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="z-[120] max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Export</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="max-h-[300px] overflow-y-auto -mx-1 px-1 space-y-1.5">
          {platforms.map((p) => {
            const pct = progress?.[p.id];
            return (
              <label
                key={p.id}
                className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggle(p.id)}
                  disabled={exporting}
                />
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: p.color || "#8A96A3" }}
                />
                <span className="flex-1 text-[13px] font-ui text-foreground truncate">
                  {variantMode ? p.name : p.name}
                </span>
                <span className="text-[11px] font-ui text-muted-foreground tabular-nums">
                  {p.width} × {p.height} px
                </span>
                {pct !== undefined && (
                  <span className="text-[10px] font-ui text-primary tabular-nums w-8 text-right">
                    {Math.round(pct * 100)}%
                  </span>
                )}
              </label>
            );
          })}
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-ui mb-2">
            Format
          </p>
          <div className="flex gap-2">
            {FORMATS.map((f) => (
              <Pill
                key={f.value}
                selected={format === f.value}
                onClick={() => setFormat(f.value)}
                disabled={exporting}
              >
                {f.label}
              </Pill>
            ))}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={exporting}>Cancel</AlertDialogCancel>
          <StudioButton
            size="md"
            loading={exporting}
            disabled={selectedIds.length === 0}
            onClick={() => onConfirm(selectedIds, format)}
          >
            Export selected
          </StudioButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
