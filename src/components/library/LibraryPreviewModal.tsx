import { X } from "lucide-react";
import { type Asset } from "@/services/assetService";

interface Props {
  asset: Asset | null;
  onClose: () => void;
}

const sourceLabel = (m: string) =>
  m === "prostudio" ? "ProStudio" : m === "contentstudio" ? "ContentStudio" : m;

export function LibraryPreviewModal({ asset, onClose }: Props) {
  if (!asset) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
        aria-label="Close"
      >
        <X size={18} />
      </button>
      <div
        className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={asset.file_url}
          alt={asset.name}
          className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
        />
        <div className="mt-4 px-4 py-2 rounded-lg bg-card/90 backdrop-blur-sm border border-border text-center">
          <p className="text-[14px] font-ui font-medium text-foreground">{asset.name}</p>
          <p className="text-[11px] font-ui text-muted-foreground mt-1">
            {asset.width && asset.height ? `${asset.width} × ${asset.height}px · ` : ""}
            {sourceLabel(asset.source_module)} · {new Date(asset.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
