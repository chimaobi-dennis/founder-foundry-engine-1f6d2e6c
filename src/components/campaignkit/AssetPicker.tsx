import { useState, useEffect } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBrand } from "@/hooks/use-brand";
import { getBrandOutputs } from "@/services/templateService";
import { getBrandProductImages } from "@/services/projectAssetsService";

interface AssetItem {
  id: string;
  type: 'output' | 'product_image';
  imageUrl: string | null;
  htmlContent: string | null;
  platform: string | null;
  platformColor?: string;
}

interface Props {
  selectedId: string | null;
  selectedType: 'output' | 'product_image' | null;
  onSelect: (id: string | null, type: 'output' | 'product_image' | null) => void;
  onSkip: () => void;
}

const platformColors: Record<string, string> = {
  instagram: "#E1306C",
  facebook_ad: "#4267B2",
  google_ad: "#4285F4",
  email: "#EA4335",
  whatsapp: "#128C7E",
  twitter_x: "#1DA1F2",
  sms: "#6B7280",
  headlines: "hsl(43,78%,46%)",
  general: "#6B7280",
};

const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  facebook_ad: "Facebook",
  google_ad: "Google",
  email: "Email",
  whatsapp: "WhatsApp",
  twitter_x: "Twitter/X",
  sms: "SMS",
  headlines: "Headlines",
  general: "General",
};

export function AssetPicker({ selectedId, selectedType, onSelect, onSkip }: Props) {
  const { activeBrand } = useBrand();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssets = async () => {
      if (!activeBrand?.id) {
        setLoading(false);
        return;
      }

      try {
        // Fetch template outputs
        const { data: outputs } = await getBrandOutputs(activeBrand.id, true);
        const outputAssets: AssetItem[] = (outputs || []).map((o: any) => ({
          id: o.id,
          type: 'output' as const,
          imageUrl: o.output_image_url || null,
          htmlContent: o.output_html || null,
          platform: o.aspect_ratio || 'general',
          platformColor: platformColors[o.aspect_ratio] || platformColors.general,
        }));

        // Fetch product images
        const { data: productImages } = await getBrandProductImages(activeBrand.id);
        const productAssets: AssetItem[] = (productImages || []).map((p: any) => ({
          id: p.id,
          type: 'product_image' as const,
          imageUrl: p.image_url || null,
          htmlContent: null,
          platform: 'product',
          platformColor: platformColors.general,
        }));

        setAssets([...outputAssets, ...productAssets]);
      } catch (error) {
        console.error('Failed to load assets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, [activeBrand?.id]);

  const handleSelect = (id: string, type: 'output' | 'product_image') => {
    if (selectedId === id && selectedType === type) {
      onSelect(null, null); // Deselect if already selected
    } else {
      onSelect(id, type);
    }
  };

  const handleSkip = () => {
    onSelect(null, null);
    onSkip();
  };

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-ui">
            Select an asset from your library
          </h3>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="w-[120px] h-[120px] rounded-lg bg-muted border border-border flex-shrink-0 flex items-center justify-center"
            >
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-ui">
          Select an asset from your library
        </h3>
        <button onClick={handleSkip} className="text-[12px] text-primary/70 hover:text-primary font-ui transition-colors">
          Skip — use copy only
        </button>
      </div>
      {assets.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No assets found in your library. Skip to continue without an asset.
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {assets.map((asset) => (
            <button
              key={`${asset.type}-${asset.id}`}
              onClick={() => handleSelect(asset.id, asset.type)}
              className={cn(
                "w-[120px] h-[120px] rounded-lg overflow-hidden border flex-shrink-0 relative cursor-pointer transition-all duration-200 bg-card",
                selectedId === asset.id && selectedType === asset.type
                  ? "border-2 border-primary"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              {asset.imageUrl ? (
                <img
                  src={asset.imageUrl}
                  alt="Asset"
                  className="w-full h-full object-cover"
                />
              ) : asset.htmlContent ? (
                <iframe
                  srcDoc={asset.htmlContent}
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">No preview</span>
                </div>
              )}
              {asset.platform && asset.platform !== 'product' && (
                <div className="absolute bottom-2 left-2 right-2">
                  <span
                    className="text-[10px] font-ui px-2 py-0.5 rounded-full text-white/90 backdrop-blur-sm"
                    style={{ backgroundColor: asset.platformColor || 'rgba(0,0,0,0.6)' }}
                  >
                    {platformLabels[asset.platform] || asset.platform}
                  </span>
                </div>
              )}
              {selectedId === asset.id && selectedType === asset.type && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check size={10} className="text-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
