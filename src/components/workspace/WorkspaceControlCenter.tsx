import { useNavigate, useLocation } from 'react-router-dom';
import { MobileBottomSheet } from '@/components/ui/MobileBottomSheet';
import { useState, forwardRef } from 'react';
import {
  LogOut, Shield, ChevronRight, Sparkles, Clock,
  Settings, Receipt, CreditCard, Headphones,
  FileText, Cpu, BarChart3, Palette, Sliders,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/use-profile';
import { useBrand } from '@/hooks/use-brand';
import { useCreatorApplication } from '@/hooks/use-creator-application';
import { useCreditBalance } from '@/hooks/use-credit-balance';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePricingModal } from '@/contexts/PricingModalContext';
import { WalletHeroCard } from './WalletHeroCard';
import { WorkspaceSwitcherCompact } from './WorkspaceSwitcherCompact';
import { UsageAnalyticsCard } from './UsageAnalyticsCard';
import { BillingHubDrawer } from './BillingHubDrawer';

// ═══════════════════════════════════════════════════════════════
// SECTION CONFIG
// ═══════════════════════════════════════════════════════════════

interface MenuItem {
  label: string;
  icon: typeof Settings;
  action: 'navigate' | 'callback';
  path?: string;
  callback?: () => void;
  badge?: string;
}

interface Section {
  label: string;
  items: MenuItem[];
}

const BRAND_SCOPED_BASES = new Set([
  'mentor', 'pro-studio', 'content-studio', 'content-calendar',
  'doc-studio', 'reel-builder', 'library', 'brand-dna',
]);

// ═══════════════════════════════════════════════════════════════
// WORKSPACE CONTROL CENTER
// ═══════════════════════════════════════════════════════════════

interface WorkspaceControlCenterProps {
  open: boolean;
  onClose: () => void;
}

