import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FadeIn } from "@/components/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import {
  getDashboardStats,
  getUserSignupsByDay,
  getTemplateUsageByCategory,
  getUserRoleBreakdown,
  getRecentActivity,
} from "@/services/adminService";
import { getDashboardStatsAdmin, testAdminService } from "@/services/adminServiceSupabase";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Area, AreaChart,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

const COLORS = { founders: "#2D4A3E", creators: "#D4A017", admins: "#7A3030" };

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [signups, setSignups] = useState<any[]>([]);
  const [templateUsage, setTemplateUsage] = useState<any[]>([]);
  const [roles, setRoles] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [signupDays, setSignupDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    
    // Test admin service first
    try {
      await testAdminService();
    } catch (testError) {
      console.error('Admin service test failed:', testError);
    }
    
    try {
      // Try admin service first for dashboard stats (bypasses RLS)
      const s = await getDashboardStatsAdmin();
      const [su, tu, rb, act] = await Promise.all([
        getUserSignupsByDay(signupDays),
        getTemplateUsageByCategory(),
        getUserRoleBreakdown(),
        getRecentActivity(20),
      ]);
      setStats(s);
      setSignups(su);
      setTemplateUsage(tu);
      setRoles(rb);
      setActivity(act);
    } catch (error) {
      console.warn('Admin service not available, falling back to regular service:', error);
      // Fallback to regular service (limited by RLS)
      const [s, su, tu, rb, act] = await Promise.all([
        getDashboardStats(),
        getUserSignupsByDay(signupDays),
        getTemplateUsageByCategory(),
        getUserRoleBreakdown(),
        getRecentActivity(20),
      ]);
      setStats(s);
      setSignups(su);
      setTemplateUsage(tu);
      setRoles(rb);
      setActivity(act);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Refetch signups when days toggle changes
  useEffect(() => {
    getUserSignupsByDay(signupDays).then(setSignups);
  }, [signupDays]);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const cardStyle = "rounded-xl p-4" as const;
  const cardBg = { background: "#0D1520", border: "0.5px solid #1A2A3A" };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4" style={cardBg}><Skeleton className="h-8 w-12 mb-2" /><Skeleton className="h-3 w-20" /></div>
          ))}
        </div>
        <div className="rounded-xl p-5" style={cardBg}><Skeleton className="h-[240px] w-full" /></div>
      </div>
    );
  }

  const statCards = [
    { label: "Total users", value: stats?.totalUsers ?? 0 },
    { label: "New this week", value: signups.slice(-7).reduce((s, d) => s + d.count, 0) },
    { label: "Active brands", value: stats?.totalBrands ?? 0 },
    { label: "Templates live", value: stats?.totalTemplates ?? 0 },
    { label: "Total generations", value: 0 },
    { label: "Pending actions", value: stats?.pendingActions ?? 0, amber: (stats?.pendingActions ?? 0) > 0 },
  ];

  const roleData = roles ? [
    { name: "Founders", value: roles.founders, color: COLORS.founders },
    { name: "Creators", value: roles.creators, color: COLORS.creators },
    { name: "Admins", value: roles.admins, color: COLORS.admins },
  ] : [];

  return (
    <FadeIn>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-[26px]" style={{ color: "#F5F0E8" }}>Dashboard</h1>
          <p className="text-[13px] font-ui mt-0.5" style={{ color: "#8A96A3" }}>{today}</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((s) => (
            <div
              key={s.label}
              className={cardStyle}
              style={{
                ...cardBg,
                ...(s.amber ? { border: "0.5px solid #D4A017" } : {}),
              }}
            >
              <p className="text-[28px] font-medium" style={{ color: s.amber ? "#D4A017" : "#F5F0E8" }}>{s.value}</p>
              <p className="text-[11px] font-ui mt-1" style={{ color: "#8A96A3" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Signups chart */}
        <div className="rounded-xl p-5" style={cardBg}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-ui font-medium" style={{ color: "#F5F0E8" }}>User registrations</p>
            <div className="flex gap-1">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setSignupDays(d)}
                  className="text-[11px] font-ui px-3 py-1 rounded-full transition-colors"
                  style={{
                    background: signupDays === d ? "#D4A017" : "transparent",
                    color: signupDays === d ? "#0D1B2A" : "#8A96A3",
                    border: signupDays === d ? "none" : "0.5px solid #1A2A3A",
                  }}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={signups}>
              <defs>
                <linearGradient id="amberFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4A017" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#D4A017" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A2A3A" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#8A96A3" }}
                tickFormatter={(v) => { const d = new Date(v); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }}
              />
              <YAxis tick={{ fontSize: 11, fill: "#8A96A3" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#0D1520", border: "0.5px solid #1A2A3A", borderRadius: 8, fontSize: 12, color: "#F5F0E8" }}
                labelFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              />
              <Area type="monotone" dataKey="count" stroke="#D4A017" strokeWidth={2} fill="url(#amberFill)" dot={{ fill: "#D4A017", r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Two charts side by side */}
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1 rounded-xl p-5" style={cardBg}>
            <p className="text-sm font-ui font-medium mb-4" style={{ color: "#F5F0E8" }}>Template usage by category</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={templateUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A2A3A" />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#8A96A3" }} tickFormatter={(v) => v.length > 10 ? v.slice(0, 10) + "…" : v} />
                <YAxis tick={{ fontSize: 11, fill: "#8A96A3" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0D1520", border: "0.5px solid #1A2A3A", borderRadius: 8, fontSize: 12, color: "#F5F0E8" }} />
                <Bar dataKey="count" fill="#D4A017" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full lg:w-[280px] rounded-xl p-5" style={cardBg}>
            <p className="text-sm font-ui font-medium mb-4" style={{ color: "#F5F0E8" }}>User roles</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={roleData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={3}>
                  {roleData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0D1520", border: "0.5px solid #1A2A3A", borderRadius: 8, fontSize: 12, color: "#F5F0E8" }} />
                <Legend
                  formatter={(value) => <span style={{ color: "#8A96A3", fontSize: 11 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
            {roles && (
              <p className="text-center text-xs font-ui mt-1" style={{ color: "#8A96A3" }}>{roles.total} total users</p>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl p-5" style={cardBg}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-ui font-medium" style={{ color: "#F5F0E8" }}>Recent activity</p>
            <span className="text-xs font-ui cursor-pointer" style={{ color: "#D4A017" }}>View all</span>
          </div>
          <div className="max-h-[320px] overflow-y-auto space-y-0">
            {activity.length === 0 && (
              <p className="text-xs font-ui py-4 text-center" style={{ color: "#8A96A3" }}>No recent activity</p>
            )}
            {activity.map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5" style={{ borderBottom: i < activity.length - 1 ? "0.5px solid #1A2530" : "none" }}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: a.type === "signup" ? "#1A2A3A" : a.type === "brand" ? "#1A2A1A" : "#2A2A1A",
                  }}
                >
                  <span style={{ color: a.type === "brand" ? "#4ADE80" : "#D4A017", fontSize: 14 }}>
                    {a.type === "signup" ? "👤" : a.type === "brand" ? "🏷" : "⭐"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-ui truncate" style={{ color: "#F5F0E8" }}>{a.label}</p>
                  <p className="text-[11px] font-ui" style={{ color: "#8A96A3" }}>{relativeTime(a.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending actions */}
        {(stats?.pendingActions ?? 0) > 0 && (
          <div className="rounded-xl p-5" style={{ background: "#1A1A0A", border: "0.5px solid rgba(212,160,23,0.25)" }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} style={{ color: "#D4A017" }} />
              <p className="text-sm font-ui font-medium" style={{ color: "#D4A017" }}>Requires your attention</p>
            </div>
            {(stats?.pendingApplications ?? 0) > 0 && (
              <div className="flex items-center justify-between py-2">
                <span className="text-[13px] font-ui" style={{ color: "#F5F0E8" }}>{stats.pendingApplications} creator application{stats.pendingApplications > 1 ? "s" : ""} waiting for review</span>
                <button onClick={() => navigate("/admin/product/applications")} className="text-xs font-ui" style={{ color: "#D4A017" }}>Review now →</button>
              </div>
            )}
            {(stats?.pendingTemplates ?? 0) > 0 && (
              <div className="flex items-center justify-between py-2">
                <span className="text-[13px] font-ui" style={{ color: "#F5F0E8" }}>{stats.pendingTemplates} template{stats.pendingTemplates > 1 ? "s" : ""} waiting for review</span>
                <button onClick={() => navigate("/admin/product/templates?filter=pending_review")} className="text-xs font-ui" style={{ color: "#D4A017" }}>Review now →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </FadeIn>
  );
}
