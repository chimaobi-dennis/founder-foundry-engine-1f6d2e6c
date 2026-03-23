import { Download, CalendarPlus, Copy, Play } from "lucide-react";
import { type LibraryAsset } from "./data";

interface Props {
  recent: LibraryAsset[];
  images: LibraryAsset[];
  documents: LibraryAsset[];
  scripts: LibraryAsset[];
  onSelect: (a: LibraryAsset) => void;
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-6 mt-7 mb-3.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-ui">
        {title} <span className="ml-1">({count})</span>
      </p>
      <button className="text-[12px] font-ui text-primary hover:underline">View all</button>
    </div>
  );
}

function PlatformPill({ platform, color }: { platform?: string; color?: string }) {
  if (!platform) return null;
  return (
    <span
      className="absolute top-2 right-2 text-[10px] font-ui px-2 py-0.5 rounded-lg z-[2]"
      style={{ backgroundColor: (color || "#8A96A3") + "30", color: color || "#8A96A3" }}
    >
      {platform}
    </span>
  );
}

function ImageCard({ asset, onClick }: { asset: LibraryAsset; onClick: () => void }) {
  const isLight = asset.color === "#FAFAF8" || asset.color === "#EDE5D5";
  return (
    <div
      className="rounded-[10px] overflow-hidden border border-border cursor-pointer relative group break-inside-avoid mb-3"
      onClick={onClick}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ backgroundColor: asset.color, height: asset.height }}
      >
        <span className={`text-[11px] font-ui font-medium px-3 text-center ${isLight ? "text-foreground/60" : "text-white/60"}`}>
          {asset.name}
        </span>
        <PlatformPill platform={asset.platform} color={asset.platformColor} />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-[3]">
          <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <Download size={14} />
          </button>
          <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <CalendarPlus size={14} />
          </button>
          <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <Copy size={14} />
          </button>
        </div>
      </div>
      <div className="px-3 py-2.5 bg-card">
        <p className="text-[12px] font-ui font-medium text-foreground truncate">{asset.name}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] font-ui text-muted-foreground">{asset.source}</span>
          <span className="text-[10px] font-ui text-muted-foreground">{asset.dateLabel}</span>
        </div>
      </div>
    </div>
  );
}

function DocumentCard({ asset, onClick }: { asset: LibraryAsset; onClick: () => void }) {
  return (
    <div
      className="rounded-[10px] overflow-hidden border border-border cursor-pointer group"
      onClick={onClick}
    >
      <div className="h-[100px] relative bg-card flex items-center px-4" style={{ borderLeft: `4px solid ${asset.color}` }}>
        <div className="flex-1">
          <p className="text-[11px] font-ui text-muted-foreground">{asset.docType}</p>
          <p className="text-[12px] font-ui font-medium text-foreground mt-1 truncate">{asset.name}</p>
          <div className="flex gap-2 mt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[2px] rounded-full bg-muted-foreground/20" style={{ width: `${40 + i * 10}px` }} />
            ))}
          </div>
        </div>
        <span className="absolute top-2 right-2 text-[10px] font-ui text-muted-foreground">{asset.source}</span>
      </div>
      <div className="px-3.5 py-3 bg-card border-t border-border">
        <span className="inline-block text-[10px] font-ui px-2 py-0.5 rounded-full bg-primary/10 text-primary mb-1.5">{asset.docType}</span>
        <p className="text-[13px] font-ui font-medium text-foreground truncate">{asset.name}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] font-ui text-muted-foreground">{asset.dateLabel}</span>
          <div className="flex items-center gap-3">
            <Download size={14} className="text-muted-foreground" />
            <button className="text-[12px] font-ui text-primary hover:underline">Open</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScriptCard({ asset, onClick }: { asset: LibraryAsset; onClick: () => void }) {
  return (
    <div
      className="rounded-[10px] overflow-hidden border border-border cursor-pointer group"
      onClick={onClick}
    >
      <div className="h-[100px] relative bg-card flex items-center justify-center gap-2 px-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-16 h-12 rounded border border-border bg-muted/30" />
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Play size={14} className="text-primary-foreground ml-0.5" />
          </div>
        </div>
        {asset.platform && (
          <span
            className="absolute top-2 right-2 text-[10px] font-ui px-2 py-0.5 rounded-lg"
            style={{ backgroundColor: (asset.platformColor || "#8A96A3") + "30", color: asset.platformColor }}
          >
            {asset.platform}
          </span>
        )}
      </div>
      <div className="px-3.5 py-3 bg-card border-t border-border">
        {asset.platform && (
          <span className="inline-block text-[10px] font-ui px-2 py-0.5 rounded-full bg-primary/10 text-primary mb-1.5">{asset.platform}</span>
        )}
        <p className="text-[13px] font-ui font-medium text-foreground truncate">{asset.name}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] font-ui text-muted-foreground">
            {asset.sceneCount} scenes · {asset.duration}
          </span>
          <span className="text-[11px] font-ui text-muted-foreground">{asset.dateLabel}</span>
        </div>
        <div className="flex justify-end mt-1">
          <button className="text-[12px] font-ui text-primary hover:underline">Open</button>
        </div>
      </div>
    </div>
  );
}

export function LibraryGridView({ recent, images, documents, scripts, onSelect }: Props) {
  return (
    <div className="pb-6">
      {/* Recent */}
      {recent.length > 0 && (
        <>
          <SectionHeader title="Recent" count={recent.length} />
          <div className="px-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            {recent.map((a) => (
              <ImageCard key={a.id} asset={a} onClick={() => onSelect(a)} />
            ))}
          </div>
        </>
      )}

      {/* Images */}
      {images.length > 0 && (
        <>
          <SectionHeader title="Images" count={images.length} />
          <div className="px-6 columns-2 md:columns-3 lg:columns-4 gap-3">
            {images.map((a) => (
              <ImageCard key={a.id} asset={a} onClick={() => onSelect(a)} />
            ))}
          </div>
        </>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <>
          <SectionHeader title="Documents" count={documents.length} />
          <div className="px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {documents.map((a) => (
              <DocumentCard key={a.id} asset={a} onClick={() => onSelect(a)} />
            ))}
          </div>
        </>
      )}

      {/* Scripts */}
      {scripts.length > 0 && (
        <>
          <SectionHeader title="Scripts" count={scripts.length} />
          <div className="px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {scripts.map((a) => (
              <ScriptCard key={a.id} asset={a} onClick={() => onSelect(a)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
