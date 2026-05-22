import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { BrandContextBar } from "./BrandContextBar";
import { NavigationProgress } from "./NavigationProgress";
import { Analytics } from "@vercel/analytics/react";

const modulePaths = [
  "/pro-studio",
  "/content-studio",
  "/content-calendar",
  "/library",
  "/doc-studio",
  "/reel-builder",
  "/brand-dna",
];

const selfScrollingPaths = [
  "/mentor",
  "/content-calendar",
];

export function Layout() {
  const location = useLocation();

  const isEditorRoute =
    location.pathname === "/pro-studio/editor" ||
    (
      location.pathname.startsWith("/content-studio/") &&
      location.pathname !== "/content-studio/new"
    );

  const showBrandBar =
    modulePaths.some((path) => {
      if (location.pathname === path) return true;

      if (location.pathname.startsWith(path + "/")) {
        const remainingPath = location.pathname.slice(path.length + 1);

        const knownSubRoutes = ["editor", "new"];

        return !knownSubRoutes.some((sub) =>
          remainingPath.startsWith(sub)
        );
      }

      return false;
    }) && !isEditorRoute;

  const isSelfScrolling =
    selfScrollingPaths.some(
      (p) =>
        location.pathname === p ||
        location.pathname.startsWith(p + "/")
    ) || isEditorRoute;

  return (
    <div className="h-[100dvh] overflow-hidden bg-background flex flex-col">

      <NavigationProgress />

      {/* Top App Bar */}
      <div className="flex-shrink-0 z-40">
        <TopBar />
      </div>

      {/* Main App Shell */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Desktop Sidebar */}
        <div className="hidden md:flex flex-shrink-0">
          <AppSidebar />
        </div>

        {/* Main Content */}
        <main className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">

          {/* Brand Context */}
          {showBrandBar && (
            <div className="flex-shrink-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <BrandContextBar />
            </div>
          )}

          {/* Route Content */}
          {isSelfScrolling ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <Outlet />
            </div>
          ) : (
            <div
              className="
                flex-1
                min-h-0
                overflow-y-auto
                overflow-x-hidden
                overscroll-none
                pb-24
              "
              style={{
                WebkitOverflowScrolling: "touch",
              }}
            >
              <Outlet />
            </div>
          )}
        </main>
      </div>

      <Analytics />
    </div>
  );
}