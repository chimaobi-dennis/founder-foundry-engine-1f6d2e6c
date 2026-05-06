import { Outlet, useNavigate, useLocation, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/use-profile";
import { useEffect } from "react";
import {
  LayoutGrid, Users, User, Star, Layers, Clock, Inbox, Tag, Award, Settings, LogOut, Cpu, Book, Bug, Map,
} from "lucide-react";

const sections = [
  {
    items: [
      { label: "Dashboard", icon: LayoutGrid, path: "/admin" },
    ],
  },
  {
    label: "USERS",
    items: [
      { label: "All users", icon: Users, path: "/admin/users" },
    ],
  },
  {
    label: "PRODUCT",
    items: [
      { label: "Templates", icon: Layers, path: "/admin/product/templates" },
      { label: "Creator applications", icon: Inbox, path: "/admin/product/applications", countKey: "pendingApplications" as const },
      { label: "AI Models", icon: Cpu, path: "/admin/product/ai-models" },
      { label: "Knowledge Base", icon: Book, path: "/admin/knowledge-base" },
      { label: "Journey Stages", icon: Map, path: "/admin/journey-stages" },
      { label: "Error Logs", icon: Bug, path: "/admin/errors" },
    ],
  },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { profile, loading } = useProfile();

  const fullName = profile?.full_name || "Admin";
  const initials = fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  useEffect(() => {
    if (!loading && profile?.role !== "admin") {
      navigate("/home", { replace: true });
    }
  }, [loading, profile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080F18" }}>
        <div className="w-4 h-4 rounded-full bg-[#D4A017] animate-pulse" />
      </div>
    );
  }

  if (profile?.role !== "admin") return null;

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#080F18" }}>
      {/* Admin top bar */}
      <header
        className="h-14 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-50"
        style={{ background: "#0D1520", borderBottom: "0.5px solid #1A2A3A" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-[11px] tracking-[0.06em] font-ui font-medium px-2.5 py-1 rounded-md"
            style={{ background: "#3A1818", border: "0.5px solid #7A3030", color: "#F87171" }}
          >
            ADMIN MODE
          </span>
          <span className="text-sm font-ui font-medium" style={{ color: "#8A96A3" }}>
            FounderForge Admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/home")}
            className="text-xs font-ui px-3.5 py-1.5 rounded-lg transition-colors"
            style={{
              border: "0.5px solid #2A3A4A",
              color: "#8A96A3",
              background: "transparent",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1A2A3A")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Exit Admin
          </button>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-ui font-semibold"
            style={{ background: "#D4A017", color: "#0D1B2A" }}
          >
            {initials}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Admin sidebar */}
        <aside
          className="hidden md:flex w-[220px] flex-col flex-shrink-0 overflow-y-auto"
          style={{ background: "#0D1520", borderRight: "0.5px solid #1A2A3A" }}
        >
          <nav className="flex-1 py-2">
            {sections.map((section, si) => (
              <div key={si}>
                {section.label && (
                  <p
                    className="font-ui uppercase px-5 pt-4 pb-1.5"
                    style={{ fontSize: "10px", letterSpacing: "0.1em", color: "#4A5568" }}
                  >
                    {section.label}
                  </p>
                )}
                {section.items.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === "/admin"}
                      className="flex items-center gap-2.5 px-5 h-[38px] text-[13px] font-ui transition-colors"
                      style={{
                        color: active ? "#F5F0E8" : "#8A96A3",
                        background: active ? "#1A2530" : "transparent",
                        borderLeft: active ? "2px solid #D4A017" : "2px solid transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.color = "#F5F0E8";
                          e.currentTarget.style.background = "#1A2530";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.color = "#8A96A3";
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <item.icon size={16} />
                      <span className="flex-1">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;
if (!document.head.querySelector('style[data-admin-animations]')) {
  style.setAttribute('data-admin-animations', 'true');
  document.head.appendChild(style);
}
