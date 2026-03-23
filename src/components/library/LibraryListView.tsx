import { MoreHorizontal } from "lucide-react";
import { type LibraryAsset } from "./data";

interface Props {
  assets: LibraryAsset[];
  onSelect: (a: LibraryAsset) => void;
}

function typeLabel(type: string) {
  if (type === "image") return "Image";
  if (type === "document") return "Document";
  if (type === "script") return "Script";
  return type;
}

export function LibraryListView({ assets, onSelect }: Props) {
  return (
    <div className="px-6 pt-5">
      {assets.map((a) => (
        <div
          key={a.id}
          onClick={() => onSelect(a)}
          className="h-[52px] border-b border-border/50 flex items-center gap-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors"
        >
          {/* Thumbnail */}
          <div
            className="w-10 h-10 rounded-md flex-shrink-0"
            style={{ backgroundColor: a.color }}
          />
          {/* Name */}
          <span className="text-[13px] font-ui text-foreground flex-1 truncate">{a.name}</span>
          {/* Type */}
          <span className="text-[10px] font-ui text-muted-foreground px-2 py-0.5 rounded-full border border-border hidden sm:inline">
            {typeLabel(a.type)}
          </span>
          {/* Source */}
          <span className="text-[10px] font-ui text-muted-foreground hidden md:inline">{a.source}</span>
          {/* Date */}
          <span className="text-[11px] font-ui text-muted-foreground min-w-[100px] text-right">{a.dateLabel}</span>
          {/* Menu */}
          <MoreHorizontal size={16} className="text-muted-foreground flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
