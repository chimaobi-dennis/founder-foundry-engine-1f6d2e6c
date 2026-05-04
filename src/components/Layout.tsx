import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { BrandContextBar } from "./BrandContextBar";
import { NavigationProgress } from "./NavigationProgress";

const modulePaths = ["/mentor", "/pro-studio", "/content-studio", "/content-calendar", "/library", "/doc-studio", "/reel-builder", "/brand-dna"];

const fullHeightPaths = ["/mentor", "/content-calendar"];

export function Layout() {
  const location = useLocation();
  const isEditorRoute =
    location.pathname === "/pro-studio/editor" ||
    (location.pathname.startsWith("/content-studio/") && location.pathname !== "/content-studio/new");
  const isContentStudioListRoute =
    location.pathname === "/content-studio" ||
    location.pathname === "/content-studio/new" ||
    (location.pathname.startsWith("/content-studio/") && !isEditorRoute);
  const isContentStudioEditor =
    location.pathname.startsWith("/content-studio/") && !isContentStudioListRoute;
  
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
  
  const isFullHeight = fullHeightPaths.includes(location.pathname) || isEditorRoute;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <NavigationProgress />
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar />
        <main className={`flex-1 min-w-0 overflow-x-hidden pb-16 md:pb-0 ${isFullHeight ? "h-full overflow-hidden flex flex-col" : "overflow-y-auto"}`}>
          {showBrandBar && (
            <div className="sticky top-0 z-10 relative">
              <BrandContextBar />
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