export const WorkspaceControlCenter = forwardRef<HTMLDivElement, WorkspaceControlCenterProps>(
  function WorkspaceControlCenter({ open, onClose }, ref) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, signOut } = useAuth();
    const { profile } = useProfile();
    const { brands, activeBrand, switchBrand } = useBrand();
    const { application: creatorApp } = useCreatorApplication();
    const { balance, wallet, loading: walletLoading } = useCreditBalance();
    const isMobile = useIsMobile();
    const { openPricingModal } = usePricingModal();
    const [showBillingHub, setShowBillingHub] = useState(false);

    const fullName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    const email = user?.email || '';

    const handleNav = (path: string) => {
      onClose();
      navigate(path);
    };

    const handleOpenBillingHub = () => {
      onClose();
      setShowBillingHub(true);
    };

    const handleBrandSwitch = async (brandId: string) => {
      await switchBrand(brandId);
      const pathSegments = location.pathname.split('/');
      const moduleKey = pathSegments[1];
      const currentLast = pathSegments[pathSegments.length - 1];
      const lastIsBrand = brands.some((b) => b.id === currentLast);
      if (BRAND_SCOPED_BASES.has(moduleKey) && pathSegments.length >= 3 && lastIsBrand) {
        pathSegments[pathSegments.length - 1] = brandId;
        navigate(`${pathSegments.join('/')}${location.search}`, { replace: true });
      }
    };

    // Build sections
    const sections: Section[] = [
      {
        label: 'BILLING',
        items: [
          { label: 'Usage & Transactions', icon: BarChart3, action: 'callback', callback: handleOpenBillingHub },
          { label: 'Billing History', icon: Receipt, action: 'navigate', path: '/billing' },
          { label: 'Buy Credits', icon: CreditCard, action: 'callback', callback: () => { onClose(); openPricingModal({ currentBalance: balance }); } },
        ],
      },
      {
        label: 'STUDIO',
        items: [
          { label: 'AI Configuration', icon: Cpu, action: 'navigate', path: '/settings/ai-models' },
          { label: 'Brand DNA', icon: Palette, action: 'navigate', path: '/brand-dna' },
          { label: 'Preferences', icon: Sliders, action: 'navigate', path: '/settings/ai-models' },
        ],
      },
      {
        label: 'ACCOUNT',
        items: [
          { label: 'Account Settings', icon: Settings, action: 'navigate', path: '/settings/ai-models' },
          ...(profile?.role === 'admin' ? [{
            label: 'Admin Panel', icon: Shield, action: 'navigate' as const, path: '/admin',
          }] : []),
          ...(profile?.role === 'founder' && !creatorApp ? [{
            label: 'Become a Creator', icon: Sparkles, action: 'navigate' as const, path: '/creator/apply',
          }] : []),
          ...(profile?.role === 'founder' && creatorApp?.status === 'pending' ? [{
            label: 'Application Pending', icon: Clock, action: 'navigate' as const, path: '#',
            badge: 'Pending',
          }] : []),
        ],
      },
      {
        label: 'SUPPORT',
        items: [
          { label: 'Help Center', icon: Headphones, action: 'navigate', path: '#' },
          { label: 'Terms & Privacy', icon: FileText, action: 'navigate', path: '#' },
        ],
      },
    ];

    const body = (
      <>
        {/* Identity header */}
        <div className="sticky top-0 z-10 bg-card px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-ui font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-display text-[14px] text-foreground leading-tight">{fullName}</p>
                {profile?.role && (
                  <span
                    className="text-[9px] font-ui font-semibold uppercase tracking-wider px-1.5 py-[1px] rounded-full"
                    style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}
                  >
                    {profile.role === 'admin' ? 'Admin' : 'Pro'}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-ui text-muted-foreground truncate">{email}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          <style>{`div[style*="scrollbar-width: none"]::-webkit-scrollbar { display: none; }`}</style>

          {/* Wallet Hero */}
          <div className="pt-3 pb-2">
            <WalletHeroCard
              wallet={wallet}
              loading={walletLoading}
              onBuyCredits={() => { onClose(); openPricingModal({ currentBalance: balance }); }}
              onViewBilling={handleOpenBillingHub}
            />
          </div>

          {/* Usage Analytics */}
          {!walletLoading && (
            <div className="pb-2">
              <UsageAnalyticsCard wallet={wallet} />
            </div>
          )}

          {/* Workspace Switcher */}
          {brands.length > 0 && (
            <>
              <div className="border-t border-border" />
              <div className="py-2">
                <p className="text-[10px] font-ui uppercase tracking-[0.1em] text-muted-foreground px-6 mb-1">
                  Workspace
                </p>
                <WorkspaceSwitcherCompact
                  brands={brands}
                  activeBrandId={activeBrand?.id ?? null}
                  onSwitch={handleBrandSwitch}
                />
              </div>
            </>
          )}

          <div className="border-t border-border" />

          {/* Grouped sections */}
          {sections.map((section) => (
            <div key={section.label}>
              <p className="text-[10px] font-ui uppercase tracking-[0.1em] text-muted-foreground px-5 pt-3 pb-1">
                {section.label}
              </p>
              <div className="pb-1">
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      if (item.action === 'navigate' && item.path && item.path !== '#') {
                        handleNav(item.path);
                      } else if (item.action === 'callback' && item.callback) {
                        item.callback();
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-5 py-2 text-[13px] font-ui text-foreground hover:bg-muted/30 transition-colors duration-150"
                  >
                    <item.icon size={14} className="text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-ui font-medium"
                            style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight size={11} className="text-muted-foreground/40" />
                  </button>
                ))}
              </div>
              <div className="border-t border-border" />
            </div>
          ))}

          {/* Sign out */}
          <button
            onClick={async () => {
              onClose();
              await signOut();
              navigate('/sign-in');
            }}
            className="w-full flex items-center gap-2.5 px-5 py-3 text-[13px] font-ui text-destructive hover:bg-destructive/10 transition-colors duration-150"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>

      </>
    );

    const panel = (() => {
      if (!open) return null;

      if (isMobile) {
        return (
          <MobileBottomSheet open={open} onClose={onClose}>
            {body}
          </MobileBottomSheet>
        );
      }

      return (
        <div
          ref={ref}
          className="absolute z-50 bg-card border border-card-border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 top-12 right-0 w-[320px] rounded-2xl flex flex-col"
          style={{ maxHeight: '85vh' }}
        >
          {body}
        </div>
      );
    })();

    return (
      <>
        {panel}
        <BillingHubDrawer
          open={showBillingHub}
          onClose={() => setShowBillingHub(false)}
        />
      </>
    );
  }
);
