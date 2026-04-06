import { useState, useEffect, useMemo } from "react";
import { FadeIn } from "@/components/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal } from "lucide-react";
import { getAllUsers, updateUserRole } from "@/services/adminService";
import { toast } from "@/hooks/use-toast";

const ROLE_TABS = ["all", "founder", "creator"] as const;

const rolePillStyle: Record<string, React.CSSProperties> = {
  founder: { background: "#1A2A3A", color: "#8A96A3" },
  creator: { background: "#2A2A0A", color: "#D4A017" },
  admin: { background: "#2A1A1A", color: "#F87171" },
};

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [roleMenuOpen, setRoleMenuOpen] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await getAllUsers(filter === "all" ? undefined : filter);
    setUsers(data ?? []);
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
    const res = await updateUserRole(userId, newRole);
    if (res.success) {
      toast({ title: "Role updated" });
      setRoleMenuOpen(null);
      fetchUsers();
    } else {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    }
  };

  const cardBg = { background: "#0D1520", border: "0.5px solid #1A2A3A" };

  return (
    <FadeIn>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl" style={{ color: "#F5F0E8" }}>Users</h1>
          <p className="text-[13px] font-ui mt-0.5" style={{ color: "#8A96A3" }}>{users.length} total</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className="text-[12px] font-ui px-3 py-1.5 rounded-full capitalize transition-colors"
              style={{
                background: filter === tab ? "#D4A017" : "transparent",
                color: filter === tab ? "#0D1B2A" : "#8A96A3",
                border: filter === tab ? "none" : "0.5px solid #1A2A3A",
              }}
            >
              {tab === "all" ? "All" : tab + "s"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8A96A3" }} />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-lg pl-10 pr-4 text-sm font-ui"
            style={{ background: "#0D1520", border: "0.5px solid #1A2A3A", color: "#F5F0E8", outline: "none" }}
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
                <TableRow style={{ borderColor: "#1A2A3A" }}>
                  <TableHead style={{ color: "#8A96A3" }}>Name</TableHead>
                  <TableHead style={{ color: "#8A96A3" }}>Role</TableHead>
                  <TableHead style={{ color: "#8A96A3" }}>Joined</TableHead>
                  <TableHead style={{ color: "#8A96A3" }} className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id} style={{ borderColor: "#1A2A3A" }}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-ui font-semibold" style={{ background: "#D4A017", color: "#0D1B2A" }}>
                          {(u.full_name || "?")[0]?.toUpperCase()}
                        </div>
                        <span className="text-[13px] font-ui" style={{ color: "#F5F0E8" }}>{u.full_name || "Unnamed"}</span>
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
                      <span className="text-xs font-ui" style={{ color: "#8A96A3" }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <button
                          onClick={() => setRoleMenuOpen(roleMenuOpen === u.id ? null : u.id)}
                          className="w-7 h-7 rounded flex items-center justify-center hover:bg-[#1A2A3A] transition-colors"
                        >
                          <MoreHorizontal size={14} style={{ color: "#8A96A3" }} />
                        </button>
                        {roleMenuOpen === u.id && (
                          <div className="absolute right-0 top-8 z-50 w-40 rounded-lg py-1 shadow-xl" style={{ background: "#0D1520", border: "0.5px solid #1A2A3A" }}>
                            <p className="px-3 py-1 text-[10px] font-ui uppercase" style={{ color: "#4A5568", letterSpacing: "0.1em" }}>Change role</p>
                            {["founder", "creator"].map((r) => (
                              <button
                                key={r}
                                onClick={() => handleChangeRole(u.id, r)}
                                className="w-full text-left px-3 py-1.5 text-[12px] font-ui capitalize hover:bg-[#1A2530] transition-colors"
                                style={{ color: (u.role || "founder") === r ? "#D4A017" : "#F5F0E8" }}
                              >
                                {r}
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
                      <p className="text-xs font-ui" style={{ color: "#8A96A3" }}>No users found</p>
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
