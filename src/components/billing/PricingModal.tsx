import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Coins, Sparkles, Loader2, Shield, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreditPackages } from '@/hooks/useCreditPackages';
import { usePricingModal } from '@/contexts/PricingModalContext';
import type { CreditPackage } from '@/services/stripeService';
import { PricingCard } from './PricingCard';
import { FeatureComparison } from './FeatureComparison';

type BillingCycle = 'monthly' | 'yearly';

/**
 * Visual tier classification only — backend remains the source of truth.
 */
function tierOf(pkg: CreditPackage): 'starter' | 'standard' | 'pro' | 'enterprise' {
  const key = (pkg.slug || pkg.name || '').toLowerCase();
  if (/enterprise|custom|scale/.test(key)) return 'enterprise';
  if (/pro|premium|studio/.test(key)) return 'pro';
  if (/free|trial|starter/.test(key) && pkg.priceUsd === 0) return 'starter';
  return 'standard';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSS keyframes injected once
// ═══════════════════════════════════════════════════════════════════════════════
const ANIMATION_STYLES = `
@keyframes pricing-backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes pricing-modal-in {
  from { opacity: 0; transform: scale(0.97) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
`;

/**
 * PricingModal — rendered once at the application root via <PricingModalPortal />.
 *
 * Architecture:
 * - Mounts through React Portal to document.body
 * - State managed by PricingModalContext (independent of any dropdown)
 * - Backdrop z-[900], modal container z-[1000]
 * - Body scroll locked while open
 * - Pointer-events disabled on app shell, enabled only on modal
 * - Focus trapped inside modal
 * - ESC closes, backdrop click closes, content click does NOT close
 */
export function PricingModal() {
  const { isOpen, closePricingModal, _state } = usePricingModal();
  const { currentBalance, currentPlanSlug, currentPlanName } = _state;

  const { packages, loading, error, refresh } = useCreditPackages(isOpen);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // ── Scroll lock + pointer-events isolation ────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevPointerEvents = document.body.style.pointerEvents;
    document.body.style.overflow = 'hidden';
    document.body.style.pointerEvents = 'none';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.pointerEvents = prevPointerEvents;
    };
  }, [isOpen]);

  // ── ESC key ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closePricingModal();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, closePricingModal]);

  // ── Focus trap ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    // Focus the modal container
    requestAnimationFrame(() => modalRef.current?.focus());
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onTab, true);
    return () => window.removeEventListener('keydown', onTab, true);
  }, [isOpen]);

  const highlightedId = useMemo(() => {
    const popular = packages.find((p) =>
      (p.badge || '').toLowerCase().includes('popular')
    );
    if (popular) return popular.id;
    const subs = packages.filter((p) => p.isSubscription && p.priceUsd > 0 && !p.addonKind);
    if (subs.length >= 2) {
      const sorted = [...subs].sort((a, b) => a.priceUsd - b.priceUsd);
      return sorted[Math.floor(sorted.length / 2)].id;
    }
    return subs[0]?.id ?? packages[1]?.id ?? null;
  }, [packages]);

  if (!isOpen) return null;

  const estimatedGenerations =
    currentBalance != null ? Math.floor(currentBalance / 10) : null;

  const portal = (
    <>
      <style>{ANIMATION_STYLES}</style>

      {/* ── Backdrop — z-[900] ── */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xl"
        style={{
          zIndex: 900,
          pointerEvents: 'auto',
          animation: 'pricing-backdrop-in 300ms ease-out forwards',
        }}
        onClick={closePricingModal}
        aria-hidden="true"
      />

      {/* ── Modal container — z-[1000] ── */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Pricing plans"
        tabIndex={-1}
        className="fixed inset-0 flex items-stretch justify-center overflow-hidden outline-none"
        style={{
          zIndex: 1000,
          pointerEvents: 'auto',
          animation: 'pricing-modal-in 400ms ease-out forwards',
        }}
        onClick={(e) => {
          // Only close when clicking the transparent area around the content
          if (e.target === e.currentTarget) closePricingModal();
        }}
      >
        {/* Gradient orbs (decorative) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-[-15%] left-[10%] w-[40rem] h-[40rem] rounded-full bg-primary/10 blur-[120px] animate-pulse" />
          <div
            className="absolute bottom-[-20%] right-[5%] w-[36rem] h-[36rem] rounded-full bg-amber-500/[0.08] blur-[120px] animate-pulse"
            style={{ animationDelay: '2s' }}
          />
          <div className="absolute top-1/3 right-1/4 w-[24rem] h-[24rem] rounded-full bg-foreground/5 blur-[100px]" />
        </div>

        {/* Grid texture (decorative) */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* ── Scrollable content — stops propagation ── */}
        <div
          className="relative w-full h-full flex flex-col overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top bar */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 md:px-10 py-5 backdrop-blur-md bg-background/40 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                <Sparkles size={15} className="text-primary" />
              </div>
              <div>
                <p className="font-display text-[15px] text-foreground leading-none">
                  Kinika Plans
                </p>
                <p className="text-[11px] font-ui text-muted-foreground mt-1">
                  Subscription · Credits · Workspaces
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {currentBalance != null && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/40 text-[12px] font-ui">
                  <Coins size={12} className="text-primary" />
                  <span className="text-muted-foreground">Balance</span>
                  <span className="font-semibold text-foreground">
                    {currentBalance.toLocaleString()}
                  </span>
                  {currentPlanName && (
                    <>
                      <span className="text-border">·</span>
                      <span className="text-foreground">{currentPlanName}</span>
                    </>
                  )}
                </div>
              )}
              <button
                onClick={closePricingModal}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Hero */}
          <div className="px-6 md:px-10 pt-10 md:pt-16 pb-6 md:pb-10 text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-card/40 text-[10px] font-ui uppercase tracking-[0.18em] text-muted-foreground mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Pricing · 2026
            </div>
            <h1 className="font-display text-3xl md:text-5xl leading-[1.1] text-foreground tracking-tight">
              Choose your creative
              <br />
              <span className="italic text-primary">operating system.</span>
            </h1>
            <p className="mt-5 text-[13.5px] md:text-[14.5px] font-ui text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Credits power generation, editing, exports and AI-assisted workflows
              across every Kinika module — Mentor, ProStudio, CampaignKit,
              ContentCalendar, DocStudio and ReelBuilder.
            </p>

            {(currentBalance != null || currentPlanName) && (
              <div className="mt-7 inline-flex flex-wrap items-center justify-center gap-6 px-5 py-3 rounded-2xl border border-border bg-card/30">
                {currentBalance != null && (
                  <div className="text-left">
                    <p className="text-[10px] font-ui uppercase tracking-wider text-muted-foreground">
                      Available
                    </p>
                    <p className="font-display text-lg text-foreground">
                      {currentBalance.toLocaleString()}{' '}
                      <span className="text-[11px] font-ui text-muted-foreground">
                        credits
                      </span>
                    </p>
                  </div>
                )}
                {estimatedGenerations != null && (
                  <>
                    <div className="w-px h-8 bg-border" />
                    <div className="text-left">
                      <p className="text-[10px] font-ui uppercase tracking-wider text-muted-foreground">
                        Est. generations
                      </p>
                      <p className="font-display text-lg text-foreground">
                        ~{estimatedGenerations.toLocaleString()}
                      </p>
                    </div>
                  </>
                )}
                {currentPlanName && (
                  <>
                    <div className="w-px h-8 bg-border" />
                    <div className="text-left">
                      <p className="text-[10px] font-ui uppercase tracking-wider text-muted-foreground">
                        Plan
                      </p>
                      <p className="font-display text-lg text-foreground">
                        {currentPlanName}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="mt-7 inline-flex items-center p-1 rounded-full border border-border bg-card/40">
              {(['monthly', 'yearly'] as BillingCycle[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={cn(
                    'relative h-8 px-4 rounded-full text-[12px] font-ui font-medium capitalize transition-colors',
                    cycle === c
                      ? 'text-background bg-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {c}
                  {c === 'yearly' && (
                    <span className="ml-1.5 text-[9px] font-ui font-semibold uppercase tracking-wider text-primary">
                      −20%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Plans grid + right rail */}
          <div className="px-6 md:px-10 pb-10 max-w-[1400px] w-full mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-10">
            <div>
              {checkoutError && (
                <div className="mb-4 px-4 py-3 rounded-xl border border-destructive/40 bg-destructive/5 text-[12px] font-ui text-destructive">
                  {checkoutError}
                </div>
              )}

              {loading ? (
                <PricingSkeletonGrid />
              ) : error ? (
                <FallbackPanel
                  title="Couldn't load plans"
                  body={error}
                  onRetry={refresh}
                />
              ) : packages.length === 0 ? (
                <FallbackPanel
                  title="No plans available"
                  body="Plans are being configured. Please check back shortly."
                  onRetry={refresh}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch">
                  {packages.map((pkg) => {
                    const tier = tierOf(pkg);
                    const isCurrent =
                      !!currentPlanSlug &&
                      (pkg.slug === currentPlanSlug || pkg.id === currentPlanSlug);
                    return (
                      <PricingCard
                        key={pkg.id}
                        pkg={pkg}
                        tier={tier}
                        isCurrent={isCurrent}
                        highlighted={pkg.id === highlightedId}
                        onError={setCheckoutError}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="hidden lg:block space-y-6 sticky top-24 self-start">
              <FeatureComparison />

              <div className="rounded-2xl border border-border bg-card/40 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lock size={13} className="text-muted-foreground" />
                  <p className="text-[12px] font-ui font-semibold text-foreground">
                    Billing summary
                  </p>
                </div>
                <ul className="space-y-2 text-[12px] font-ui text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/50 mt-2 flex-shrink-0" />
                    Charged monthly in USD via Stripe.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/50 mt-2 flex-shrink-0" />
                    Cancel any time — access lasts until the cycle ends.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/50 mt-2 flex-shrink-0" />
                    Unused credits behave per plan rollover rules.
                  </li>
                </ul>
              </div>
            </aside>
          </div>

          {/* Footer */}
          <div className="mt-auto px-6 md:px-10 py-6 border-t border-border/40 backdrop-blur-md bg-background/40">
            <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-[11.5px] font-ui text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield size={12} className="text-emerald-500" />
                Secure payments powered by Stripe — your card details never touch
                Kinika.
              </div>
              <div className="flex items-center gap-4">
                <a href="/terms" className="hover:text-foreground transition-colors">
                  Terms
                </a>
                <a href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy
                </a>
                <a
                  href="mailto:support@kinika.app"
                  className="hover:text-foreground transition-colors"
                >
                  Cancellation policy
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(portal, document.body);
}

/**
 * Mount this once at the app root. It reads from PricingModalContext.
 */
export function PricingModalPortal() {
  return <PricingModal />;
}

function PricingSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-card/40 p-6 animate-pulse"
        >
          <div className="h-9 w-9 rounded-xl bg-muted mb-4" />
          <div className="h-4 w-24 bg-muted rounded mb-2" />
          <div className="h-3 w-40 bg-muted/70 rounded mb-6" />
          <div className="h-10 w-32 bg-muted rounded mb-2" />
          <div className="h-3 w-28 bg-muted/70 rounded mb-6" />
          <div className="space-y-2.5">
            {[0, 1, 2, 3, 4].map((j) => (
              <div key={j} className="h-3 w-full bg-muted/60 rounded" />
            ))}
          </div>
          <div className="h-11 w-full bg-muted rounded-xl mt-6" />
        </div>
      ))}
    </div>
  );
}

function FallbackPanel({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
      <Loader2 size={20} className="mx-auto text-muted-foreground/40 mb-3" />
      <h3 className="font-display text-[16px] text-foreground mb-1">{title}</h3>
      <p className="text-[12px] font-ui text-muted-foreground mb-4">{body}</p>
      <button
        onClick={onRetry}
        className="h-9 px-4 rounded-lg border border-border text-[12px] font-ui hover:border-primary/40 hover:bg-primary/5 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
