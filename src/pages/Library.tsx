import { useEffect, useMemo, useState, useCallback } from "react";
import { Folder, Image as ImageIcon, FileText, Film } from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import { useBrandUrlSync } from "@/hooks/use-brand-url-sync";
import { LibraryToolbar } from "@/components/library/LibraryToolbar";
import { LibraryStats } from "@/components/library/LibraryStats";
import { LibraryFAB } from "@/components/library/LibraryFAB";
import { LibraryAssetCard } from "@/components/library/LibraryAssetCard";
import { LibraryPreviewModal } from "@/components/library/LibraryPreviewModal";
import { LibraryRealProductImages } from "@/components/library/LibraryRealProductImages";
import {
  type Asset,
  type AssetCounts,
  type AssetFilter,
  getLibraryAssets,
  getAssetCounts,
} from "@/services/assetService";

const FILTER_MAP: Record<string, AssetFilter> = {
  All: "all",
  Images: "images",
  Templates: "templates",
  Documents: "documents",
  Scripts: "scripts",
};

const Library = () => {
  const { activeBrand } = useBrand();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("Recent");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [counts, setCounts] = useState<AssetCounts>({
    total: 0,
    productImages: 0,
    images: 0,
    documents: 0,
    scripts: 0,
  });
  const [loading, setLoading] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  const loadAll = useCallback(async () => {
    if (!activeBrand?.id) {
      setAssets([]);
      setCounts({ total: 0, productImages: 0, images: 0, documents: 0, scripts: 0 });
      return;
    }
    setLoading(true);
    const filter = FILTER_MAP[activeFilter] || "all";
    const [a, c] = await Promise.all([
      getLibraryAssets(activeBrand.id, filter),
      getAssetCounts(activeBrand.id),
    ]);
    setAssets(a);
    setCounts(c);
    setLoading(false);
  }, [activeBrand?.id, activeFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? assets.filter((a) => a.name?.toLowerCase().includes(q))
      : assets;
  }, [assets, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === "Recent") {
      arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    } else if (sortBy === "Oldest") {
      arr.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    } else if (sortBy === "Name A–Z") {
      arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return arr;
  }, [filtered, sortBy]);

  const recent = useMemo(
    () =>
      [...assets]
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 4),
    [assets],
  );

  const handleTrashed = useCallback(
    (assetId: string) => {
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      if (activeBrand?.id) {
        getAssetCounts(activeBrand.id).then(setCounts);
      }
    },
    [activeBrand?.id],
  );

  const noResults = !loading && sorted.length === 0;

  const emptyMeta = (() => {
    switch (activeFilter) {
      case "Images":
        return { icon: ImageIcon, label: "No images yet", hint: "Save visuals from ProStudio or ContentStudio." };
      case "Documents":
        return { icon: FileText, label: "No documents yet", hint: "Generate one in DocStudio." };
      case "Scripts":
        return { icon: Film, label: "No scripts yet", hint: "Create one in ReelBuilder." };
      case "Templates":
        return { icon: ImageIcon, label: "No template outputs", hint: "Generate from ProStudio or ContentStudio." };
      default:
        return { icon: Folder, label: "No assets yet", hint: "Anything you save will appear here." };
    }
  })();
  const EmptyIcon = emptyMeta.icon;

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
        <LibraryStats stats={counts} />

        {(activeFilter === "All" || activeFilter === "Images") && (
          <LibraryRealProductImages onChange={loadAll} />
        )}

        {/* Recent */}
        {activeFilter === "All" && recent.length > 0 && (
          <>
            <div className="flex items-center justify-between px-6 mt-7 mb-3.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-ui">
                Recent <span className="ml-1">({recent.length})</span>
              </p>
              <button
                onClick={() => setActiveFilter("All")}
                className="text-[12px] font-ui text-primary hover:underline"
              >
                View all
              </button>
            </div>
            <div className="px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {recent.map((a) => (
                <LibraryAssetCard
                  key={`r-${a.id}`}
                  asset={a}
                  onPreview={setPreviewAsset}
                  onTrashed={handleTrashed}
                />
              ))}
            </div>
          </>
        )}

        {/* Saved designs grid */}
        <div className="flex items-center justify-between px-6 mt-7 mb-3.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-ui">
            Saved designs <span className="ml-1">({sorted.length})</span>
          </p>
        </div>

        {loading ? (
          <div className="px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-[10px] bg-muted animate-pulse" />
            ))}
          </div>
        ) : noResults ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="w-[60px] h-[60px] rounded-xl border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
              <EmptyIcon size={26} className="text-muted-foreground/50" />
            </div>
            <h2 className="font-display text-lg text-foreground">{emptyMeta.label}</h2>
            <p className="text-[13px] font-ui text-muted-foreground mt-2 text-center max-w-xs">
              {emptyMeta.hint}
            </p>
          </div>
        ) : (
          <div className="px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sorted.map((a) => (
              <LibraryAssetCard
                key={a.id}
                asset={a}
                onPreview={setPreviewAsset}
                onTrashed={handleTrashed}
              />
            ))}
          </div>
        )}

        <div className="h-24" />
      </div>

      <LibraryPreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
      <LibraryFAB />
    </div>
  );
};

export default Library;
