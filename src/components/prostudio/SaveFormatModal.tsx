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
}

const FORMATS: { value: SaveFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "pdf", label: "PDF" },
];

export function SaveFormatModal({ open, onOpenChange, onConfirm, saving }: Props) {
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
