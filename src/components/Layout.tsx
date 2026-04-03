import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { BrandContextBar } from "./BrandContextBar";
import { NavigationProgress } from "./NavigationProgress";

const modulePaths = ["/pro-studio", "/campaign-kit", "/content-calendar", "/library", "/doc-studio", "/reel-builder"];

const fullHeightPaths = ["/mentor", "/content-calendar"];

export function Layout() {
  const location = useLocation();
  const showBrandBar = modulePaths.includes(location.pathname);
  const isFullHeight = fullHeightPaths.includes(location.pathname);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <NavigationProgress />
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar />
        <main className={`flex-1 min-w-0 overflow-x-hidden pb-16 md:pb-0 ${isFullHeight ? "overflow-hidden flex flex-col" : "overflow-y-auto"}`}>
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
  const location = useLocation();
  const showBrandBar = modulePaths.includes(location.pathname);
  const isFullHeight = fullHeightPaths.includes(location.pathname);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar />
        <main className={`flex-1 min-w-0 overflow-x-hidden pb-16 md:pb-0 ${isFullHeight ? "overflow-hidden flex flex-col" : "overflow-y-auto"}`}>
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
