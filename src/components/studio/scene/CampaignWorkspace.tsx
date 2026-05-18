import { useState, useMemo } from "react";
import {
  Grid3X3, Check, Download, Monitor, Smartphone, TabletSmartphone,
  ChevronRight, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Campaign, CampaignAsset } from "@/lib/scene/campaignSceneSystem";
import { SceneRenderer } from "./SceneRenderer";

// ─── Platform icons ──────────────────────────────────────────

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram_story: <Smartphone className="h-3.5 w-3.5" />,
  instagram_post: <Smartphone className="h-3.5 w-3.5" />,
  instagram_reels: <Smartphone className="h-3.5 w-3.5" />,
  facebook_ad: <Monitor className="h-3.5 w-3.5" />,
  linkedin_post: <Monitor className="h-3.5 w-3.5" />,
  twitter: <Monitor className="h-3.5 w-3.5" />,
  pinterest: <TabletSmartphone className="h-3.5 w-3.5" />,
  youtube_thumbnail: <Monitor className="h-3.5 w-3.5" />,
  email_header: <Monitor className="h-3.5 w-3.5" />,
};

// ─── Props ───────────────────────────────────────────────────

interface Props {
  campaign: Campaign;
  onSelectAsset: (asset: CampaignAsset) => void;
  onApproveAsset?: (assetId: string) => void;
  onExportAsset?: (assetId: string) => void;
  onExportAll?: () => void;
}

// ─── Component ───────────────────────────────────────────────

export function CampaignWorkspace({
  campaign,
  onSelectAsset,
  onApproveAsset,
  onExportAsset,
  onExportAll,
}: Props) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<"all" | "draft" | "approved" | "exported">("all");

  const filteredAssets = useMemo(() => {
    if (filter === "all") return campaign.assets;
    return campaign.assets.filter((a) => a.status === filter);
  }, [campaign.assets, filter]);

  const stats = useMemo(() => ({
    total: campaign.assets.length,
    draft: campaign.assets.filter((a) => a.status === "draft").length,
    approved: campaign.assets.filter((a) => a.status === "approved").length,
    exported: campaign.assets.filter((a) => a.status === "exported").length,
  }), [campaign.assets]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{campaign.name}</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {stats.total} asset{stats.total !== 1 ? "s" : ""} across {new Set(campaign.assets.map((a) => a.platformSlug)).size} platforms
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {onExportAll && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onExportAll}>
                <Download className="h-3 w-3 mr-1" /> Export All
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1">
          {(["all", "draft", "approved", "exported"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full transition-colors capitalize",
                filter === f
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f} {f === "all" ? `(${stats.total})` : `(${stats[f]})`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <ScrollArea className="flex-1">
        <div
          className={cn(
            "p-4",
            view === "grid"
              ? "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              : "space-y-2"
          )}
        >
          {filteredAssets.map((asset) => (
            <CampaignAssetCard
              key={asset.id}
              asset={asset}
              onClick={() => onSelectAsset(asset)}
              onApprove={onApproveAsset ? () => onApproveAsset(asset.id) : undefined}
              onExport={onExportAsset ? () => onExportAsset(asset.id) : undefined}
            />
          ))}

          {filteredAssets.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <Grid3X3 className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">No assets match this filter</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Asset Card ──────────────────────────────────────────────

function CampaignAssetCard({
  asset,
  onClick,
  onApprove,
  onExport,
}: {
  asset: CampaignAsset;
  onClick: () => void;
  onApprove?: () => void;
  onExport?: () => void;
}) {
  const scale = Math.min(200 / asset.scene.width, 140 / asset.scene.height, 1);

  return (
    <div
      onClick={onClick}
      className={cn(
        "group rounded-lg border overflow-hidden cursor-pointer transition-all duration-200",
        "hover:border-primary/40 hover:shadow-md",
        asset.status === "approved" ? "border-emerald-500/30" : "border-border"
      )}
    >
      {/* Preview */}
      <div
        className="relative bg-muted/30 flex items-center justify-center overflow-hidden"
        style={{ height: 140 }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            width: asset.scene.width,
            height: asset.scene.height,
            background: asset.scene.background,
          }}
          className="shadow-sm"
        >
          <SceneRenderer document={asset.scene} />
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="text-[10px] text-white font-medium flex items-center gap-1">
            Open <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="px-2.5 py-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">
            {PLATFORM_ICONS[asset.platformSlug] || <Monitor className="h-3 w-3" />}
          </span>
          <span className="text-[11px] font-medium text-foreground/90 truncate flex-1">
            {asset.platformName}
          </span>
          <Badge
            variant={asset.status === "approved" ? "default" : "secondary"}
            className={cn(
              "text-[9px] px-1.5 py-0 h-4",
              asset.status === "approved" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
              asset.status === "exported" && "bg-blue-500/10 text-blue-600 border-blue-500/20"
            )}
          >
            {asset.status}
          </Badge>
        </div>

        <p className="text-[9px] text-muted-foreground">
          {asset.scene.width} × {asset.scene.height}
        </p>

        {/* Quick actions */}
        <div className="flex items-center gap-1 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onApprove && asset.status === "draft" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[9px]"
              onClick={(e) => { e.stopPropagation(); onApprove(); }}
            >
              <Check className="h-2.5 w-2.5 mr-0.5" /> Approve
            </Button>
          )}
          {onExport && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[9px]"
              onClick={(e) => { e.stopPropagation(); onExport(); }}
            >
              <Download className="h-2.5 w-2.5 mr-0.5" /> Export
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
