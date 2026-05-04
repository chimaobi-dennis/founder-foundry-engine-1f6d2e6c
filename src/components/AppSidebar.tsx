import { Home, MessageCircle, Camera, Megaphone, Calendar, FileText, Film, Layers, Shield, Palette, ChevronLeft, ChevronRight, MoreHorizontal, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useProfile } from "@/hooks/use-profile";
import { useBrand } from "@/hooks/use-brand";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

const moduleItems = [
  { label: "Home", icon: Home, path: "/" },
  { label: "Mentor", icon: MessageCircle, path: "/mentor" },
  { label: "ProStudio", icon: Camera, path: "/pro-studio" },
  { label: "ContentStudio", icon: Megaphone, path: "/content-studio" },
  { label: "ContentCalendar", icon: Calendar, path: "/content-calendar" },
  { label: "DocStudio", icon: FileText, path: "/doc-studio" },
  { label: "ReelBuilder", icon: Film, path: "/reel-builder" },
];

const secondaryItems = [
  { label: "Library", icon: Layers, path: "/library" },
  { label: "Brand DNA", icon: Shield, path: "/brand-dna" },
];

const creatorItem = { label: "Creator Studio", icon: Palette, path: "/creator" };
// Admin is now a separate shell at /admin, no sidebar item needed here

const mobileVisibleItems = moduleItems.slice(0, 5); // Home, Mentor, ProStudio, ContentStudio, ContentCalendar
const mobileDrawerItems = [...moduleItems.slice(5), ...secondaryItems]; // DocStudio, ReelBuilder, Library, Brand DNA

const BRAND_SCOPED_PATHS = new Set(["/mentor", "/pro-studio", "/content-calendar", "/doc-studio", "/reel-builder", "/library", "/brand-dna"]);

export function AppSidebar() {
  const location = useLocation();
  const { profile } = useProfile();
  const { activeBrand } = useBrand();
  const resolvePath = (path: string) =>
    BRAND_SCOPED_PATHS.has(path) && activeBrand?.id ? `${path}/${activeBrand.id}` : path;
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");
  const showCreator = profile?.role === "creator" || profile?.role === "admin";
  
  const [moreOpen, setMoreOpen] = useState(false);

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const renderNavItem = (item: typeof moduleItems[0], showLabel: boolean) => {
    const active = isActive(item.path);
    return (
      <NavLink
        key={item.path}
        to={resolvePath(item.path)}
        className={`
          flex items-center ${showLabel ? "gap-3" : "justify-center"} px-3 py-2.5 rounded-md text-sm font-ui
          transition-all duration-200 ease-in-out group relative
          ${active
            ? "text-primary border-l-2 border-primary bg-[hsl(var(--active-tint))]"
            : "text-muted-foreground hover:text-foreground border-l-2 border-transparent"
          }
        `}
      >
        <item.icon size={showLabel ? 18 : 20} className={active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"} />
        {showLabel && <span>{item.label}</span>}
      </NavLink>
    );
  };

  const renderTooltipItem = (item: typeof moduleItems[0]) => {
    const active = isActive(item.path);
    return (
      <Tooltip key={item.path} delayDuration={0}>
        <TooltipTrigger asChild>
          <NavLink
            to={resolvePath(item.path)}
            className={`
              flex items-center justify-center w-full py-2.5 rounded-md
              transition-all duration-200 ease-in-out
              ${active
                ? "text-primary border-l-2 border-primary bg-[hsl(var(--active-tint))]"
                : "text-muted-foreground hover:text-foreground border-l-2 border-transparent"
              }
            `}
          >
            <item.icon size={20} />
          </NavLink>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p className="font-ui text-sm">{item.label}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  const dividerClass = "my-2 mx-4 h-px bg-[#2A3A4A]";

  return (
    <>
      {/* ── Desktop sidebar (>1024px): collapsible ── */}
      <aside
        className={`hidden lg:flex z-40 h-full flex-col bg-sidebar border-r border-transparent relative flex-shrink-0 transition-all duration-200 ease-in-out ${collapsed ? "w-16" : "w-[220px]"}`}
      >
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-primary/40 to-transparent" />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-3 right-2 z-10 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <nav className="flex-1 pt-10 px-2 space-y-1">
          {collapsed
            ? moduleItems.map((item) => renderTooltipItem(item))
            : moduleItems.map((item) => renderNavItem(item, true))
          }
          <div className={dividerClass} />
          {collapsed
            ? secondaryItems.map((item) => renderTooltipItem(item))
            : secondaryItems.map((item) => renderNavItem(item, true))
          }
          {showCreator && (
            <>
              <div className={dividerClass} />
              {collapsed ? renderTooltipItem(creatorItem) : renderNavItem(creatorItem, true)}
            </>
          )}
        </nav>
        <div className={`px-4 py-4 border-t border-border flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-ui font-semibold flex-shrink-0">CK</div>
          {!collapsed && <span className="text-muted-foreground text-[13px] font-ui">Chimaobi K.</span>}
        </div>
      </aside>

      {/* ── Tablet sidebar (768–1024px): icon-only 64px ── */}
      <aside className="hidden md:flex lg:hidden z-40 h-full w-16 flex-col items-center bg-sidebar border-r border-transparent relative flex-shrink-0">
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-primary/40 to-transparent" />
        <nav className="flex-1 pt-6 space-y-1 w-full px-2">
          {moduleItems.map((item) => renderTooltipItem(item))}
          <div className={dividerClass} />
          {secondaryItems.map((item) => renderTooltipItem(item))}
          {showCreator && (
            <>
              <div className={dividerClass} />
              {renderTooltipItem(creatorItem)}
            </>
          )}
        </nav>
        <div className="py-4 flex justify-center">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-ui font-semibold">CK</div>
        </div>
      </aside>

      {/* ── Mobile bottom nav (<768px) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border flex items-center justify-around px-2 py-2">
        {mobileVisibleItems.map((item) => {
          const active = isActive(item.path);
          return (
            <NavLink
              key={item.path}
              to={resolvePath(item.path)}
              className={`
                flex flex-col items-center justify-center p-1.5 rounded-md
                transition-all duration-200
                ${active ? "text-primary" : "text-muted-foreground"}
              `}
            >
              <item.icon size={20} />
            </NavLink>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center p-1.5 rounded-md transition-all duration-200 ${
            [...mobileDrawerItems, ...(showCreator ? [creatorItem] : [])].some((i) => isActive(i.path)) ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <MoreHorizontal size={20} />
        </button>
      </nav>

      {/* ── Mobile "More" drawer ── */}
      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent className="pb-8">
          <VisuallyHidden.Root><DrawerTitle>More</DrawerTitle></VisuallyHidden.Root>
          <div className="px-4 pt-2 space-y-1">
            {[...mobileDrawerItems, ...(showCreator ? [creatorItem] : [])].map((item) => {
              const active = isActive(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={resolvePath(item.path)}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm font-ui transition-colors ${
                    active
                      ? "text-primary bg-[hsl(var(--active-tint))]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon size={18} className={active ? "text-primary" : "text-muted-foreground"} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
