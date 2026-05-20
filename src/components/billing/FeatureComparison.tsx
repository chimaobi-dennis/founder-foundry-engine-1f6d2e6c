import { Sparkles, Layers, Zap, Shield, Infinity as InfinityIcon, Image } from 'lucide-react';

const PILLARS = [
  {
    icon: Sparkles,
    title: 'Brand memory that compounds',
    body:
      'Every generation refines Kinika\'s understanding of your voice, audience and visual identity.',
  },
  {
    icon: Zap,
    title: 'Priority AI generation',
    body:
      'Pro and Enterprise skip the queue with dedicated compute for image, copy and reel generation.',
  },
  {
    icon: Image,
    title: 'Studio-quality exports',
    body:
      'Watermark-free HD outputs across ContentStudio, ReelBuilder, CampaignKit and DocStudio.',
  },
  {
    icon: Layers,
    title: 'Workspaces per brand',
    body:
      'Separate identities, assets and campaigns — context never leaks between brands or clients.',
  },
  {
    icon: Shield,
    title: 'Secure & transparent billing',
    body:
      'All payments by Stripe. Cancel any time — generated assets always stay yours.',
  },
  {
    icon: InfinityIcon,
    title: 'Credits roll with you',
    body:
      'Unused monthly credits roll over on Pro and Enterprise so creative momentum is never lost.',
  },
];

export function FeatureComparison() {
  return (
    <div className="space-y-1">
      <div className="mb-4">
        <h3 className="font-display text-[15px] text-foreground">
          What every Kinika plan unlocks
        </h3>
        <p className="text-[12px] font-ui text-muted-foreground mt-1">
          A creative operating system, not a credit dispenser.
        </p>
      </div>

      <div className="space-y-2.5">
        {PILLARS.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="group flex items-start gap-3 p-3 rounded-xl border border-transparent hover:border-border hover:bg-card/40 transition-all duration-300"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
              <Icon size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-ui font-medium text-foreground leading-tight">
                {title}
              </p>
              <p className="text-[11.5px] font-ui text-muted-foreground mt-1 leading-relaxed">
                {body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
