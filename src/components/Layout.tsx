import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { BrandContextBar } from "./BrandContextBar";
import { NavigationProgress } from "./NavigationProgress";
import { Analytics } from "@vercel/analytics/react";

const modulePaths = ["/pro-studio", "/content-studio", "/content-calendar", "/library", "/doc-studio", "/reel-builder", "/brand-dna"];

export function Layout() {
  const location = useLocation();
  const isEditorRoute =
    location.pathname === "/pro-studio/editor" ||
    (location.pathname.startsWith("/content-studio/") && location.pathname !== "/content-studio/new");

  // Check if current path matches any module path (with or without brandId suffix)
  const showBrandBar = modulePaths.some(path => {
    if (location.pathname === path) return true;
    if (location.pathname.startsWith(path + "/")) {
      // Check if the next segment is a brandId (not a sub-route like "editor")
      const remainingPath = location.pathname.slice(path.length + 1);
      // Don't show for known sub-routes
      const knownSubRoutes = ["editor", "new"];
      return !knownSubRoutes.some(sub => remainingPath.startsWith(sub));
    }
    return false;
  }) && !isEditorRoute;

  return (
    <div className="h-screen h-dvh flex flex-col overflow-hidden bg-background">
      <NavigationProgress />
      <TopBar />
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden pt-14 md:!pt-0">
          {showBrandBar && (
            <div className="flex-shrink-0">
              <BrandContextBar />
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: "touch" }}>
            <Outlet />
          </div>
        </main>
      </div>
      <Analytics />
    </div>
  );
}
