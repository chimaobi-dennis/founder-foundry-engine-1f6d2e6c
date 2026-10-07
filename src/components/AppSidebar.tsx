import {
  Sparkles,
  Layers,
  PenTool,
  CalendarDays,
  FileText,
  TrendingUp,
  Film,
  Archive,
  Settings2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  X, Users, ListChecks } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { useBrand } from "@/hooks/use-brand";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

// ─── Types ───────────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  icon: LucideIcon;
  path: string;
  soon?: boolean;
};

type NavGroup = {
  section: string;
  items: NavItem[];
};

// ─── Nav structure ────────────────────────────────────────────────────────────

const navGroups: NavGroup[] = [
  {
    section: "TEAM",
    items: [{ label: "Your plan", icon: ListChecks, path: "/plan" }, { label: "Your team", icon: Users, path: "/team" }],
  },
  {
    section: "THINK",
    items: [{ label: "Kinika", icon: Sparkles, path: "/mentor" }],
  },
  {
    section: "BUILD BRAND",
    items: [{ label: "Brand", icon: Layers, path: "/brand-dna" }],
  },
  {
    section: "CREATE",
    items: [{ label: "Studio", icon: PenTool, path: "/studio" }],
  },
  {
    section: "PUBLISH",
    items: [{ label: "Content Calendar", icon: CalendarDays, path: "/content-calendar" }],
  },
  {
    section: "DOCUMENT",
    items: [{ label: "DocStudio", icon: FileText, path: "/doc-studio" }],
  },
  {
    section: "PITCH",
    items: [{ label: "Funding Kit", icon: TrendingUp, path: "/funding-kit", soon: true }],
  },
  {
    section: "RECORD",
    items: [{ label: "ReelBuilder", icon: Film, path: "/reel-builder" }],
  },
];

const secondaryItems: NavItem[] = [
  { label: "Library", icon: Archive, path: "/library" },
  { label: "Settings", icon: Settings2, path: "/settings/ai-models" },
];

// All primary nav items flattened — used by mobile nav
const allPrimaryItems = navGroups.flatMap((g) => g.items);

// Paths that append /brandId for brand-scoped navigation
const BRAND_SCOPED_PATHS = new Set([
  "/mentor",
  "/content-calendar",
  "/doc-studio",
  "/reel-builder",
  "/library",
  "/brand-dna",
]);

// ─── Shared styles ────────────────────────────────────────────────────────────

const AMBER = "#D4A017";
const MUTED = "#8A96A3";

// ─── Component ───────────────────────────────────────────────────────────────

