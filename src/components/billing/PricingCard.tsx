import { Check, Sparkles, Crown, Star, Zap, Layers, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreditPackage } from '@/services/stripeService';
import { StripeCheckoutButton } from './StripeCheckoutButton';

interface PricingCardProps {
  pkg: CreditPackage;
  isCurrent?: boolean;
  highlighted?: boolean;
  tier?: 'starter' | 'standard' | 'pro' | 'enterprise';
  onError?: (msg: string) => void;
}

/**
 * Builds the feature list shown on the card from the package metadata.
 * Falls back to sensible defaults when subscription columns are absent.
 */
function buildFeatures(pkg: CreditPackage, tier: string): string[] {
  const features: string[] = [];

  const monthly = pkg.monthlyCredits ?? pkg.credits;
  if (monthly) {
    features.push(`${monthly.toLocaleString()} credits / month`);
  }

  if (pkg.maxWorkspaces != null) {
    features.push(
      pkg.maxWorkspaces === 1
        ? '1 workspace'
        : pkg.maxWorkspaces >= 999
        ? 'Unlimited workspaces'
        : `Up to ${pkg.maxWorkspaces} workspaces`
    );
  }

  features.push(
    pkg.watermarkExports ? 'Watermarked exports' : 'Watermark-free HD exports'
  );

  if (pkg.priorityGeneration) features.push('Priority AI generation queue');
  else if (tier !== 'starter') features.push('Standard AI generation queue');

  if (pkg.rolloverEnabled) {
    features.push(
      pkg.rolloverDays
        ? `Credit rollover (${pkg.rolloverDays} days)`
        : 'Credit rollover enabled'
    );
  }

  if (tier === 'pro' || tier === 'enterprise') {
    features.push('Advanced AI model access');
    features.push('Persistent brand memory');
  } else if (tier === 'standard') {
    features.push('Standard AI models');
  } else {
    features.push('Limited AI model access');
  }

  if (tier === 'enterprise') {
    features.push('API access & SSO');
    features.push('Dedicated onboarding');
  }

  return features;
}

const TIER_ICONS = {
  starter: Sparkles,
  standard: Star,
  pro: Crown,
  enterprise: Shield,
} as const;

export function PricingCard({
  pkg,
  isCurrent,
  highlighted,
  tier = 'standard',
  onError,
}: PricingCardProps) {
  const features = buildFeatures(pkg, tier);
  const Icon = TIER_ICONS[tier];
  const isEnterprise = tier === 'enterprise';
  const isStarter = tier === 'starter';
  const monthly = pkg.monthlyCredits ?? pkg.credits;

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl p-6 transition-all duration-500 animate-fade-in',
        highlighted
          ? 'border border-primary/40 bg-gradient-to-b from-card via-card to-primary/[0.04] shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.35)] md:scale-[1.02] md:-my-2'
          : isEnterprise
          ? 'border border-foreground/15 bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.02]'
          : isStarter
          ? 'border border-dashed border-border bg-card/30'
          : 'border border-border bg-card/60',
        'hover:border-primary/40 hover:-translate-y-1 hover:shadow-[0_24px_64px_-24px_hsl(var(--primary)/0.35)]'
      )}
    >
      {highlighted && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-primary/20 blur-3xl opacity-60" />
        </div>
      )}

      {pkg.badge && (
        <div
          className={cn(
            'absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-ui font-semibold uppercase tracking-[0.12em]',
            highlighted
              ? 'bg-primary text-primary-foreground shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.7)]'
              : 'bg-foreground text-background'
          )}
        >
          {pkg.badge}
        </div>
      )}

      <div className="relative">
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center',
              highlighted
                ? 'bg-primary/15 text-primary'
                : isEnterprise
                ? 'bg-foreground/10 text-foreground'
                : 'bg-muted/40 text-foreground'
            )}
          >
            <Icon size={16} />
          </div>
          <div>
            <h3 className="font-display text-[17px] leading-none text-foreground">
              {pkg.name}
            </h3>
            {pkg.description && (
              <p className="text-[11px] font-ui text-muted-foreground mt-1 leading-snug max-w-[200px]">
                {pkg.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-baseline gap-1.5 mb-1">
          {isEnterprise && pkg.priceUsd === 0 ? (
            <span className="font-display text-3xl font-semibold text-foreground">
              Custom
            </span>
          ) : (
            <>
              <span className="font-display text-4xl font-semibold text-foreground tracking-tight">
                ${pkg.priceUsd.toFixed(0)}
              </span>
              <span className="text-[12px] font-ui text-muted-foreground">
                {pkg.isSubscription ? '/ month' : 'one-time'}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[12px] font-ui text-muted-foreground">
          <Zap size={11} className="text-primary/70" />
          {monthly.toLocaleString()} credits
          {pkg.isSubscription && monthly ? ' per cycle' : ''}
        </div>
      </div>

      <div className="my-5 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <ul className="flex-1 space-y-2.5 mb-6">
        {features.map((feat, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-[12.5px] font-ui text-foreground/85 leading-snug"
          >
            <span
              className={cn(
                'mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0',
                highlighted
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted/50 text-muted-foreground'
              )}
            >
              <Check size={10} strokeWidth={3} />
            </span>
            {feat}
          </li>
        ))}
      </ul>

      {isStarter && pkg.watermarkExports && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-ui text-amber-500/90 flex items-start gap-2">
          <Layers size={11} className="mt-0.5 flex-shrink-0" />
          Exports include a Kinika watermark.
        </div>
      )}

      {isEnterprise ? (
        <a
          href="mailto:sales@kinika.app?subject=Kinika%20Enterprise"
          className="group inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-gradient-to-br from-foreground to-foreground/80 text-background font-ui text-[13px] font-semibold transition-all hover:-translate-y-[1px] hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)]"
        >
          Contact Sales
        </a>
      ) : (
        <StripeCheckoutButton
          pkg={pkg}
          isCurrent={isCurrent}
          variant={highlighted ? 'primary' : 'outline'}
          onError={onError}
        />
      )}
    </div>
  );
}
