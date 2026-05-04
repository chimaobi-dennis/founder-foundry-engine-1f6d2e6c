import { useEffect, useState } from "react";
import { Search, GripVertical, ImageOff } from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import { getLibraryAssets, type Asset } from "@/services/assetService";

export function AssetLibrary() {
  const { activeBrand } = useBrand();
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeBrand?.id) return;
    let cancelled = false;
    setLoading(true);
    getLibraryAssets(activeBrand.id, "templates")
      .then((all) => {
        if (cancelled) return;
        const filtered = all.filter((a: any) =>
          a.type === "template_output" &&
          ["prostudio", "contentstudio"].includes(a.source_module)
        );
        setAssets(filtered);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeBrand?.id]);

  const filtered = assets.filter((a) =>
    (a.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-ui mb-3">
          Asset library
        </h3>
      </div>
      <div className="px-3 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-background text-[12px] font-ui text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-2">
        {loading && (
          <div className="px-2 py-3 text-[11px] font-ui text-muted-foreground">
            Loading…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-2 py-6 text-center">
            <ImageOff size={16} className="mx-auto mb-1.5 text-muted-foreground/60" />
            <p className="text-[11px] font-ui text-muted-foreground">
              No saved assets yet
            </p>
          </div>
        )}
        {filtered.map((asset) => (
          <div
            key={asset.id}
            className="group mx-1 mb-2 rounded-lg border border-border overflow-hidden cursor-grab hover:border-card-border-hover transition-colors bg-card"
          >
            <div
              className="h-[72px] relative bg-muted"
              style={
                asset.file_url
                  ? {
                      backgroundImage: `url(${asset.file_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            >
              <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 transition-opacity">
                <GripVertical size={14} className="text-foreground" />
              </div>
            </div>
            <div className="px-2 py-1.5">
              <p className="text-[11px] font-ui font-medium text-foreground truncate">
                {asset.name || "Untitled"}
              </p>
              {asset.platform && (
                <span className="inline-block text-[10px] font-ui mt-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  {asset.platform}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
