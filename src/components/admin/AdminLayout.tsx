import { Outlet, useNavigate, useLocation, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  LayoutGrid, Users, Layers, Inbox, Settings, Cpu, Book, Bug, Map, Coins, Bot, Menu, ArrowLeft, ShieldCheck, Plug,
} from "lucide-react";

/**
 * The admin shell: theme A, one nav that is a full sidebar on large screens,
 * an icon rail on medium ones, and a drawer behind a menu button on phones.
 */
const SECTIONS: Array<{ label?: string; items: Array<{ label: string; icon: typeof Users; path: string; hint: string }> }> = [
  { items: [{ label: "Overview", icon: LayoutGrid, path: "/admin", hint: "Signups, usage, what needs attention" }] },
  { label: "People", items: [
    { label: "Users", icon: Users, path: "/admin/users", hint: "Roles and accounts" },
    { label: "Creator applications", icon: Inbox, path: "/admin/product/applications", hint: "Approve or decline" },
  ] },
  { label: "Product", items: [
    { label: "Community agents", icon: Bot, path: "/admin/product/agents", hint: "Review submitted agents" },
    { label: "Templates", icon: Layers, path: "/admin/product/templates", hint: "Studio templates" },
    { label: "Journey stages", icon: Map, path: "/admin/journey-stages", hint: "Stage names and playbooks" },
    { label: "Prompts", icon: Book, path: "/admin/knowledge-base", hint: "Every prompt, its model flow, instructions and examples" },
    { label: "Connections", icon: Plug, path: "/admin/connections", hint: "OAuth providers: add, verify, go live" },
  ] },
  { label: "AI", items: [
    { label: "Models and routing", icon: Cpu, path: "/admin/product/ai-models", hint: "Providers, models, profiles, prompts" },
    { label: "Error logs", icon: Bug, path: "/admin/errors", hint: "Runtime and AI failures" },
  ] },
  { label: "Money", items: [
    { label: "Billing", icon: Coins, path: "/admin/billing", hint: "Plans, prices, wallets" },
    { label: "Runtime settings", icon: Settings, path: "/admin/settings", hint: "Feature flags and limits" },
  ] },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, loading } = useProfile();
  const [open, setOpen] = useState(false);

  const fullName = profile?.full_name || "Admin";
  const initials = fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  useEffect(() => {
    if (!loading && profile?.role !== "admin") navigate("/home", { replace: true });
  }, [loading, profile, navigate]);
  useEffect(() => { setOpen(false); }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
      </div>
    );
  }
  if (profile?.role !== "admin") return null;

  const isActive = (path: string) => path === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(path);
  const current = SECTIONS.flatMap((s) => s.items).find((i) => isActive(i.path));

  const Nav = ({ compact = false }: { compact?: boolean }) => (
    <nav aria-label="Admin" className="flex-1 py-2">
      {SECTIONS.map((section, si) => (
        <div key={si} className={cn(si > 0 && "mt-2")}>
          {section.label && !compact && (
            <p className="font-ui uppercase px-4 pt-3 pb-1 text-[10px] tracking-[0.16em] text-muted-foreground">{section.label}</p>
          )}
          {section.label && compact && <div className="mx-3 my-2 h-px bg-border" />}
          {section.items.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/admin"}
                title={compact ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 font-ui text-[13px] transition-colors border-l-2",
                  compact ? "justify-center h-10 mx-2 rounded-lg border-l-0" : "px-4 h-9",
                  active ? "bg-accent text-accent-foreground font-medium border-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent",
                )}
              >
                <item.icon size={16} className="shrink-0" />
                {!compact && <span className="flex-1 truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background text-foreground">
      <header className="h-14 flex items-center justify-between gap-3 px-3 md:px-5 flex-shrink-0 border-b border-border bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => setOpen(true)} className="md:hidden w-9 h-9 inline-flex items-center justify-center rounded-lg border border-border bg-card" aria-label="Open admin menu">
            <Menu size={18} />
          </button>
          <span className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.06em] font-ui font-semibold px-2.5 py-1 rounded-md bg-[hsl(var(--brand-needs-you-soft))] text-[hsl(var(--brand-needs-you))] shrink-0">
            <ShieldCheck size={12} /> ADMIN
          </span>
          <span className="font-display text-[15px] truncate">{current?.label ?? "Kinika admin"}</span>
          {current?.hint && <span className="hidden lg:inline font-ui text-[12px] text-muted-foreground truncate">· {current.hint}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => navigate("/home")} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card font-ui text-[12px] text-foreground hover:bg-muted/60">
            <ArrowLeft size={14} /> <span className="hidden sm:inline">Back to Kinika</span>
          </button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-ui font-semibold bg-primary text-primary-foreground" title={fullName}>{initials}</div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <aside className="hidden lg:flex w-[232px] flex-col flex-shrink-0 overflow-y-auto border-r border-border bg-[hsl(var(--sidebar-background))]">
          <Nav />
        </aside>
        <aside className="hidden md:flex lg:hidden w-14 flex-col flex-shrink-0 overflow-y-auto border-r border-border bg-[hsl(var(--sidebar-background))]">
          <Nav compact />
        </aside>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-[280px] p-0 bg-card">
            <SheetTitle className="font-display text-[15px] px-4 h-14 flex items-center border-b border-border">Kinika admin</SheetTitle>
            <Nav />
          </SheetContent>
        </Sheet>

        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <div className="max-w-[1200px] mx-auto px-4 md:px-7 py-5 md:py-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
