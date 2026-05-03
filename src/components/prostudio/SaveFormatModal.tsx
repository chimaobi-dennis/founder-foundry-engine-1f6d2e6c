import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Pill } from "./shared/Pill";
import { StudioButton } from "./shared/StudioButton";

export type SaveFormat = "png" | "jpeg" | "pdf";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (format: SaveFormat) => void;
  saving?: boolean;
  /** When provided, shows a small note below the format pills explaining
   *  this save will create a new version of the named asset. */
  versionNote?: string | null;
}

const FORMATS: { value: SaveFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "pdf", label: "PDF" },
];

export function SaveFormatModal({ open, onOpenChange, onConfirm, saving, versionNote }: Props) {
  const [format, setFormat] = useState<SaveFormat>("png");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="z-[120] max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Save to Library</AlertDialogTitle>
          <AlertDialogDescription>Choose format</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-2 py-2">
          {FORMATS.map((f) => (
            <Pill key={f.value} selected={format === f.value} onClick={() => setFormat(f.value)}>
              {f.label}
            </Pill>
          ))}
        </div>
        {versionNote ? (
          <p className="text-[12px] text-muted-foreground -mt-1">
            This will be saved as a new version of {versionNote}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <StudioButton size="md" loading={saving} onClick={() => onConfirm(format)}>
            Save
          </StudioButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
