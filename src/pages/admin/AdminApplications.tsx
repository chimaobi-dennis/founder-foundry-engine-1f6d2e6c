import { useState, useEffect } from "react";
import { FadeIn } from "@/components/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Check, X } from "lucide-react";
import { getAllApplications, approveCreator, rejectCreator, getAllApplicationsAdmin } from "@/services/adminService";
import { toast } from "@/hooks/use-toast";

const STATUS_TABS = ["pending", "approved", "rejected", "all"];

const statusPillStyle: Record<string, React.CSSProperties> = {
  pending: { background: "#FFF1D6", color: "#1E4ED8" },
  approved: { background: "#E6F4EC", color: "#157347" },
  rejected: { background: "#FDECEC", color: "#B42318" },
};

export default function AdminApplications() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [actioning, setActioning] = useState(false);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setActionLoading = (key: string, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  const isActionLoading = (key: string) => loadingStates[key] === true;

  const cardBg = { background: "#FFFFFF", border: "1px solid #DDE3EC" };

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
    const loadingKey = `approve-application-${detail.id}`;
    setActionLoading(loadingKey, true);
    setActioning(true);
    const res = await approveCreator(detail.id, notes);
    setActioning(false);
    setActionLoading(loadingKey, false);
    if (res.success) {
      toast({ title: "Approved" });
      setDrawerOpen(false);
      fetchApps();
    } else {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!detail || !notes.trim()) return;
    const loadingKey = `reject-application-${detail.id}`;
    setActionLoading(loadingKey, true);
    setActioning(true);
    const res = await rejectCreator(detail.id, notes);
    setActioning(false);
    setActionLoading(loadingKey, false);
    if (res.success) {
      toast({ title: "Rejected" });
      setDrawerOpen(false);
      fetchApps();
    } else {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    }
  };

  return (
    <FadeIn>
      <div className="space-y-5">
        <h1 className="font-display text-2xl" style={{ color: "#0B1220" }}>Creator Applications</h1>

        <div className="flex gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className="text-[12px] font-ui px-3 py-1.5 rounded-full capitalize transition-colors"
              style={{
                background: filter === t ? "#1E4ED8" : "transparent",
                color: filter === t ? "#FFFFFF" : "#5B6472",
                border: filter === t ? "none" : "1px solid #DDE3EC",
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
                <TableRow style={{ borderColor: "#DDE3EC" }}>
                  <TableHead style={{ color: "#5B6472" }}>Applicant</TableHead>
                  <TableHead style={{ color: "#5B6472" }}>Experience</TableHead>
                  <TableHead style={{ color: "#5B6472" }}>Applied</TableHead>
                  <TableHead style={{ color: "#5B6472" }}>Status</TableHead>
                  <TableHead style={{ color: "#5B6472" }} className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => openReview(a)} style={{ borderColor: "#DDE3EC" }}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-ui font-semibold" style={{ background: "#1E4ED8", color: "#FFFFFF" }}>
                          {(a.profiles?.full_name || "?")[0]?.toUpperCase()}
                        </div>
                        <span className="text-[13px] font-ui" style={{ color: "#0B1220" }}>{a.profiles?.full_name || "Unknown"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-ui" style={{ color: "#5B6472" }}>{a.prompt_engineering_experience || a.experience || "–"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-ui" style={{ color: "#5B6472" }}>{new Date(a.created_at).toLocaleDateString()}</span>
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
                        style={{ background: "#1E4ED8", color: "#FFFFFF" }}
                      >
                        Review
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
                {apps.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-xs font-ui" style={{ color: "#5B6472" }}>No applications found</p>
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
        <SheetContent className="w-full sm:max-w-[420px] overflow-y-auto" style={{ background: "#FFFFFF", borderLeft: "1px solid #DDE3EC" }}>
          <SheetHeader>
            <SheetTitle className="font-display" style={{ color: "#0B1220" }}>Review Application</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-ui font-semibold" style={{ background: "#1E4ED8", color: "#FFFFFF" }}>
                  {(detail.profiles?.full_name || "?")[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-ui font-medium" style={{ color: "#0B1220" }}>{detail.profiles?.full_name ?? "Unknown"}</p>
                  <p className="text-[11px] font-ui" style={{ color: "#5B6472" }}>Applied {new Date(detail.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {(detail.why_apply || detail.motivation) && (
                <div>
                  <p className="text-xs font-ui mb-1" style={{ color: "#5B6472" }}>Why they want to be a creator</p>
                  <p className="text-sm font-ui" style={{ color: "#0B1220" }}>{detail.why_apply || detail.motivation}</p>
                </div>
              )}

              {detail.portfolio_url && (
                <div>
                  <p className="text-xs font-ui mb-1" style={{ color: "#5B6472" }}>Portfolio</p>
                  <a href={detail.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-sm font-ui underline" style={{ color: "#1E4ED8" }}>{detail.portfolio_url}</a>
                </div>
              )}

              {(detail.prompt_engineering_experience || detail.experience) && (
                <div>
                  <p className="text-xs font-ui mb-1" style={{ color: "#5B6472" }}>Experience level</p>
                  <p className="text-sm font-ui" style={{ color: "#0B1220" }}>{detail.prompt_engineering_experience || detail.experience}</p>
                </div>
              )}

              {detail.sample_prompt && (
                <div>
                  <p className="text-xs font-ui mb-1" style={{ color: "#5B6472" }}>Sample Prompt</p>
                  <pre className="rounded-lg p-3 text-xs font-mono whitespace-pre-wrap" style={{ background: "#F5F7FA", color: "#0B1220", border: "1px solid #DDE3EC" }}>
                    {detail.sample_prompt}
                  </pre>
                </div>
              )}

              <div>
                <p className="text-xs font-ui mb-1" style={{ color: "#5B6472" }}>Notes (required)</p>
                <Textarea
                  placeholder="Admin notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-sm"
                  style={{ background: "#F5F7FA", border: "1px solid #DDE3EC", color: "#0B1220" }}
                />
              </div>

              {detail.status === "pending" && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleApprove}
                    disabled={isActionLoading(`approve-application-${detail.id}`) || isActionLoading(`reject-application-${detail.id}`) || !notes.trim()}
                    className="flex-1 h-10 rounded-lg text-sm font-ui font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                    style={{ 
                      background: "#157347", 
                      color: "#fff",
                      opacity: isActionLoading(`approve-application-${detail.id}`) ? 0.7 : 1,
                      cursor: isActionLoading(`approve-application-${detail.id}`) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isActionLoading(`approve-application-${detail.id}`) ? (
                      <span style={{
                        width: '12px',
                        height: '12px',
                        border: '2px solid currentColor',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'spin 0.6s linear infinite',
                        flexShrink: 0
                      }} />
                    ) : <Check size={16} />}
                    {isActionLoading(`approve-application-${detail.id}`) ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={isActionLoading(`approve-application-${detail.id}`) || isActionLoading(`reject-application-${detail.id}`) || !notes.trim()}
                    className="flex-1 h-10 rounded-lg text-sm font-ui font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                    style={{ 
                      border: "1px solid #B42318", 
                      color: "#B42318", 
                      background: "transparent",
                      opacity: isActionLoading(`reject-application-${detail.id}`) ? 0.7 : 1,
                      cursor: isActionLoading(`reject-application-${detail.id}`) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isActionLoading(`reject-application-${detail.id}`) ? 'Rejecting...' : 'Reject'}
                    <X size={16} />
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
