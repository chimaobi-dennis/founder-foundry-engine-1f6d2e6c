import { Home, MessageCircle, Camera, Megaphone, Calendar, FolderOpen, FileText, Film, Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { label: "Home", icon: Home, path: "/" },
  { label: "Mentor", icon: MessageCircle, path: "/mentor" },
  { label: "ProStudio", icon: Camera, path: "/pro-studio" },
  { label: "CampaignKit", icon: Megaphone, path: "/campaign-kit" },
  { label: "ContentCalendar", icon: Calendar, path: "/content-calendar" },
  { label: "DocStudio", icon: FileText, path: "/doc-studio" },
  { label: "ReelBuilder", icon: Film, path: "/reel-builder" },
];

const secondaryItems = [
  { label: "Brand DNA", icon: Shield, path: "/brand-dna" },
];

export function AppSidebar() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const renderNavItem = (item: typeof navItems[0], showLabel: boolean) => {
    const active = isActive(item.path);
    return (
      <NavLink
        key={item.path}
        to={item.path}
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

  const renderTooltipItem = (item: typeof navItems[0]) => {
    const active = isActive(item.path);
    return (
      <Tooltip key={item.path} delayDuration={0}>
        <TooltipTrigger asChild>
          <NavLink
            to={item.path}
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

  return (
    <>
      {/* ── Desktop sidebar (>1024px): collapsible ── */}
      <aside
        className={`hidden lg:flex z-40 h-full flex-col bg-sidebar border-r border-transparent relative flex-shrink-0 transition-all duration-200 ease-in-out ${collapsed ? "w-16" : "w-[220px]"}`}
      >
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-primary/40 to-transparent" />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-3 right-2 z-10 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <nav className="flex-1 pt-10 px-2 space-y-1">
          {collapsed
            ? navItems.map((item) => renderTooltipItem(item))
            : navItems.map((item) => renderNavItem(item, true))
          }
          <div className="mx-3 my-2 border-t border-border" />
          {collapsed
            ? secondaryItems.map((item) => renderTooltipItem(item))
            : secondaryItems.map((item) => renderNavItem(item, true))
          }
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
          {navItems.map((item) => renderTooltipItem(item))}
          <div className="mx-3 my-2 border-t border-border" />
          {secondaryItems.map((item) => renderTooltipItem(item))}
        </nav>
        <div className="py-4 flex justify-center">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-ui font-semibold">CK</div>
        </div>
      </aside>

      {/* ── Mobile bottom nav (<768px) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border flex items-center justify-around px-2 py-2">
        {[...navItems, ...secondaryItems].map((item) => {
          const active = isActive(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
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
      </nav>
    </>
  );
}
