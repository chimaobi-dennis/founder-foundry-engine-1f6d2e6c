import { Outlet, useLocation, Navigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { BrandContextBar } from "./BrandContextBar";
import { useBrand } from "@/hooks/use-brand";
import { useViewport } from "@/hooks/use-viewport";
import { NavigationProgress } from "./NavigationProgress";
import { Analytics } from "@vercel/analytics/react";

const modulePaths = ["/pro-studio", "/content-studio", "/content-calendar", "/library", "/doc-studio", "/reel-builder", "/brand-dna"];

/**
 * Layout - Main application layout using shell architecture
 * Clean separation: no viewport mixing, no conditional overflow hacks
 */
export function Layout() {
  const location = useLocation();
  const { activeBrand, isLoading: brandLoading } = useBrand();
  const { isMobile } = useViewport();

  // Determine which UI elements to show
  const isEditorRoute =
    location.pathname === "/pro-studio/editor" ||
    (location.pathname.startsWith("/content-studio/") && location.pathname !== "/content-studio/new");

  const showBrandBar = modulePaths.some(path => {
    if (location.pathname === path) return true;
    if (location.pathname.startsWith(path + "/")) {
      const remainingPath = location.pathname.slice(path.length + 1);
      const knownSubRoutes = ["editor", "new"];
      return !knownSubRoutes.some(sub => remainingPath.startsWith(sub));
    }
    return false;
  }) && !isEditorRoute;

  // Understanding first: a brand that has not been read back and approved
  // goes to /start. Brands from before this rule (onboarding_completed) are
  // not blocked; Home offers the read-back once instead.
  if (!brandLoading && activeBrand && !activeBrand.understanding_approved_at && activeBrand.onboarding_completed === false && !activeBrand.onboarding_skipped) {
    return <Navigate to={`/start?brand=${activeBrand.id}`} replace />;
  }

  return (
    <>
      <NavigationProgress />

      {isMobile ? (
        <MobileLayout showBrandBar={showBrandBar} isEditor={isEditorRoute} />
      ) : (
        <DesktopLayout showBrandBar={showBrandBar} isEditor={isEditorRoute} />
      )}

      <Analytics />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE LAYOUT - Independent mobile shell
// ─────────────────────────────────────────────────────────────────────────────

interface MobileLayoutProps {
  showBrandBar: boolean;
  isEditor?: boolean;
}

function MobileLayout({ showBrandBar, isEditor }: MobileLayoutProps) {
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background">
      {/* TopBar - sticky at top */}
      <div className="flex-shrink-0 safe-top">
        <TopBar />
      </div>

      {/* BrandBar - sits below TopBar */}
      {showBrandBar && (
        <div className="flex-shrink-0">
          <BrandContextBar />
        </div>
      )}

      {/* Content area - single scroll container (disabled for editors) */}
      <main
        className={`flex-1 min-h-0 ${isEditor ? 'overflow-hidden' : 'overflow-y-auto'} overflow-x-hidden relative`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {isEditor ? <Outlet /> : (
          <div className="min-h-full pb-20">
            <Outlet />
          </div>
        )}
      </main>

      {/* Bottom nav - at bottom of flex flow */}
      <div className="flex-shrink-0 safe-bottom">
        <AppSidebar />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP LAYOUT - Independent desktop shell
// ─────────────────────────────────────────────────────────────────────────────

interface DesktopLayoutProps {
  showBrandBar: boolean;
  isEditor?: boolean;
}

function DesktopLayout({ showBrandBar, isEditor }: DesktopLayoutProps) {
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background">
      {/* TopBar */}
      <div className="flex-shrink-0 safe-top">
        <TopBar />
      </div>

      {/* BrandBar */}
      {showBrandBar && (
        <div className="flex-shrink-0">
          <BrandContextBar />
        </div>
      )}

      {/* Main area: Sidebar + Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Desktop Sidebar */}
        <AppSidebar />

        {/* Content - scroll container (disabled for editors) */}
        <main
          className={`flex-1 min-w-0 min-h-0 ${isEditor ? 'overflow-hidden' : 'overflow-y-auto'} overflow-x-hidden relative`}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
