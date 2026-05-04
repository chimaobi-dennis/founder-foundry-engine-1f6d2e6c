import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { BrandContextBar } from "./BrandContextBar";
import { NavigationProgress } from "./NavigationProgress";
import { useBrand } from "@/hooks/use-brand";

const modulePaths = ["/pro-studio", "/content-studio", "/content-calendar", "/library", "/doc-studio", "/reel-builder"];

const fullHeightPaths = ["/mentor", "/content-calendar"];

export function Layout() {
  const location = useLocation();
  const { brands } = useBrand();
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1];
  const isContentStudioBrandRoute = location.pathname.startsWith("/content-studio/") && brands.some((brand) => brand.id === lastSegment);
  const isEditorRoute =
    location.pathname === "/pro-studio/editor" ||
    location.pathname.startsWith("/content-studio/");
  const isContentStudioListRoute =
    location.pathname === "/content-studio" ||
    location.pathname === "/content-studio/new";
  const isContentStudioEditor =
    location.pathname.startsWith("/content-studio/") && !isContentStudioListRoute;
  const showBrandBar = modulePaths.includes(location.pathname) && !isEditorRoute;
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
