import { useState, useEffect, useCallback } from "react";
import { useBrand } from "@/hooks/use-brand";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AssetPicker } from "@/components/campaignkit/AssetPicker";
import { BriefForm } from "@/components/campaignkit/BriefForm";
import { SummaryBar } from "@/components/campaignkit/SummaryBar";
import { PlatformCreative } from "@/components/campaignkit/PlatformCreative";
import { CopyPanel } from "@/components/campaignkit/CopyPanel";
import { CampaignHome } from "@/components/campaignkit/CampaignHome";
import {
  PlatformTab,
  platformTabs,
  BriefData,
  getRoastAssets,
  getLagosAssets,
  getRoastBrief,
  getLagosBrief,
  getRoastContent,
  getLagosContent,
  roastHeadlines,
  lagosHeadlines,
} from "@/components/campaignkit/types";
import { Download, Bookmark, ArrowLeft } from "lucide-react";
import { createCampaign, getCampaignWithCreatives } from "@/services/campaignService";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

const platformDots: Record<PlatformTab, string> = {
  Headlines: "hsl(43,78%,46%)",
  Instagram: "#E1306C",
  "Facebook Ad": "#4267B2",
  "Google Ad": "#4285F4",
  Email: "#EA4335",
  WhatsApp: "#128C7E",
  "Twitter/X": "#1DA1F2",
  SMS: "#6B7280",
};

const platformNameMap: Record<string, PlatformTab> = {
  headlines: "Headlines",
  instagram: "Instagram",
  facebook_ad: "Facebook Ad",
  google_ad: "Google Ad",
  email: "Email",
  whatsapp: "WhatsApp",
  twitter_x: "Twitter/X",
  sms: "SMS",
};