export function AppSidebar() {
  const location = useLocation();
  const { profile } = useProfile();
  const { activeBrand } = useBrand();
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

  const resolvePath = (path: string) =>
    BRAND_SCOPED_PATHS.has(path) && activeBrand?.id
      ? `${path}/${activeBrand.id}`
      : path;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  // ── Expanded nav item ──────────────────────────────────────────────────────

  const NavItemExpanded = ({ item }: { item: NavItem }) => {
    const active = isActive(item.path);
    return (
      <NavLink
        to={resolvePath(item.path)}
        className={[
          "flex items-center gap-2.5 px-3 py-[7px]",
          "text-[13px] font-ui transition-colors duration-150",
          "border-l-2",
          active
            ? "border-[#D4A017]"
            : "border-transparent",
        ].join(" ")}
        style={{ color: active ? AMBER : MUTED }}
        onMouseEnter={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
        }}
        onMouseLeave={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.color = MUTED;
        }}
      >
        <item.icon
          size={15}
          style={{ color: active ? AMBER : "inherit", flexShrink: 0 }}
        />
        <span className="flex-1 leading-none">{item.label}</span>
        {item.soon && (
          <span
            className="text-[10px] font-ui px-1.5 py-0.5 rounded-sm leading-none"
            style={{ background: `${AMBER}22`, color: AMBER }}
          >
            Soon
          </span>
        )}
      </NavLink>
    );
  };

  // ── Collapsed nav item (icon + tooltip) ───────────────────────────────────

  const NavItemCollapsed = ({ item }: { item: NavItem }) => {
    const active = isActive(item.path);
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <NavLink
            to={resolvePath(item.path)}
            className={[
              "flex items-center justify-center w-full py-[9px]",
              "border-l-2 transition-colors duration-150",
              active ? "border-[#D4A017]" : "border-transparent",
            ].join(" ")}
            style={{ color: active ? AMBER : MUTED }}
            onMouseEnter={(e) => {
              if (!active) (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
            }}
            onMouseLeave={(e) => {
              if (!active) (e.currentTarget as HTMLElement).style.color = MUTED;
            }}
          >
            <item.icon size={17} style={{ color: "inherit" }} />
          </NavLink>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p className="font-ui text-sm">
            {item.label}
            {item.soon && (
              <span className="ml-1.5 text-[10px]" style={{ color: AMBER }}>
                Soon
              </span>
            )}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  };

  // ── Section label ─────────────────────────────────────────────────────────

  const SectionLabel = ({ label }: { label: string }) => (
    <div
      className="px-3 pt-4 pb-1 text-[10px] font-ui font-medium uppercase tracking-widest select-none"
      style={{ color: `${MUTED}99` }}
    >
      {label}
    </div>
  );

  const dividerClass = "my-3 mx-3 h-px bg-[#2A3A4A]";

  // ── Desktop expanded ───────────────────────────────────────────────────────

  const DesktopExpanded = () => (
    <nav className="flex-1 overflow-y-auto overflow-x-hidden pt-2 pb-2">
      {navGroups.map((group) => (
        <div key={group.section}>
          <SectionLabel label={group.section} />
          {group.items.map((item) => (
            <NavItemExpanded key={item.path} item={item} />
          ))}
        </div>
      ))}

      <div className={dividerClass} />

      {secondaryItems.map((item) => (
        <NavItemExpanded key={item.path} item={item} />
      ))}
    </nav>
  );

  // ── Desktop collapsed ─────────────────────────────────────────────────────

  const DesktopCollapsed = () => (
    <nav className="flex-1 overflow-y-auto overflow-x-hidden pt-3 pb-2 px-1">
      {navGroups.map((group) => (
        <div key={group.section}>
          {group.items.map((item) => (
            <NavItemCollapsed key={item.path} item={item} />
          ))}
        </div>
      ))}

      <div className={dividerClass} />

      {secondaryItems.map((item) => (
        <NavItemCollapsed key={item.path} item={item} />
      ))}
    </nav>
  );

  return (
    <>
      {/* ── Desktop sidebar (≥1024px) ── */}
      <aside
        className={[
          "hidden lg:flex z-40 h-full flex-col relative flex-shrink-0",
          "bg-sidebar border-r border-transparent",
          "transition-all duration-200 ease-in-out",
          collapsed ? "w-16" : "w-[220px]",
        ].join(" ")}
      >
        {/* Subtle right-edge gradient line */}
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-primary/30 to-transparent" />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-3 right-2 z-10 w-6 h-6 rounded-md flex items-center justify-center transition-colors"
          style={{ color: MUTED }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--foreground)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = MUTED)}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        <div className="flex-shrink-0 pt-10" />

        {/* Nav */}
        {collapsed ? <DesktopCollapsed /> : <DesktopExpanded />}
      </aside>

      {/* ── Tablet sidebar (768–1024px): icon-only ── */}
      <aside className="hidden md:flex lg:hidden z-40 h-full w-16 flex-col items-center bg-sidebar border-r border-transparent relative flex-shrink-0">
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
        <nav className="flex-1 pt-6 space-y-0 w-full px-1 overflow-y-auto">
          {navGroups.map((group) =>
            group.items.map((item) => (
              <NavItemCollapsed key={item.path} item={item} />
            ))
          )}
          <div className={dividerClass} />
          {secondaryItems.map((item) => (
            <NavItemCollapsed key={item.path} item={item} />
          ))}
        </nav>
      </aside>

      {/* ── Mobile bottom nav (<768px) — unchanged ── */}
      <nav className="md:hidden bg-background border-t border-border flex items-center justify-around px-2 py-2 safe-bottom">
        {allPrimaryItems.slice(0, 5).map((item) => {
          const active = isActive(item.path);
          return (
            <NavLink
              key={item.path}
              to={resolvePath(item.path)}
              className="flex flex-col items-center justify-center p-1.5 rounded-md transition-colors duration-150"
              style={{ color: active ? AMBER : MUTED }}
            >
              <item.icon size={20} />
            </NavLink>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center justify-center p-1.5 rounded-md transition-colors duration-150"
          style={{
            color: allPrimaryItems.slice(5).some((i) => isActive(i.path))
              ? AMBER
              : MUTED,
          }}
        >
          <MoreHorizontal size={20} />
        </button>
      </nav>

      {/* ── Mobile "More" drawer ── */}
      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent className="pb-8">
          <VisuallyHidden.Root>
            <DrawerTitle>More</DrawerTitle>
          </VisuallyHidden.Root>
          <div className="px-4 pt-2 space-y-1">
            {[...allPrimaryItems.slice(5), ...secondaryItems].map((item) => {
              const active = isActive(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={resolvePath(item.path)}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-ui transition-colors"
                  style={{ color: active ? AMBER : MUTED }}
                >
                  <item.icon size={17} />
                  <span className="flex-1">{item.label}</span>
                  {item.soon && (
                    <span
                      className="text-[10px] font-ui px-1.5 py-0.5 rounded-sm"
                      style={{ background: `${AMBER}22`, color: AMBER }}
                    >
                      Soon
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
