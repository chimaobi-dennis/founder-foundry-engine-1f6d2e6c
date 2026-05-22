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

      {/* TopBar - fixed z-50, safe area for notch */}
      <div className="z-50 flex-shrink-0 safe-top">
        <TopBar />
      </div>

      {/* Main app area - flex row with sidebar and content */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative z-10">
        {/* Desktop/Tablet Sidebar - not rendered on mobile */}
        <AppSidebar />

        {/* Main content area - no overflow here, content scrolls internally */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col relative">
          {/* BrandContextBar - z-50 to float above content */}
          {showBrandBar && (
            <div className="flex-shrink-0 z-50 relative">
              <BrandContextBar />
            </div>
          )}

          {/* Scrollable content region */}
          {isSelfScrolling ? (
            // Self-scrolling pages handle their own scroll (Mentor, ContentCalendar)
            <div className="flex-1 min-h-0 overflow-hidden">
              <Outlet />
            </div>
          ) : (
            // Regular pages scroll in this single container
            <div
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <Outlet />
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav - fixed at bottom with z-40 */}
      <div className="z-40 flex-shrink-0 md:hidden safe-bottom">
        {/* Spacer handled by AppSidebar positioning */}
      </div>

      <Analytics />
    </div>
  );
}
