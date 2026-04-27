import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Check,
  Pencil,
  Loader2,
  RefreshCw,
  Instagram,
  Facebook,
  Mail,
  MessageSquare,
  Twitter,
  Search,
  Smartphone,
  Megaphone,
} from "lucide-react";
import { getCampaignWithCreatives, generateCampaignCreatives } from "@/services/campaignService";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/hooks/use-brand";

const db = supabase as any;

const platformMeta: Record<
  string,
  { name: string; icon: any; background: string }
> = {
  headlines: { name: "Headlines", icon: Megaphone, background: "#D4A017" },
  instagram: {
    name: "Instagram",
    icon: Instagram,
    background:
      "linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)",
  },
  facebook_ad: { name: "Facebook Ad", icon: Facebook, background: "#1877F2" },
  google_ad: {
    name: "Google Ad",
    icon: Search,
    background:
      "conic-gradient(from 90deg at 50% 50%, #4285F4 0deg, #4285F4 90deg, #34A853 90deg, #34A853 180deg, #FBBC05 180deg, #FBBC05 270deg, #EA4335 270deg, #EA4335 360deg)",
  },
  email: { name: "Email", icon: Mail, background: "#EA4335" },
  whatsapp: { name: "WhatsApp", icon: MessageSquare, background: "#25D366" },
  twitter_x: { name: "Twitter / X", icon: Twitter, background: "#000000" },
  sms: { name: "SMS", icon: Smartphone, background: "#6B7280" },
};

const PLATFORM_ORDER = [
  "headlines",
  "instagram",
  "facebook_ad",
  "google_ad",
  "email",
  "whatsapp",
  "twitter_x",
  "sms",
];

interface Creative {
  id: string;
  platform: string;
  headline: string | null;
  copy_text: string | null;
  subject_line: string | null;
}

const CreativeCard = ({
  creative,
  onUpdate,
}: {
  creative: Creative;
  onUpdate: (id: string, updates: Partial<Creative>) => void;
}) => {
  const meta = platformMeta[creative.platform] ?? {
    name: creative.platform,
    icon: Megaphone,
    background: "hsl(var(--muted-foreground))",
  };
  const Icon = meta.icon;

  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(creative.copy_text ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(creative.copy_text ?? "");
  }, [creative.copy_text]);

  const handleCopy = async () => {
    if (!creative.copy_text) return;
    await navigator.clipboard.writeText(creative.copy_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await db
        .from("campaign_creatives")
        .update({ copy_text: draft })
        .eq("id", creative.id);
      if (error) throw error;
      onUpdate(creative.id, { copy_text: draft });
      setEditing(false);
      toast.success("Saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow">
      {/* Platform header */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-sm"
          style={{ background: meta.background }}
        >
          <Icon size={18} strokeWidth={2} />
        </span>
        <h3 className="font-display text-base font-bold text-foreground">
          {meta.name}
        </h3>
      </div>

      {/* Subject (email) */}
      {creative.subject_line && (
        <p className="text-[11px] font-ui font-semibold uppercase tracking-wider mb-3" style={{ color: "#D4A017" }}>
          Subject:{" "}
          <span className="text-foreground/90 normal-case tracking-normal font-medium">
            {creative.subject_line}
          </span>
        </p>
      )}

      {/* Headline */}
      {creative.headline && (
        <p className="font-display text-xl text-foreground font-bold mb-3 leading-tight">
          {creative.headline}
        </p>
      )}

      {/* Copy body */}
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full min-h-[160px] text-[14px] font-ui text-foreground bg-background border border-input rounded-lg p-3 outline-none focus:ring-2 focus:ring-ring resize-y leading-relaxed"
        />
      ) : (
        <p className="text-[14px] font-ui text-foreground/85 whitespace-pre-wrap flex-1 leading-relaxed">
          {creative.copy_text || (
            <span className="text-muted-foreground italic">No copy generated</span>
          )}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border">
        <button
          onClick={handleCopy}
          disabled={!creative.copy_text}
          className="text-[12px] font-ui px-3 py-1.5 rounded-md border border-border hover:border-primary hover:text-primary flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
        {editing ? (
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-[12px] font-ui px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Save
          </button>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-[12px] font-ui px-3 py-1.5 rounded-md border border-border hover:border-primary hover:text-primary flex items-center gap-1.5 transition-colors"
          >
            <Pencil size={13} /> Edit
          </button>
        )}
      </div>
    </div>
  );
};

export default function CampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { activeBrandDNA } = useBrand();

  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [campaign, setCampaign] = useState<any>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [assetThumbUrl, setAssetThumbUrl] = useState<string | null>(null);

  const load = async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const data = await getCampaignWithCreatives(campaignId);
      setCampaign(data);
      const sorted = [...(data.campaign_creatives ?? [])].sort(
        (a: Creative, b: Creative) =>
          PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform)
      );
      setCreatives(sorted);

      // Load thumbnail for selected asset if any
      if (data.asset_id && data.asset_type) {
        const table = data.asset_type === "product_image" ? "product_images" : "template_outputs";
        const urlField = data.asset_type === "product_image" ? "image_url" : "output_image_url";
        const { data: asset } = await db
          .from(table)
          .select(urlField)
          .eq("id", data.asset_id)
          .maybeSingle();
        setAssetThumbUrl(asset?.[urlField] ?? null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load campaign");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const handleUpdate = (id: string, updates: Partial<Creative>) => {
    setCreatives((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleRegenerate = async () => {
    if (!campaignId || !campaign) return;
    setRegenerating(true);
    try {
      // Delete existing creatives
      await db.from("campaign_creatives").delete().eq("campaign_id", campaignId);

      const brief = {
        product_name: campaign.product_name,
        target_audience: campaign.target_audience,
        campaign_goal: campaign.campaign_goal,
        tone: campaign.tone,
        key_benefit: campaign.key_benefit,
        call_to_action: campaign.call_to_action,
      };

      await generateCampaignCreatives(campaignId, brief, activeBrandDNA);
      await load();
      toast.success("Campaign regenerated");
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate");
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground font-ui">Campaign not found</p>
        <button
          onClick={() => navigate("/campaign-kit")}
          className="text-[13px] font-ui text-primary hover:underline"
        >
          Back to campaigns
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div className="max-w-5xl w-full mx-auto px-4 md:px-6 py-6">
        <button
          onClick={() => navigate("/campaign-kit")}
          className="flex items-center gap-1.5 text-[12px] font-ui text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> Back to campaigns
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {assetThumbUrl && (
              <img
                src={assetThumbUrl}
                alt=""
                className="w-16 h-16 rounded-lg object-cover border border-border flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="font-display text-2xl text-foreground mb-1 truncate">
                {campaign.name}
              </h1>
              <p className="text-[13px] font-ui text-muted-foreground">
                {campaign.product_name}
                {campaign.target_audience ? ` · ${campaign.target_audience}` : ""}
                {campaign.campaign_goal ? ` · ${campaign.campaign_goal}` : ""}
              </p>
            </div>
          </div>

          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-[12px] font-ui px-3 py-2 rounded-md border border-border hover:border-primary hover:text-primary flex items-center gap-1.5 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {regenerating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            Regenerate all
          </button>
        </div>

        {/* Creatives grid */}
        {regenerating ? (
          <div className="text-center py-16">
            <Loader2 className="animate-spin text-primary mx-auto mb-3" size={32} />
            <p className="font-ui text-[13px] text-muted-foreground">
              Regenerating all 8 creatives...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creatives.map((c) => (
              <CreativeCard key={c.id} creative={c} onUpdate={handleUpdate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
