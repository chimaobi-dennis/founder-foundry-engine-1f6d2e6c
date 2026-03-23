import { X, Trash2 } from "lucide-react";
import { type LibraryAsset } from "./data";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  asset: LibraryAsset | null;
  onClose: () => void;
}

export function LibraryDetailPanel({ asset, onClose }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!asset) return null;

  const details = [
    { label: "Created", value: asset.dateLabel },
    { label: "Source", value: `${asset.source}${asset.templateName ? ` — ${asset.templateName} template` : ""}` },
    { label: "Format", value: asset.format || "—" },
    { label: "Dimensions", value: asset.dimensions || "—" },
    ...(asset.platform ? [{ label: "Platform", value: asset.platform }] : []),
    { label: "File size", value: asset.fileSize || "—" },
  ];

  return (
    <div className="fixed top-0 right-0 h-full w-[300px] bg-background border-l border-border z-30 flex flex-col overflow-y-auto animate-in slide-in-from-right duration-200">
      {/* Close */}
      <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors z-10">
        <X size={16} />
      </button>

      {/* Preview */}
      <div className="w-full h-[200px] flex-shrink-0" style={{ backgroundColor: asset.color }} />

      <div className="px-4 pb-6 flex-1 flex flex-col">
        <p className="text-[15px] font-ui font-medium text-foreground mt-4">{asset.name}</p>
        <p className="text-[12px] font-ui text-muted-foreground mt-1">
          {asset.type === "document" ? asset.docType : asset.type === "script" ? "Script" : "Image"} · {asset.source}
        </p>

        <div className="border-t border-border my-4" />

        {/* Details */}
        <div className="space-y-2.5">
          {details.map((d) => (
            <div key={d.label} className="flex items-start justify-between">
              <span className="text-[11px] font-ui text-muted-foreground">{d.label}</span>
              <span className="text-[12px] font-ui text-foreground text-right max-w-[160px]">{d.value}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-border my-4" />

        {/* Used in */}
        <p className="text-[10px] uppercase tracking-wider font-ui text-muted-foreground mb-2">Used in</p>
        <p className="text-[12px] font-ui text-muted-foreground italic">Not used in any campaign yet</p>

        {/* Actions */}
        <div className="mt-auto pt-6 space-y-2">
          <Button className="w-full h-10 rounded-lg text-[13px]">Add to campaign</Button>
          <Button variant="outline" className="w-full h-10 rounded-lg text-[13px]">Schedule post</Button>
          <Button variant="outline" className="w-full h-10 rounded-lg text-[13px]">Download</Button>

          <div className="relative flex justify-center pt-3">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-ui text-destructive">Delete this asset?</span>
                <button onClick={() => { setConfirmDelete(false); onClose(); }} className="text-[11px] font-ui text-destructive font-medium hover:underline">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-[11px] font-ui text-muted-foreground hover:underline">No</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-[12px] font-ui text-muted-foreground hover:text-destructive transition-colors inline-flex items-center gap-1.5"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
