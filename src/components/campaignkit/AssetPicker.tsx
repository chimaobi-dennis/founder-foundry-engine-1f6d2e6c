import { useState, useEffect } from "react";
import { Check, Grid3X3, X, ImageIcon, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBrand } from "@/hooks/use-brand";
import { getBrandOutputs } from "@/services/templateService";
import { getBrandProductImages } from "@/services/projectAssetsService";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AssetItem {
  id: string;
  type: 'output' | 'product_image';
  imageUrl: string | null;
  htmlContent: string | null;
  platform: string | null;
  platformColor?: string;
  name?: string;
}

export interface SelectedAsset {
  id: string;
  type: 'output' | 'product_image';
  imageUrl: string | null;
}

interface Props {
  selectedAssets: SelectedAsset[];
  onSelect: (assets: SelectedAsset[]) => void;
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

export function AssetPicker({ selectedAssets, onSelect, onSkip }: Props) {
  const { activeBrand } = useBrand();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalSelected, setModalSelected] = useState<SelectedAsset[]>([]);

  // Initialize modal selection when opening
  useEffect(() => {
    if (showModal) {
      setModalSelected(selectedAssets);
    }
  }, [showModal, selectedAssets]);

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

        // Fetch product images from project_assets table
        const productImages = await getBrandProductImages(activeBrand.id);
        const productAssets: AssetItem[] = (productImages || []).map((p: any) => ({
          id: p.id,
          type: 'product_image' as const,
          imageUrl: p.file_url || null,
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

  const isSelected = (id: string, type: string) => {
    return selectedAssets.some(a => a.id === id && a.type === type);
  };

  const handleToggleSelect = (asset: AssetItem) => {
    const isCurrentlySelected = isSelected(asset.id, asset.type);
    if (isCurrentlySelected) {
      onSelect(selectedAssets.filter(a => !(a.id === asset.id && a.type === asset.type)));
    } else {
      onSelect([...selectedAssets, { id: asset.id, type: asset.type, imageUrl: asset.imageUrl }]);
    }
  };

  const handleModalToggle = (asset: AssetItem) => {
    const isCurrentlySelected = modalSelected.some(a => a.id === asset.id && a.type === asset.type);
    if (isCurrentlySelected) {
      setModalSelected(modalSelected.filter(a => !(a.id === asset.id && a.type === asset.type)));
    } else {
      setModalSelected([...modalSelected, { id: asset.id, type: asset.type, imageUrl: asset.imageUrl }]);
    }
  };

  const handleModalConfirm = () => {
    onSelect(modalSelected);
    setShowModal(false);
  };

  const handleRemoveAsset = (id: string, type: string) => {
    onSelect(selectedAssets.filter(a => !(a.id === id && a.type === type)));
  };

  const handleSkip = () => {
    onSelect([]);
    onSkip();
  };

  // Get counts by type
  const outputCount = assets.filter(a => a.type === 'output').length;
  const productCount = assets.filter(a => a.type === 'product_image').length;

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
              className="w-[120px] h-[120px] rounded-lg bg-muted animate-pulse flex-shrink-0"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-ui">
          Select assets from your library
          {selectedAssets.length > 0 && (
            <span className="ml-2 text-primary">({selectedAssets.length} selected)</span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowModal(true)} 
            className="text-[12px] text-primary/70 hover:text-primary font-ui transition-colors flex items-center gap-1"
          >
            <Grid3X3 size={14} />
            See all assets
          </button>
          <span className="text-muted-foreground/30">|</span>
          <button onClick={handleSkip} className="text-[12px] text-muted-foreground/70 hover:text-muted-foreground font-ui transition-colors">
            Skip
          </button>
        </div>
      </div>

      {/* Selected Assets Preview */}
      {selectedAssets.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] text-muted-foreground mb-2">Selected for this brief:</p>
          <div className="flex flex-wrap gap-2">
            {selectedAssets.map((asset) => (
              <div 
                key={`selected-${asset.type}-${asset.id}`}
                className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-lg px-2 py-1.5"
              >
                {asset.imageUrl ? (
                  <img src={asset.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                    <ImageIcon size={12} className="text-muted-foreground" />
                  </div>
                )}
                <span className="text-[11px] text-primary font-medium">
                  {asset.type === 'output' ? 'Creative' : 'Product'}
                </span>
                <button 
                  onClick={() => handleRemoveAsset(asset.id, asset.type)}
                  className="ml-1 text-primary/60 hover:text-primary"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {assets.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No assets found in your library. Skip to continue without an asset.
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {assets.map((asset) => (
            <button
              key={`${asset.type}-${asset.id}`}
              onClick={() => handleToggleSelect(asset)}
              className={cn(
                "w-[120px] h-[120px] rounded-lg overflow-hidden border flex-shrink-0 relative cursor-pointer transition-all duration-200 bg-card",
                isSelected(asset.id, asset.type)
                  ? "border-2 border-primary ring-2 ring-primary/20"
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
              {isSelected(asset.id, asset.type) && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                  <Check size={12} className="text-primary-foreground" />
                </div>
              )}
              {/* Type Badge */}
              <div className="absolute top-1.5 left-1.5">
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-black/40 text-white border-0 backdrop-blur-sm">
                  {asset.type === 'output' ? 'Creative' : 'Product'}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>

    {/* Full Assets Modal */}
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Select Assets</DialogTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Layers size={14} />
                {outputCount} Creatives
              </span>
              <span className="flex items-center gap-1.5">
                <ImageIcon size={14} />
                {productCount} Products
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {modalSelected.length} assets selected for this brief
          </p>
        </DialogHeader>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Product Images Section */}
          {productCount > 0 && (
            <div className="mb-8">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <ImageIcon size={16} className="text-primary" />
                Product Images
                <Badge variant="secondary" className="text-xs">{productCount}</Badge>
              </h4>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                {assets.filter(a => a.type === 'product_image').map((asset) => (
                  <button
                    key={`modal-${asset.type}-${asset.id}`}
                    onClick={() => handleModalToggle(asset)}
                    className={cn(
                      "aspect-square rounded-lg overflow-hidden border relative cursor-pointer transition-all duration-200 bg-card",
                      modalSelected.some(a => a.id === asset.id && a.type === asset.type)
                        ? "border-2 border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    {asset.imageUrl ? (
                      <img src={asset.imageUrl} alt="Product" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <ImageIcon size={20} className="text-muted-foreground" />
                      </div>
                    )}
                    {modalSelected.some(a => a.id === asset.id && a.type === asset.type) && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
                        <Check size={14} className="text-primary-foreground" />
                      </div>
                    )}
                    <Badge 
                      className="absolute bottom-2 left-2 text-[9px] px-1.5 py-0 h-4 bg-black/50 text-white border-0 backdrop-blur-sm"
                    >
                      Product
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Creative Outputs Section */}
          {outputCount > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Layers size={16} className="text-primary" />
                Creative Outputs
                <Badge variant="secondary" className="text-xs">{outputCount}</Badge>
              </h4>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                {assets.filter(a => a.type === 'output').map((asset) => (
                  <button
                    key={`modal-${asset.type}-${asset.id}`}
                    onClick={() => handleModalToggle(asset)}
                    className={cn(
                      "aspect-square rounded-lg overflow-hidden border relative cursor-pointer transition-all duration-200 bg-card",
                      modalSelected.some(a => a.id === asset.id && a.type === asset.type)
                        ? "border-2 border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    {asset.imageUrl ? (
                      <img src={asset.imageUrl} alt="Creative" className="w-full h-full object-cover" />
                    ) : asset.htmlContent ? (
                      <iframe
                        srcDoc={asset.htmlContent}
                        className="w-full h-full border-0"
                        sandbox="allow-same-origin"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Layers size={20} className="text-muted-foreground" />
                      </div>
                    )}
                    {modalSelected.some(a => a.id === asset.id && a.type === asset.type) && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
                        <Check size={14} className="text-primary-foreground" />
                      </div>
                    )}
                    <Badge 
                      variant="secondary"
                      className="absolute bottom-2 left-2 text-[9px] px-1.5 py-0 h-4 text-white border-0 backdrop-blur-sm"
                      style={{ backgroundColor: asset.platformColor || 'rgba(0,0,0,0.5)' }}
                    >
                      {platformLabels[asset.platform || 'general']}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {assets.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
              <p>No assets found in your library.</p>
              <p className="text-sm mt-1">Upload product images or generate creatives first.</p>
            </div>
          )}
        </div>

        <div className="p-6 pt-4 border-t flex items-center justify-between bg-muted/30">
          <div className="text-sm text-muted-foreground">
            {modalSelected.length > 0 ? (
              <span>{modalSelected.length} assets will be included in the brief context</span>
            ) : (
              <span>No assets selected</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleModalConfirm} disabled={modalSelected.length === 0}>
              Confirm Selection ({modalSelected.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}
