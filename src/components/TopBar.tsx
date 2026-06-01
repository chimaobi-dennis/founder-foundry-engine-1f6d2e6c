import { useLocation, useNavigate } from "react-router-dom";
import { HelpCircle, MessageSquarePlus, Bell, Sun, Moon, CheckCheck, Coins } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/use-profile";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCreditBalance } from "@/hooks/use-credit-balance";
import { createPortal } from "react-dom";
import { useState, useRef, useEffect } from "react";
import { MobileBottomSheet } from "@/components/ui/MobileBottomSheet";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/services/contentStudioService";
import { WorkspaceControlCenter } from "@/components/workspace/WorkspaceControlCenter";

const routeTitles: Record<string, string> = {
  "/home": "greeting",
  "/mentor": "Kinika",
  "/pro-studio": "ProStudio",
  "/content-studio": "ContentStudio",
  "/content-calendar": "ContentCalendar",
  "/doc-studio": "DocStudio",
  "/reel-builder": "ReelBuilder",
  "/brand-dna": "Brand DNA",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { profile } = useProfile();
  const isMobile = useIsMobile();
  const { balance, loading: balanceLoading } = useCreditBalance();
  const [controlCenterOpen, setControlCenterOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const controlCenterRef = useRef<HTMLDivElement>(null);
  const controlCenterDropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const fullName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const titleKey = Object.keys(routeTitles).find((p) =>
    p === "/home" ? location.pathname === "/home" : location.pathname === p || location.pathname.startsWith(p + "/")
  );
  const resolvedTitle = titleKey ? routeTitles[titleKey] : "Home";
  const firstNameForGreeting = profile?.full_name?.trim().split(/\s+/)[0] || "";
  const title = resolvedTitle === "greeting" ? (firstNameForGreeting ? `${getGreeting()}, ${firstNameForGreeting}` : getGreeting()) : resolvedTitle;

  // Load unread count + poll
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const c = await getUnreadCount(user.id);
        if (!cancelled) setUnreadCount(c);
      } catch {}
    };
    refresh();
    const t = window.setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user?.id]);

  // Load full list when opening
  useEffect(() => {
    if (!notifOpen || !user?.id) return;
    (async () => {
      try {
        const list = await getNotifications(user.id);
        setNotifications(list || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [notifOpen, user?.id]);

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    await markAllNotificationsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotifClick = async (n: any) => {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((p) => (p.id === n.id ? { ...p, is_read: true } : p))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setNotifOpen(false);
    if (n.action_url) navigate(n.action_url);
  };

  // Outside click handling (desktop only — mobile uses backdrop)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (isMobile) return;
      const insideControlCenterButton = controlCenterRef.current?.contains(target);
      const insideControlCenterDropdown = controlCenterDropdownRef.current?.contains(target);
      if (!insideControlCenterButton && !insideControlCenterDropdown) {
        setControlCenterOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMobile]);

  // Lock body scroll when a mobile sheet is open
  useEffect(() => {
    if (!isMobile) return;
    if (notifOpen || controlCenterOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [isMobile, notifOpen, controlCenterOpen]);

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-6 bg-sidebar/95 backdrop-blur-sm border-b-[0.5px] border-border flex-shrink-0 z-50 fixed md:relative top-0 inset-x-0">
      {/* Left — page title */}
      <h1 className="font-display text-lg text-foreground truncate">{title}</h1>

      {/* Right — actions */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Credit balance pill — hidden on mobile */}
        {!balanceLoading && (
          <button
            onClick={() => setControlCenterOpen(true)}
            className="hidden md:flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-muted/20 hover:bg-muted/40 transition-all duration-200 text-[12px] font-ui"
          >
            <Coins size={13} className="text-primary" />
            <span className="text-foreground font-medium">{balance.toLocaleString()}</span>
          </button>
        )}

        {/* Guide — hidden on mobile & tablet */}
        <button className="hidden lg:flex w-9 h-9 rounded-lg items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200">
          <HelpCircle size={18} />
        </button>

        {/* Feedback — hidden on mobile & tablet */}
        <button className="hidden lg:flex w-9 h-9 rounded-lg items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200">
          <MessageSquarePlus size={18} />
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 relative"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-ui font-semibold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (isMobile ? (
            <MobileBottomSheet open={notifOpen} onClose={() => setNotifOpen(false)} maxHeight="85vh">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
                  <p className="font-ui text-[13px] font-semibold text-foreground">Notifications</p>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-[11px] font-ui text-primary hover:underline flex items-center gap-1">
                      <CheckCheck size={12} /> Mark all read
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1">
                  {notifications.length === 0 ? (
                    <div className="py-12 text-center">
                      <Bell size={24} className="text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-[13px] font-ui text-muted-foreground">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`w-full text-left px-4 py-3 border-b border-border/50 last:border-b-0 hover:bg-muted/40 transition-colors ${!n.is_read ? "border-l-2 border-l-primary bg-primary/[0.03]" : ""}`}
                      >
                        <p className="font-ui text-[13px] font-medium text-foreground">{n.title}</p>
                        <p className="text-[12px] font-ui text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-[10px] font-ui text-muted-foreground mt-1.5">{timeAgo(n.created_at)}</p>
                      </button>
                    ))
                  )}
                </div>
            </MobileBottomSheet>
          ) : (
            <div
              className="absolute z-[60] bg-card/95 border border-card-border shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 top-12 right-0 w-[360px] rounded-2xl flex flex-col"
              style={{ maxHeight: '70vh' }}
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
                <p className="font-ui text-[13px] font-semibold text-foreground">Notifications</p>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-[11px] font-ui text-primary hover:underline flex items-center gap-1">
                    <CheckCheck size={12} /> Mark all read
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center">
                    <Bell size={24} className="text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-[13px] font-ui text-muted-foreground">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={`w-full text-left px-4 py-3 border-b border-border/50 last:border-b-0 hover:bg-muted/40 transition-colors ${!n.is_read ? "border-l-2 border-l-primary bg-primary/[0.03]" : ""}`}
                    >
                      <p className="font-ui text-[13px] font-medium text-foreground">{n.title}</p>
                      <p className="text-[12px] font-ui text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] font-ui text-muted-foreground mt-1.5">{timeAgo(n.created_at)}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1 h-9 px-3 rounded-full border border-border bg-muted/30 hover:bg-muted/50 transition-all duration-200"
        >
          {theme === "dark" ? (
            <Moon size={16} className="text-primary" />
          ) : (
            <Sun size={16} className="text-primary" />
          )}
        </button>

        {/* Avatar — opens Workspace Control Center */}
        <div className="relative" ref={controlCenterRef}>
          <button
            onClick={() => setControlCenterOpen(!controlCenterOpen)}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-ui font-semibold hover:ring-2 hover:ring-primary/30 transition-all duration-200"
          >
            {initials}
          </button>
          <WorkspaceControlCenter
            open={controlCenterOpen}
            onClose={() => setControlCenterOpen(false)}
            dropdownRef={controlCenterDropdownRef}
          />
        </div>
      </div>
    </header>
  );
}
