import { useState, useEffect } from "react";
import { Sparkles, Pencil } from "lucide-react";
import { BriefData, campaignGoals, toneOptions } from "./types";
import { Input } from "@/components/ui/input";
import { prefillCampaignBrief } from "@/services/campaignService";
import { useBrand } from "@/hooks/use-brand";

interface Props {
  brief: BriefData;
  onChange: (b: BriefData) => void;
  onGenerate: () => void;
  onCampaignNameChange?: (name: string) => void;
  fieldErrors?: Record<string, string>;
  campaignName: string;
}

export function BriefForm({ brief, onChange, onGenerate, onCampaignNameChange, fieldErrors = {}, campaignName }: Props) {
  const { activeBrand } = useBrand();
  const [prefilling, setPrefilling] = useState(false);

  const set = (key: keyof BriefData, val: string) => onChange({ ...brief, [key]: val });

  useEffect(() => {
    const loadPrefill = async () => {
      if (!activeBrand?.id) return;

      setPrefilling(true);
      try {
        const prefill = await prefillCampaignBrief(activeBrand.id);

        onChange({
          productName: prefill.product_name || "",
          targetAudience: prefill.target_audience || "",
          campaignGoal: prefill.campaign_goal || "",
          tone: prefill.tone || "",
          keyBenefit: prefill.key_benefit || "",
          callToAction: prefill.call_to_action || "",
        });

        // Auto-suggest campaign name
        const suggestedName = `${prefill.product_name} — ${prefill.campaign_goal || 'Campaign'}`;
        onCampaignNameChange?.(suggestedName);
      } catch (error) {
        console.error('Failed to prefill campaign brief:', error);
      } finally {
        setPrefilling(false);
      }
    };

    loadPrefill();
  }, [activeBrand?.id]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 mt-5">
      <div className="flex items-center gap-2 mb-5">
        <h2 className="font-display text-lg text-foreground">Campaign brief</h2>
        <Pencil size={14} className="text-muted-foreground" />
      </div>

      <div className="mb-4">
        <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1.5 block">Campaign name</label>
        {prefilling ? (
          <div className="h-10 rounded-md bg-muted animate-pulse" />
        ) : (
          <Input
            value={campaignName}
            onChange={(e) => {
              onCampaignNameChange?.(e.target.value);
            }}
            placeholder="Enter campaign name"
          />
        )}
        {fieldErrors.campaignName && (
          <p className="text-destructive text-xs mt-1">{fieldErrors.campaignName}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1.5 block">Product name</label>
          {prefilling ? (
            <div className="h-10 rounded-md bg-muted animate-pulse" />
          ) : (
            <Input value={brief.productName} onChange={(e) => set("productName", e.target.value)} />
          )}
          {fieldErrors.productName && (
            <p className="text-destructive text-xs mt-1">{fieldErrors.productName}</p>
          )}
        </div>
        <div>
          <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1.5 block">Target audience</label>
          {prefilling ? (
            <div className="h-10 rounded-md bg-muted animate-pulse" />
          ) : (
            <Input value={brief.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} />
          )}
          {fieldErrors.targetAudience && (
            <p className="text-destructive text-xs mt-1">{fieldErrors.targetAudience}</p>
          )}
        </div>
        <div>
          <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1.5 block">Campaign goal</label>
          {prefilling ? (
            <div className="h-10 rounded-md bg-muted animate-pulse" />
          ) : (
            <select
              value={brief.campaignGoal}
              onChange={(e) => set("campaignGoal", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-ui text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select goal...</option>
              {campaignGoals.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1.5 block">Tone</label>
          {prefilling ? (
            <div className="h-10 rounded-md bg-muted animate-pulse" />
          ) : (
            <select
              value={brief.tone}
              onChange={(e) => set("tone", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-ui text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select tone...</option>
              {toneOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1.5 block">Key benefit</label>
          {prefilling ? (
            <div className="h-10 rounded-md bg-muted animate-pulse" />
          ) : (
            <Input value={brief.keyBenefit} onChange={(e) => set("keyBenefit", e.target.value)} />
          )}
        </div>
        <div>
          <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1.5 block">Call to action</label>
          <Input value={brief.callToAction} onChange={(e) => set("callToAction", e.target.value)} placeholder="e.g. Shop now, Learn more" />
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={prefilling}
        className="w-full h-12 mt-6 rounded-lg bg-primary text-primary-foreground font-ui text-[14px] font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {prefilling ? (
          <span className="inline-block h-3 w-32 rounded bg-primary-foreground/30 animate-pulse" />
        ) : (
          <>
            <Sparkles size={16} />
            Generate Campaign
          </>
        )}
      </button>
      <p className="text-[11px] text-muted-foreground text-center mt-2 font-ui">Generates 8 platform creatives</p>
    </div>
  );
}
