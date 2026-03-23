import { useState } from "react";
import { useBrand } from "@/hooks/use-brand";
import { LibraryToolbar } from "@/components/library/LibraryToolbar";
import { LibraryStats } from "@/components/library/LibraryStats";
import { LibraryGridView } from "@/components/library/LibraryGridView";
import { LibraryListView } from "@/components/library/LibraryListView";
import { LibraryDetailPanel } from "@/components/library/LibraryDetailPanel";
import { LibraryEmptyState } from "@/components/library/LibraryEmptyState";
import { LibraryFAB } from "@/components/library/LibraryFAB";
import { type LibraryAsset, getNordformAssets, getSthlmAssets } from "@/components/library/data";

const Library = () => {
  const { activeBrand } = useBrand();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("Recent");
  const [selectedAsset, setSelectedAsset] = useState<LibraryAsset | null>(null);

  const allAssets = activeBrand?.name === "Sthlm Studio" ? getSthlmAssets() : getNordformAssets();

  const filtered = allAssets.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      activeFilter === "All" ||
      (activeFilter === "Images" && a.type === "image") ||
      (activeFilter === "Templates" && a.type === "template") ||
      (activeFilter === "Documents" && a.type === "document") ||
      (activeFilter === "Scripts" && a.type === "script");
    return matchesSearch && matchesFilter;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "Recent") return b.daysAgo - a.daysAgo === 0 ? 0 : a.daysAgo - b.daysAgo;
    if (sortBy === "Oldest") return b.daysAgo - a.daysAgo === 0 ? 0 : b.daysAgo - a.daysAgo;
    if (sortBy === "Name A–Z") return a.name.localeCompare(b.name);
    return 0;
  });

  const images = sorted.filter((a) => a.type === "image");
  const documents = sorted.filter((a) => a.type === "document");
  const scripts = sorted.filter((a) => a.type === "script");
  const recent = [...sorted].slice(0, 4);

  const stats = {
    total: allAssets.length,
    images: allAssets.filter((a) => a.type === "image").length,
    documents: allAssets.filter((a) => a.type === "document").length,
    scripts: allAssets.filter((a) => a.type === "script").length,
  };

  const noResults = filtered.length === 0;

  return (
    <div className="flex flex-col min-h-0 flex-1 relative">
      <LibraryToolbar
        search={search}
        onSearchChange={setSearch}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {noResults ? (
          <LibraryEmptyState />
        ) : (
          <div className={`transition-all duration-200 ${selectedAsset ? "mr-[300px]" : ""}`}>
            <LibraryStats stats={stats} />
            {viewMode === "grid" ? (
              <LibraryGridView
                recent={recent}
                images={images}
                documents={documents}
                scripts={scripts}
                onSelect={setSelectedAsset}
              />
            ) : (
              <LibraryListView assets={sorted} onSelect={setSelectedAsset} />
            )}
            <div className="h-24" />
          </div>
        )}
      </div>

      <LibraryDetailPanel asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      <LibraryFAB />
    </div>
  );
};

export default Library;
