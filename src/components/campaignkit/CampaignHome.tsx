import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import { getCampaigns } from "@/services/campaignService";
import { supabase } from "@/integrations/supabase/client";

interface CampaignSummary {
  id: string;
  name: string;
  goalTone: string;
  assetColor: string;
  platforms: { color: string }[];
  status: string;
  statusBg: string;
  statusColor: string;
  creatives: string;
  date: string;
}

const platformColors: Record<string, string> = {
  headlines: "hsl(43,78%,46%)",
  instagram: "#E1306C",
  facebook_ad: "#4267B2",
  google_ad: "#4285F4",
  email: "#EA4335",
  whatsapp: "#128C7E",
  twitter_x: "#1DA1F2",
  sms: "#6B7280",
};

const getStatusStyles = (status: string) => {
  switch (status) {
    case 'active':
      return { bg: "rgba(26, 58, 26, 0.8)", color: "#4ADE80" };
    case 'scheduled':
      return { bg: "rgba(45, 74, 62, 0.3)", color: "#2D4A3E" };
    case 'completed':
      return { bg: "rgba(42, 42, 42, 0.8)", color: "#8A96A3" };
    default:
      return { bg: "rgba(42, 42, 42, 0.5)", color: "#8A96A3" };
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Created today";
  if (diffDays === 1) return "Created yesterday";
  if (diffDays < 7) return `Created ${diffDays} days ago`;
  if (diffDays < 30) return `Created ${Math.floor(diffDays / 7)} weeks ago`;
  return `Created ${Math.floor(diffDays / 30)} months ago`;
};

interface Props {
  onNewCampaign: () => void;
  onViewCampaign: (id: string) => void;
}

export function CampaignHome({ onNewCampaign, onViewCampaign }: Props) {
  const { activeBrand } = useBrand();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [stats, setStats] = useState({ total: 0, creatives: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCampaigns = async () => {
      if (!activeBrand?.id) return;

      try {
        const data = await getCampaigns(activeBrand.id);
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const campaignSummaries: CampaignSummary[] = data.map((c: any) => {
          const creativeCount = c.campaign_creatives?.length || 0;
          const platformKeys = c.campaign_creatives?.map((cc: any) => cc.platform) || [];
          const platforms = platformKeys.slice(0, 4).map((p: string) => ({
            color: platformColors[p] || "#6B7280"
          }));

          const statusStyles = getStatusStyles(c.status || 'active');

          return {
            id: c.id,
            name: c.name,
            goalTone: `${c.campaign_goal} · ${c.tone}`,
            assetColor: "#1A2A3A",
            platforms,
            status: c.status || 'Active',
            statusBg: statusStyles.bg,
            statusColor: statusStyles.color,
            creatives: `${creativeCount} creative${creativeCount !== 1 ? 's' : ''}`,
            date: formatDate(c.created_at),
          };
        });

        setCampaigns(campaignSummaries);

        // Calculate stats
        const totalCampaigns = data.length;
        const totalCreatives = data.reduce((sum: number, c: any) => sum + (c.campaign_creatives?.length || 0), 0);
        const thisMonthCampaigns = data.filter((c: any) => new Date(c.created_at) >= thisMonthStart).length;

        setStats({
          total: totalCampaigns,
          creatives: totalCreatives,
          thisMonth: thisMonthCampaigns,
        });
      } catch (error) {
        console.error('Failed to load campaigns:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCampaigns();
  }, [activeBrand?.id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl text-foreground">Campaigns</h1>
            <p className="text-[13px] font-ui text-muted-foreground mt-1">
              {activeBrand?.name || "Brand"}
            </p>
          </div>
          <button
            onClick={onNewCampaign}
            className="h-12 px-6 rounded-lg bg-primary text-primary-foreground font-ui text-[14px] font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Plus size={18} />
            New campaign
          </button>
        </div>
        <div className="text-center py-12 text-muted-foreground">Loading campaigns...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-foreground">Campaigns</h1>
          <p className="text-[13px] font-ui text-muted-foreground mt-1">
            {activeBrand?.name || "Brand"}
          </p>
        </div>
        <button
          onClick={onNewCampaign}
          className="h-12 px-6 rounded-lg bg-primary text-primary-foreground font-ui text-[14px] font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
        >
          <Plus size={18} />
          New campaign
        </button>
      </div>

      <div className="mb-8">
        <h2 className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-4">
          Recent campaigns
        </h2>
        <div className="flex flex-col gap-3">
          {campaigns.map((c) => (
            <div
              key={c.id}
              onClick={() => onViewCampaign(c.id)}
              className="rounded-xl border border-border bg-card p-5 cursor-pointer hover:-translate-y-px hover:border-primary/40 transition-all flex items-center gap-4"
            >
              <div
                className="w-14 h-14 rounded-lg flex-shrink-0"
                style={{ backgroundColor: c.assetColor }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-ui text-[15px] font-medium text-foreground truncate">
                  {c.name}
                </p>
                <p className="text-[12px] font-ui text-muted-foreground mt-0.5">
                  {c.goalTone}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  {c.platforms.map((p, i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                  ))}
                </div>
                <p className="text-[11px] font-ui text-muted-foreground mt-1">
                  {c.date}
                </p>
              </div>
              <div className="flex-shrink-0 text-right w-[120px]">
                <span
                  className="inline-block rounded-[10px] px-2.5 py-0.5 text-[11px] font-ui font-medium"
                  style={{
                    backgroundColor: c.statusBg,
                    color: c.statusColor,
                  }}
                >
                  {c.status}
                </span>
                <p className="text-[11px] font-ui text-muted-foreground mt-1">
                  {c.creatives}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewCampaign(c.id);
                  }}
                  className="text-[12px] font-ui text-primary hover:underline mt-1"
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-4">
          <button className="text-[12px] font-ui text-primary hover:underline">
            View all campaigns
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-2xl font-ui font-medium text-foreground">
            {stats.total}
          </p>
          <p className="text-[11px] font-ui text-muted-foreground mt-1">
            Campaigns created
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-2xl font-ui font-medium text-foreground">
            {stats.creatives}
          </p>
          <p className="text-[11px] font-ui text-muted-foreground mt-1">
            Creatives generated
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-2xl font-ui font-medium text-foreground">
            {stats.thisMonth}
          </p>
          <p className="text-[11px] font-ui text-muted-foreground mt-1">
            Campaigns this month
          </p>
        </div>
      </div>
    </div>
  );
}
