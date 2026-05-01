import { useLocation, useNavigate } from "react-router-dom";
import { HelpCircle, MessageSquarePlus, Bell, Sun, Moon, ChevronRight, ChevronDown, LogOut, Check, Sparkles, Clock, Shield, Cpu, CheckCheck } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useBrand } from "@/hooks/use-brand";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/use-profile";
import { useCreatorApplication } from "@/hooks/use-creator-application";
import { useState, useRef, useEffect } from "react";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/services/contentStudioService";

const routeTitles: Record<string, string> = {
  "/": "greeting",
  "/mentor": "Mentor",
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

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { brands, activeBrand, switchBrand } = useBrand();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const { application: creatorApp } = useCreatorApplication();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

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

  const fullName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const email = user?.email || '';

  const titleKey = routeTitles[location.pathname] || "Home";
  const title = titleKey === "greeting" ? `${getGreeting()}, ${fullName.split(' ')[0]}` : titleKey;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-6 bg-sidebar/95 backdrop-blur-sm border-b-[0.5px] border-border flex-shrink-0 z-50">
      {/* Left — page title */}
      <h1 className="font-display text-lg text-foreground truncate">{title}</h1>

      {/* Right — actions */}
      <div className="flex items-center gap-2 md:gap-3">
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
          {notifOpen && (
            <div className="absolute top-12 right-0 w-[360px] max-h-[500px] rounded-2xl bg-card border border-card-border shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="font-ui text-[13px] font-semibold text-foreground">
                  Notifications
                </p>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-ui text-primary hover:underline flex items-center gap-1"
                  >
                    <CheckCheck size={12} /> Mark all read
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell size={20} className="text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-[12px] font-ui text-muted-foreground">
                      No notifications yet
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={`w-full text-left px-4 py-3 border-b border-border/50 last:border-b-0 hover:bg-muted/40 transition-colors ${
                        !n.is_read ? "border-l-2 border-l-primary bg-primary/[0.03]" : ""
                      }`}
                    >
                      <p className="font-ui text-[13px] font-medium text-foreground">
                        {n.title}
                      </p>
                      <p className="text-[12px] font-ui text-muted-foreground mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-[10px] font-ui text-muted-foreground mt-1.5">
                        {timeAgo(n.created_at)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
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

        {/* Avatar with dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-ui font-semibold hover:ring-2 hover:ring-primary/30 transition-all duration-200"
          >
            {initials}
          </button>

          {dropdownOpen && (
            <div className="absolute top-12 right-0 w-[280px] rounded-2xl bg-card border border-card-border shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200" style={{ maxHeight: '85vh', overflowY: 'auto', scrollbarWidth: 'none' }}>
              <style>{`
                div[style*="max-height"]::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {/* User identity */}
              <div className="p-5 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-lg font-ui font-semibold flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base text-foreground">{fullName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[13px] font-ui text-muted-foreground">Founder</span>
                    <span className="text-[10px] font-ui font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">Pro Plan</span>
                  </div>
                  <p className="text-[12px] font-ui text-muted-foreground mt-0.5 truncate">{email}</p>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Brand switcher */}
              <div className="p-4">
                <p className="text-[11px] font-ui uppercase tracking-[0.1em] text-muted-foreground mb-2.5">Your projects</p>
                <div className="space-y-0.5">
                  {brands.map((brand) => (
                    <button
                      key={brand.id}
                      onClick={() => switchBrand(brand.id)}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-[13px] font-ui text-foreground hover:bg-muted/50 transition-colors duration-200"
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: brand.primary_color || '#D4A017' }} />
                      <span className="flex-1 text-left">{brand.name}</span>
                      {activeBrand?.id === brand.id && <Check size={14} className="text-primary" />}
                    </button>
                  ))}
                </div>
                {brands.length === 0 && (
                  <p className="text-[11px] font-ui text-muted-foreground mt-2">Create your first project by starting a Mentor session.</p>
                )}
                <button className="w-full flex items-center gap-2 px-2 py-2 mt-1 rounded-md text-[12px] font-ui text-primary/70 hover:text-primary hover:bg-muted/50 transition-colors duration-200">
                  + Add new project
                </button>
              </div>

              <div className="border-t border-border" />

              {/* Plan details */}
              <div className="p-4 space-y-2.5">
                {[
                  ["Credits remaining", "847"],
                  ["Plan renews", "Apr 15, 2026"],
                  ["Member since", "Jan 2026"],
                  ["Plan", "Pro"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[12px] font-ui text-muted-foreground">{label}</span>
                    <span className="text-[12px] font-ui text-primary font-medium">{value}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border" />

              {/* Account links */}
              <div className="py-1">
                {["Subscription and billing", "Invoices", "Account settings"].map((item) => (
                  <button key={item} className="w-full flex items-center justify-between px-5 py-2.5 text-[13px] font-ui text-foreground hover:bg-muted/50 transition-colors duration-200">
                    <span>{item}</span>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                ))}
                
                <button
                  onClick={() => { setDropdownOpen(false); navigate("/settings/ai-models"); }}
                  className="w-full flex items-center justify-between px-5 py-2.5 text-[13px] font-ui text-foreground hover:bg-muted/50 transition-colors duration-200"
                >
                  <span className="flex items-center gap-2">
                    <Cpu size={14} className="text-primary" />
                    AI Models
                  </span>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>

                {/* Switch to Admin — only for admins */}
                {profile?.role === "admin" && (
                  <button
                    onClick={() => { setDropdownOpen(false); navigate("/admin"); }}
                    className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-muted/50 transition-colors duration-200"
                  >
                    <Shield size={16} className="text-primary flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <p className="text-[13px] font-ui text-foreground">Switch to Admin</p>
                      <p className="text-[11px] font-ui text-muted-foreground">Manage the platform</p>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                )}
                {profile?.role === "founder" && !creatorApp && (
                  <button
                    onClick={() => { setDropdownOpen(false); navigate("/creator/apply"); }}
                    className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-muted/50 transition-colors duration-200"
                  >
                    <Sparkles size={16} className="text-primary flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <p className="text-[13px] font-ui text-foreground">Become a creator</p>
                      <p className="text-[11px] font-ui text-muted-foreground">Publish templates and earn</p>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                )}

                {/* Pending application */}
                {profile?.role === "founder" && creatorApp?.status === "pending" && (
                  <div className="w-full flex items-center gap-3 px-5 py-2.5">
                    <Clock size={16} className="text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <p className="text-[13px] font-ui text-muted-foreground">Application pending</p>
                      <p className="text-[11px] font-ui text-muted-foreground">We will notify you when reviewed</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border" />

              {/* Legal / support */}
              <div className="py-1">
                {["Terms and conditions", "Privacy policy", "Help center"].map((item) => (
                  <button key={item} className="w-full flex items-center justify-between px-5 py-2 text-[12px] font-ui text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-200">
                    <span>{item}</span>
                    <ChevronRight size={12} className="text-muted-foreground" />
                  </button>
                ))}
              </div>

              <div className="border-t border-border" />

              {/* Sign out */}
              <button
                onClick={async () => { await signOut(); navigate('/sign-in'); }}
                className="w-full flex items-center gap-2 px-5 py-3 text-[13px] font-ui text-destructive hover:bg-destructive/10 transition-colors duration-200"
              >
                <LogOut size={14} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
