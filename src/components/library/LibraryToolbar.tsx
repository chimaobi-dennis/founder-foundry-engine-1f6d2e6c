import { Search, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

const filters = ["All", "Images", "Templates", "Documents", "Scripts"];
const sortOptions = ["Recent", "Oldest", "Name A–Z", "Most used"];

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  activeFilter: string;
  onFilterChange: (v: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (v: "grid" | "list") => void;
  sortBy: string;
  onSortChange: (v: string) => void;
}

export function LibraryToolbar({ search, onSearchChange, activeFilter, onFilterChange, viewMode, onViewModeChange, sortBy, onSortChange }: Props) {
  return (
    <div className="sticky top-[40px] z-[9] h-14 border-b border-border/50 bg-background flex items-center gap-3 px-6 flex-shrink-0">
      {/* Title */}
      <h1 className="font-display text-xl font-medium text-foreground whitespace-nowrap hidden sm:block">Library</h1>

      {/* Search */}
      <div className="relative flex-1 max-w-[400px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search assets..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/50 bg-background text-[12px] font-ui text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Filter pills */}
      <div className="hidden md:flex items-center gap-1.5">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={cn(
              "px-3.5 py-1 rounded-full text-[12px] font-ui transition-colors",
              activeFilter === f
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => onViewModeChange("grid")}
          className={cn(
            "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
            viewMode === "grid" ? "bg-[hsl(var(--active-tint))] text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutGrid size={16} />
        </button>
        <button
          onClick={() => onViewModeChange("list")}
          className={cn(
            "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
            viewMode === "list" ? "bg-[hsl(var(--active-tint))] text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <List size={16} />
        </button>
      </div>

      {/* Sort */}
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value)}
        className="h-9 rounded-lg border border-border/50 bg-background px-3 text-[12px] font-ui text-foreground outline-none focus:ring-1 focus:ring-ring"
      >
        {sortOptions.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
