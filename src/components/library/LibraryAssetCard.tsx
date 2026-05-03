import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import {
  type Asset,
  trashAsset,
  getStudioSession,
} from "@/services/assetService";

interface Props {
  asset: Asset;
  onPreview: (asset: Asset) => void;
  onTrashed: (assetId: string) => void;
}

function formatDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(iso).toLocaleDateString();
}

const sourceLabel = (m: string) =>
  m === "prostudio" ? "ProStudio" : m === "contentstudio" ? "ContentStudio" : m;

async function downloadFromUrl(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export function LibraryAssetCard({ asset, onPreview, onTrashed }: Props) {
  const navigate = useNavigate();
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [removing, setRemoving] = useState(false);

  const hasSession = !!asset.has_studio_session;

  const handleOpenStudio = async () => {
    if (!hasSession) return;
    const session = await getStudioSession(asset.id);
    if (!session) {
      toast.error("Could not load studio session");
      return;
    }
    if (session.source_module === "contentstudio" && session.brief_id) {
      navigate(`/content-studio/${session.brief_id}`);
    } else {
      navigate(`/pro-studio/editor?asset=${asset.id}`);
    }
  };

  const handleDownload = async (format: "png" | "jpeg" | "pdf") => {
    setDownloadOpen(false);
    try {
      const baseName = (asset.name || "asset").replace(/\s+/g, "-");
      if (format === "pdf") {
        // Render asset image into PDF
        const w = asset.width || 1080;
        const h = asset.height || 1080;
        const pdf = new jsPDF({
          orientation: w >= h ? "l" : "p",
          unit: "px",
          format: [w, h],
        });
        // Convert image url to data url
        const res = await fetch(asset.file_url);
        const blob = await res.blob();
        const dataUrl: string = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(blob);
        });
        pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
        pdf.save(`${baseName}.pdf`);
      } else {
        const ext = format === "jpeg" ? "jpg" : "png";
        await downloadFromUrl(asset.file_url, `${baseName}.${ext}`);
      }
    } catch (e: any) {
      toast.error("Download failed");
    }
  };

  const handleConfirmTrash = async () => {
    setConfirmTrash(false);
    setRemoving(true);
    try {
      await trashAsset(asset.id);
      // Allow fade animation before removal
      setTimeout(() => onTrashed(asset.id), 250);
    } catch {
      setRemoving(false);
      toast.error("Could not move to trash");
    }
  };

  return (
    <div
      className={`group relative rounded-[10px] overflow-hidden border border-border bg-card transition-all duration-200 ${
        removing ? "opacity-0 scale-95" : "opacity-100"
      }`}
    >
      <div className="relative aspect-square bg-muted/30">
        {asset.file_url ? (
          <img
            src={asset.file_url}
            alt={asset.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[11px] text-muted-foreground font-ui">
            No preview
          </div>
        )}

        {/* Hover overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: "rgba(13,27,42,0.75)" }}
        >
          <ActionBtn label="Preview" onClick={() => onPreview(asset)}>
            <Eye size={16} />
          </ActionBtn>
          <ActionBtn
            label={hasSession ? "Open in Studio" : "No studio session"}
            onClick={handleOpenStudio}
            disabled={!hasSession}
            amber={hasSession}
          >
            <Pencil size={16} />
          </ActionBtn>

          {/* Download with popover */}
          <div className="relative">
            <ActionBtn
              label="Download"
              onClick={() => setDownloadOpen((v) => !v)}
            >
              <Download size={16} />
            </ActionBtn>
            {downloadOpen && (
              <div
                className="absolute top-12 left-1/2 -translate-x-1/2 z-20 rounded-lg border border-border bg-popover p-1.5 shadow-lg flex gap-1"
                onMouseLeave={() => setDownloadOpen(false)}
              >
                {(["png", "jpeg", "pdf"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => handleDownload(f)}
                    className="px-2.5 py-1 text-[11px] font-ui rounded-md border border-border text-foreground hover:bg-primary hover:text-primary-foreground transition-colors uppercase"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Trash with confirm popover */}
          <div className="relative">
            <ActionBtn
              label="Send to trash"
              onClick={() => setConfirmTrash((v) => !v)}
            >
              <Trash2 size={16} />
            </ActionBtn>
            {confirmTrash && (
              <div
                className="absolute top-12 left-1/2 -translate-x-1/2 z-20 w-[220px] rounded-lg border border-border bg-popover p-3 shadow-lg"
                onMouseLeave={() => setConfirmTrash(false)}
              >
                <p className="text-[11px] font-ui text-foreground mb-2">
                  Move to trash? This won't delete the file immediately.
                </p>
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => setConfirmTrash(false)}
                    className="px-2 py-1 text-[11px] font-ui rounded-md text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmTrash}
                    className="px-2 py-1 text-[11px] font-ui rounded-md bg-destructive text-destructive-foreground"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 py-2.5">
        <p className="text-[12px] font-ui font-medium text-foreground truncate">
          {asset.name}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] font-ui px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
            {sourceLabel(asset.source_module)}
          </span>
          <span className="text-[10px] font-ui text-muted-foreground">
            {formatDate(asset.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  label,
  onClick,
  disabled,
  amber,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  amber?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
        disabled
          ? "bg-white/5 text-white/30 cursor-not-allowed"
          : amber
          ? "bg-primary/90 text-primary-foreground hover:bg-primary"
          : "bg-black/40 text-white hover:bg-black/60"
      }`}
    >
      {children}
    </button>
  );
}
