import { useState, useEffect } from "react";
import { FadeIn } from "@/components/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Loader2 } from "lucide-react";
import { getAllApplications, approveCreator, rejectCreator } from "@/services/adminService";
import { getAllApplicationsAdmin } from "@/services/adminServiceSupabase";
import { toast } from "@/hooks/use-toast";

const STATUS_TABS = ["pending", "approved", "rejected", "all"];

const statusPillStyle: Record<string, React.CSSProperties> = {
  pending: { background: "#2A2A0A", color: "#D4A017" },
  approved: { background: "#1A2A1A", color: "#4ADE80" },
  rejected: { background: "#2A1A1A", color: "#F87171" },
};

export default function AdminApplications() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [actioning, setActioning] = useState(false);

  const cardBg = { background: "#0D1520", border: "0.5px solid #1A2A3A" };

  const fetchApps = async () => {
    setLoading(true);
    try {
      // Try admin service first (bypasses RLS)
      const { data } = await getAllApplicationsAdmin(filter === "all" ? undefined : filter);
      setApps(data ?? []);
    } catch (error) {
      console.warn('Admin service not available, falling back to regular service:', error);
      // Fallback to regular service (limited by RLS)
      const { data } = await getAllApplications(filter === "all" ? undefined : filter);
      setApps(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchApps(); }, [filter]);

  const openReview = (app: any) => {
    setDetail(app);
    setNotes("");
    setDrawerOpen(true);
  };

  const handleApprove = async () => {
    if (!detail || !notes.trim()) return;
    setActioning(true);
    const res = await approveCreator(detail.id, notes);
    setActioning(false);
    if (res.success) {
      toast({ title: "Creator approved" });
      setDrawerOpen(false);
      fetchApps();
    } else {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!detail || !notes.trim()) return;
    setActioning(true);
    const res = await rejectCreator(detail.id, notes);
    setActioning(false);
    if (res.success) {
      toast({ title: "Application rejected" });
      setDrawerOpen(false);
      fetchApps();
    } else {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    }
  };

  return (
    <FadeIn>
      <div className="space-y-5">
        <h1 className="font-display text-2xl" style={{ color: "#F5F0E8" }}>Creator Applications</h1>

        <div className="flex gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className="text-[12px] font-ui px-3 py-1.5 rounded-full capitalize transition-colors"
              style={{
                background: filter === t ? "#D4A017" : "transparent",
                color: filter === t ? "#0D1B2A" : "#8A96A3",
                border: filter === t ? "none" : "0.5px solid #1A2A3A",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-xl p-4 space-y-3" style={cardBg}>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={cardBg}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: "#1A2A3A" }}>
                  <TableHead style={{ color: "#8A96A3" }}>Applicant</TableHead>
                  <TableHead style={{ color: "#8A96A3" }}>Experience</TableHead>
                  <TableHead style={{ color: "#8A96A3" }}>Applied</TableHead>
                  <TableHead style={{ color: "#8A96A3" }}>Status</TableHead>
                  <TableHead style={{ color: "#8A96A3" }} className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => openReview(a)} style={{ borderColor: "#1A2A3A" }}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-ui font-semibold" style={{ background: "#D4A017", color: "#0D1B2A" }}>
                          {(a.profiles?.full_name || "?")[0]?.toUpperCase()}
                        </div>
                        <span className="text-[13px] font-ui" style={{ color: "#F5F0E8" }}>{a.profiles?.full_name || "Unknown"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-ui" style={{ color: "#8A96A3" }}>{a.prompt_engineering_experience || a.experience || "–"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-ui" style={{ color: "#8A96A3" }}>{new Date(a.created_at).toLocaleDateString()}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] font-ui px-2 py-0.5 rounded-full capitalize" style={statusPillStyle[a.status] || statusPillStyle.pending}>
                        {a.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => { e.stopPropagation(); openReview(a); }}
                        className="text-xs font-ui px-3 py-1 rounded-md"
                        style={{ background: "#D4A017", color: "#0D1B2A" }}
                      >
                        Review
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
                {apps.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-xs font-ui" style={{ color: "#8A96A3" }}>No applications found</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Review drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-[420px] overflow-y-auto" style={{ background: "#0D1520", borderLeft: "0.5px solid #1A2A3A" }}>
          <SheetHeader>
            <SheetTitle className="font-display" style={{ color: "#F5F0E8" }}>Review Application</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-ui font-semibold" style={{ background: "#D4A017", color: "#0D1B2A" }}>
                  {(detail.profiles?.full_name || "?")[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-ui font-medium" style={{ color: "#F5F0E8" }}>{detail.profiles?.full_name ?? "Unknown"}</p>
                  <p className="text-[11px] font-ui" style={{ color: "#8A96A3" }}>Applied {new Date(detail.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {(detail.why_apply || detail.motivation) && (
                <div>
                  <p className="text-xs font-ui mb-1" style={{ color: "#8A96A3" }}>Why they want to be a creator</p>
                  <p className="text-sm font-ui" style={{ color: "#F5F0E8" }}>{detail.why_apply || detail.motivation}</p>
                </div>
              )}

              {detail.portfolio_url && (
                <div>
                  <p className="text-xs font-ui mb-1" style={{ color: "#8A96A3" }}>Portfolio</p>
                  <a href={detail.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-sm font-ui underline" style={{ color: "#D4A017" }}>{detail.portfolio_url}</a>
                </div>
              )}

              {(detail.prompt_engineering_experience || detail.experience) && (
                <div>
                  <p className="text-xs font-ui mb-1" style={{ color: "#8A96A3" }}>Experience level</p>
                  <p className="text-sm font-ui" style={{ color: "#F5F0E8" }}>{detail.prompt_engineering_experience || detail.experience}</p>
                </div>
              )}

              {detail.sample_prompt && (
                <div>
                  <p className="text-xs font-ui mb-1" style={{ color: "#8A96A3" }}>Sample Prompt</p>
                  <pre className="rounded-lg p-3 text-xs font-mono whitespace-pre-wrap" style={{ background: "#080F18", color: "#F5F0E8", border: "0.5px solid #1A2A3A" }}>
                    {detail.sample_prompt}
                  </pre>
                </div>
              )}

              <div>
                <p className="text-xs font-ui mb-1" style={{ color: "#8A96A3" }}>Notes (required)</p>
                <Textarea
                  placeholder="Admin notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-sm"
                  style={{ background: "#080F18", border: "0.5px solid #1A2A3A", color: "#F5F0E8" }}
                />
              </div>

              {detail.status === "pending" && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleApprove}
                    disabled={actioning || !notes.trim()}
                    className="flex-1 h-10 rounded-lg text-sm font-ui font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                    style={{ background: "#16A34A", color: "#fff" }}
                  >
                    {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={16} />}
                    Approve
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={actioning || !notes.trim()}
                    className="flex-1 h-10 rounded-lg text-sm font-ui font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                    style={{ border: "0.5px solid #F87171", color: "#F87171", background: "transparent" }}
                  >
                    <X size={16} />
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </FadeIn>
  );
}
