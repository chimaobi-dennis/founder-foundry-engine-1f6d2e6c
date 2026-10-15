import { useState, useEffect, useMemo } from "react";
import { FadeIn } from "@/components/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal } from "lucide-react";
import { getAllUsers, updateUserRole, getAllUsersAdmin, updateUserRoleAdmin } from "@/services/adminService";
import { toast } from "@/hooks/use-toast";

const ROLE_TABS = ["all", "founder", "creator"] as const;

const rolePillStyle: Record<string, React.CSSProperties> = {
  founder: { background: "#DDE3EC", color: "#5B6472" },
  creator: { background: "#FFF1D6", color: "#1E4ED8" },
  admin: { background: "#FDECEC", color: "#B42318" },
};

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [roleMenuOpen, setRoleMenuOpen] = useState<string | null>(null);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setActionLoading = (key: string, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  const isActionLoading = (key: string) => loadingStates[key] === true;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Try admin service first (bypasses RLS)
      const { data } = await getAllUsersAdmin(filter === "all" ? undefined : filter);
      setUsers(data ?? []);
    } catch (error) {
      console.warn('Admin service not available, falling back to regular service:', error);
      // Fallback to regular service (limited by RLS)
      const { data } = await getAllUsers(filter === "all" ? undefined : filter);
      setUsers(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, [filter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) =>
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.id || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleChangeRole = async (userId: string, newRole: string) => {
    const loadingKey = `change-role-${userId}`;
    setActionLoading(loadingKey, true);
    try {
      // Try admin service first (bypasses RLS)
      const res = await updateUserRoleAdmin(userId, newRole);
      if (res.success) {
        toast({ title: "Role updated" });
        setRoleMenuOpen(null);
        fetchUsers();
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    } catch (error) {
      console.warn('Admin service not available, falling back to regular service:', error);
      // Fallback to regular service (limited by RLS)
      const res = await updateUserRole(userId, newRole);
      if (res.success) {
        toast({ title: "Role updated" });
        setRoleMenuOpen(null);
        fetchUsers();
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    }
    setActionLoading(loadingKey, false);
  };

  const cardBg = { background: "#FFFFFF", border: "1px solid #DDE3EC" };

  return (
    <FadeIn>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl" style={{ color: "#0B1220" }}>Users</h1>
          <p className="text-[13px] font-ui mt-0.5" style={{ color: "#5B6472" }}>{users.length} total</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className="text-[12px] font-ui px-3 py-1.5 rounded-full capitalize transition-colors"
              style={{
                background: filter === tab ? "#1E4ED8" : "transparent",
                color: filter === tab ? "#FFFFFF" : "#5B6472",
                border: filter === tab ? "none" : "1px solid #DDE3EC",
              }}
            >
              {tab === "all" ? "All" : tab + "s"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#5B6472" }} />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-lg pl-10 pr-4 text-sm font-ui"
            style={{ background: "#FFFFFF", border: "1px solid #DDE3EC", color: "#0B1220", outline: "none" }}
          />
        </div>

        {loading ? (
          <div className="rounded-xl p-4 space-y-3" style={cardBg}>
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={cardBg}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: "#DDE3EC" }}>
                  <TableHead style={{ color: "#5B6472" }}>Name</TableHead>
                  <TableHead style={{ color: "#5B6472" }}>Role</TableHead>
                  <TableHead style={{ color: "#5B6472" }}>Joined</TableHead>
                  <TableHead style={{ color: "#5B6472" }} className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id} style={{ borderColor: "#DDE3EC" }}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-ui font-semibold" style={{ background: "#1E4ED8", color: "#FFFFFF" }}>
                          {(u.full_name || "?")[0]?.toUpperCase()}
                        </div>
                        <span className="text-[13px] font-ui" style={{ color: "#0B1220" }}>{u.full_name || "Unnamed"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className="text-[11px] font-ui px-2 py-0.5 rounded-full capitalize"
                        style={rolePillStyle[u.role || "founder"] || rolePillStyle.founder}
                      >
                        {u.role || "founder"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-ui" style={{ color: "#5B6472" }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <button
                          onClick={() => setRoleMenuOpen(roleMenuOpen === u.id ? null : u.id)}
                          className="w-7 h-7 rounded flex items-center justify-center hover:bg-[#DDE3EC] transition-colors"
                        >
                          <MoreHorizontal size={14} style={{ color: "#5B6472" }} />
                        </button>
                        {roleMenuOpen === u.id && (
                          <div className="absolute right-0 top-8 z-50 w-40 rounded-lg py-1 shadow-xl" style={{ background: "#FFFFFF", border: "1px solid #DDE3EC" }}>
                            <p className="px-3 py-1 text-[10px] font-ui uppercase" style={{ color: "#8B94A3", letterSpacing: "0.1em" }}>Change role</p>
                            {["founder", "creator"].map((r) => (
                              <button
                                key={r}
                                onClick={() => handleChangeRole(u.id, r)}
                                disabled={isActionLoading(`change-role-${u.id}`)}
                                className="w-full text-left px-3 py-1.5 text-[12px] font-ui capitalize hover:bg-[#F0F3F7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                                style={{ color: (u.role || "founder") === r ? "#1E4ED8" : "#0B1220" }}
                              >
                                {r}
                                {isActionLoading(`change-role-${u.id}`) && (
                                  <span style={{
                                    width: '10px',
                                    height: '10px',
                                    border: '2px solid #1E4ED8',
                                    borderTopColor: 'transparent',
                                    borderRadius: '50%',
                                    display: 'inline-block',
                                    animation: 'spin 0.6s linear infinite'
                                  }} />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <p className="text-xs font-ui" style={{ color: "#5B6472" }}>No users found</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </FadeIn>
  );
}
