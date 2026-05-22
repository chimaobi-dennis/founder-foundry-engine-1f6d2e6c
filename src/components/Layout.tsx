import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { BrandContextBar } from "./BrandContextBar";
import { NavigationProgress } from "./NavigationProgress";
import { Analytics } from "@vercel/analytics/react";

const modulePaths = ["/pro-studio", "/content-studio", "/content-calendar", "/library", "/doc-studio", "/reel-builder", "/brand-dna"];

// These pages handle their own scrolling internally (3-panel layout)
const selfScrollingPaths = ["/mentor", "/content-calendar"];

export function Layout() {
  const location = useLocation();
  const isEditorRoute =
    location.pathname === "/pro-studio/editor" ||
    (location.pathname.startsWith("/content-studio/") && location.pathname !== "/content-studio/new");

  // Check if current path matches any module path (with or without brandId suffix)
  const showBrandBar = modulePaths.some(path => {
    if (location.pathname === path) return true;
    if (location.pathname.startsWith(path + "/")) {
      const remainingPath = location.pathname.slice(path.length + 1);
      const knownSubRoutes = ["editor", "new"];
      return !knownSubRoutes.some(sub => remainingPath.startsWith(sub));
    }
    return false;
  }) && !isEditorRoute;

  // Check if this page handles its own scrolling (3-panel layout)
  const isSelfScrolling = selfScrollingPaths.some(p =>
    location.pathname === p || location.pathname.startsWith(p + "/")
  ) || isEditorRoute;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background relative">
      {/* NavigationProgress at top level */}
      <NavigationProgress />

      {/* ── Mobile Layout (< md): Stacked with natural scroll ── */}
      <div className="md:hidden flex flex-col h-full">
        {/* TopBar - sticky at top */}
        <div className="flex-shrink-0 safe-top z-50">
          <TopBar />
        </div>

        {/* BrandContextBar - below TopBar */}
        {showBrandBar && (
          <div className="flex-shrink-0 z-40">
            <BrandContextBar />
          </div>
        )}

        {/* Scrollable content area - fills remaining space */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative z-0" style={{ WebkitOverflowScrolling: "touch" }}>
          {isSelfScrolling ? (
            <div className="h-full overflow-hidden">
              <Outlet />
            </div>
          ) : (
            <div className="pb-16">
              <Outlet />
            </div>
          )}
        </main>

        {/* Mobile bottom nav - fixed at bottom */}
        <div className="flex-shrink-0 safe-bottom z-50">
          <AppSidebar />
        </div>
      </div>

      {/* ── Desktop Layout (>= md): Sidebar + content ── */}
      <div className="hidden md:flex flex-col h-full">
        {/* TopBar */}
        <div className="flex-shrink-0 safe-top z-50">
          <TopBar />
        </div>

        {/* BrandContextBar */}
        {showBrandBar && (
          <div className="flex-shrink-0 relative z-40">
            <BrandContextBar />
          </div>
        )}

        {/* Main area with sidebar */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative z-0">
          <AppSidebar />
          <main className="flex-1 min-w-0 min-h-0 flex flex-col relative">
            {isSelfScrolling ? (
              <div className="flex-1 min-h-0 overflow-hidden">
                <Outlet />
              </div>
            ) : (
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

      <Analytics />
    </div>
  );
}