const CampaignKit = () => {
  const { activeBrand } = useBrand();
  const { campaignId } = useParams<{ campaignId?: string }>();
  const navigate = useNavigate();
  const isRoast = activeBrand?.id === "1";

  const [state, setState] = useState<"home" | "brief" | "results">("home");
  
  const [selectedAsset, setSelectedAsset] = useState<{ id: string | null; type: 'output' | 'product_image' | null }>({ id: null, type: null });
  const [brief, setBrief] = useState<BriefData>(getRoastBrief());
  const [activeTab, setActiveTab] = useState<PlatformTab>("Instagram");
  const [campaignName, setCampaignName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [campaignData, setCampaignData] = useState<any>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleCampaignNameChange = useCallback((name: string) => {
    setCampaignName(name);
  }, []);

  const assets = isRoast ? getRoastAssets() : getLagosAssets();
  const content = isRoast ? getRoastContent() : getLagosContent();
  const headlines = isRoast ? roastHeadlines : lagosHeadlines;
  const selectedAssetObj = assets.find((a) => a.id === "a1") || assets[0];

  // Load campaign data if campaignId is in URL
  useEffect(() => {
    if (campaignId && state === "home") {
      loadCampaign(campaignId);
    }
  }, [campaignId]);


  const loadCampaign = async (id: string) => {
    try {
      const data = await getCampaignWithCreatives(id);
      setCampaignData(data);
      setState("results");
    } catch (error) {
      console.error('Failed to load campaign:', error);
      setError('Failed to load campaign');
    }
  };

  useEffect(() => {
    if (!campaignId) {
      setBrief(isRoast ? getRoastBrief() : getLagosBrief());
      setSelectedAsset({ id: null, type: null });
    }
  }, [isRoast, campaignId]);

  const handleNewCampaign = () => {
    setCampaignData(null);
    setState("brief");
  };

  const handleViewCampaign = (id: string) => {
    navigate(`/campaign-kit/${id}`);
  };

  const handleGenerate = async () => {
    if (!activeBrand?.id) {
      setError('Please select a brand first');
      return;
    }

    // Validate required fields
    const errors: Record<string, string> = {};
    if (!campaignName.trim()) errors.campaignName = 'Campaign name is required';
    if (!brief.productName.trim()) errors.productName = 'Product name is required';
    if (!brief.targetAudience.trim()) errors.targetAudience = 'Target audience is required';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Please fill in all required fields');
      return;
    }

    setFieldErrors({});
    setError(null);

    // Get userId from auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      return;
    }

    setSubmitting(true);

    try {
      // Create campaign
      const newCampaignId = await createCampaign(activeBrand.id, user.id, {
        name: campaignName || `${brief.productName} — ${brief.campaignGoal}`,
        product_name: brief.productName,
        target_audience: brief.targetAudience,
        campaign_goal: brief.campaignGoal,
        tone: brief.tone,
        key_benefit: brief.keyBenefit,
        call_to_action: brief.callToAction,
        ...(selectedAsset.id && selectedAsset.type ? {
          asset_id: selectedAsset.id,
          asset_type: selectedAsset.type,
        } : {}),
      });

      // Mark this campaign as needing generation; CampaignDetail will pick it up
      try {
        sessionStorage.setItem(`campaign:autogen:${newCampaignId}`, '1');
      } catch {}

      // Navigate immediately — generation runs on the detail page with skeletons
      navigate(`/campaign-kit/${newCampaignId}`);
    } catch (error: any) {
      console.error('Failed to create campaign:', error);
      setError(error.message || 'Failed to create campaign');
      setSubmitting(false);
    }
  };

  const handleEdit = () => setState("brief");

  const handleBack = () => {
    navigate('/campaign-kit');
    setState("home");
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {state === "home" ? (
          <CampaignHome
            onNewCampaign={handleNewCampaign}
            onViewCampaign={handleViewCampaign}
          />
        ) : state === "brief" ? (
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-[12px] font-ui text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft size={14} /> Cancel
            </button>
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4">
                {error}
              </div>
            )}
            <AssetPicker
              selectedId={selectedAsset.id}
              selectedType={selectedAsset.type}
              onSelect={(id, type) => setSelectedAsset({ id, type })}
              onSkip={() => {}}
            />
            <BriefForm
              brief={brief}
              onChange={setBrief}
              onGenerate={handleGenerate}
              onCampaignNameChange={handleCampaignNameChange}
              fieldErrors={fieldErrors}
              campaignName={campaignName}
            />
          </div>
        ) : (
          <div className="flex flex-col min-h-0">
            {/* Back link + Summary bar */}
            <div className="max-w-5xl w-full mx-auto px-4 md:px-6 pt-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-[12px] font-ui text-muted-foreground hover:text-foreground mb-3 transition-colors"
              >
                <ArrowLeft size={14} /> Back to campaigns
              </button>
              <SummaryBar
                assetColor={selectedAssetObj.color}
                brief={brief}
                onEdit={handleEdit}
                onRegenerate={() => {}}
              />
            </div>

            {/* Platform tabs — sticky */}
            <div className="sticky top-10 z-[9] bg-background border-b border-border flex-shrink-0">
              <div className="max-w-5xl mx-auto px-4 md:px-6">
                <div className="flex overflow-x-auto scrollbar-hide">
                  {platformTabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-3 text-[13px] font-ui font-medium whitespace-nowrap transition-colors relative flex-shrink-0",
                        activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: platformDots[tab] }}
                      />
                      {tab}
                      {/* Unread indicator */}
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tab content */}
            <div className="max-w-5xl w-full mx-auto px-4 md:px-6 py-6">
              <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-6">
                <PlatformCreative
                  tab={activeTab}
                  content={content[activeTab]}
                  assetColor={selectedAssetObj.color}
                  brandName={activeBrand?.name || ""}
                  headlines={headlines}
                />
                <CopyPanel tab={activeTab} content={content[activeTab]} />
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="sticky bottom-0 border-t border-border bg-card z-10">
              <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center">
                <span className="text-[13px] font-ui text-muted-foreground">8 creatives ready</span>
                <div className="flex-1" />
                <button className="text-[12px] font-ui px-4 py-2 rounded-md border border-primary text-primary hover:bg-primary/10 flex items-center gap-1.5 transition-colors mr-3">
                  <Download size={14} /> Export all as ZIP
                </button>
                <button className="text-[12px] font-ui px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 transition-colors">
                  <Bookmark size={14} /> Save all to Library
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignKit;
