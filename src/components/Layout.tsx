import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { BrandContextBar } from "./BrandContextBar";
import { useViewport } from "@/hooks/use-viewport";
import { NavigationProgress } from "./NavigationProgress";
import { Analytics } from "@vercel/analytics/react";

const modulePaths = ["/pro-studio", "/content-studio", "/content-calendar", "/library", "/doc-studio", "/reel-builder", "/brand-dna"];

// Workspace pages handle their own internal layout (Mentor, ContentCalendar)
const workspacePaths = ["/mentor", "/content-calendar"];

/**
 * Layout - Main application layout using shell architecture
 * Clean separation: no viewport mixing, no conditional overflow hacks
 */
export function Layout() {
  const location = useLocation();
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

  const isWorkspace = workspacePaths.some(p =>
    location.pathname === p || location.pathname.startsWith(p + "/")
  );

  return (
    <>
      <NavigationProgress />

      {isMobile ? (
        <MobileLayout showBrandBar={showBrandBar} isWorkspace={isWorkspace} />
      ) : (
        <DesktopLayout showBrandBar={showBrandBar} isWorkspace={isWorkspace} />
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
  isWorkspace: boolean;
}

function MobileLayout({ showBrandBar, isWorkspace }: MobileLayoutProps) {
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

      {/* Content area - single scroll container */}
      <main
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {isWorkspace ? (
          // Workspace pages handle their own internal scroll
          <div className="h-full overflow-hidden">
            <Outlet />
          </div>
        ) : (
          // Regular pages scroll naturally
          <div className="pb-20">
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
  isWorkspace: boolean;
}

function DesktopLayout({ showBrandBar, isWorkspace }: DesktopLayoutProps) {
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

        {/* Content */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col relative">
          {isWorkspace ? (
            // Workspace: Page handles internal layout (3-panel)
            <div className="flex-1 min-h-0 overflow-hidden">
              <Outlet />
            </div>
          ) : (
            // Regular: Single scroll container
            <div
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
