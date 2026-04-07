import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FadeIn } from "@/components/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Image, Check, Loader2 } from "lucide-react";
import { getAllTemplates, getTemplateDetail } from "@/services/adminService";
import { getAllTemplatesAdmin, getTemplateDetailAdmin, updateTemplateAdmin } from "@/services/adminServiceSupabase";
import { updateTemplate } from "@/services/templateService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STATUS_TABS = ["all", "pending_review", "published", "draft", "unpublished"];
const TYPE_TABS = ["all", "physical", "digital"];

const statusPillStyle: Record<string, React.CSSProperties> = {
  published: { background: "#1A2A1A", color: "#4ADE80" },
  pending_review: { background: "#2A2A0A", color: "#D4A017" },
  draft: { background: "#1A2A3A", color: "#8A96A3" },
  unpublished: { background: "#2A1A1A", color: "#F87171" },
};

export default function AdminTemplates() {
  const [searchParams] = useSearchParams();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("filter") || "all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [actioning, setActioning] = useState(false);

  const cardBg = { background: "#0D1520", border: "0.5px solid #1A2A3A" };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      // Try admin service first (bypasses RLS)
      const { data } = await getAllTemplatesAdmin(
        statusFilter === "all" ? undefined : statusFilter,
        typeFilter === "all" ? undefined : typeFilter,
      );
      setTemplates(data ?? []);
    } catch (error) {
      console.warn('Admin service not available, falling back to regular service:', error);
      // Fallback to regular service (limited by RLS)
      const { data } = await getAllTemplates(
        statusFilter === "all" ? undefined : statusFilter,
        typeFilter === "all" ? undefined : typeFilter,
      );
      setTemplates(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, [statusFilter, typeFilter]);

  const openReview = async (id: string) => {
    try {
      // Try admin service first (bypasses RLS)
      const { data } = await getTemplateDetailAdmin(id);
      if (data) {
        setDetail(data);
        setNotes("");
        setDrawerOpen(true);
      }
    } catch (error) {
      console.warn('Admin service not available for template detail, falling back to regular service:', error);
      // Fallback to regular service (limited by RLS)
      const { data } = await getTemplateDetail(id);
      if (data) {
        setDetail(data);
        setNotes("");
        setDrawerOpen(true);
      }
    }
  };

  const handleAction = async (action: "publish" | "unpublish" | "request_changes") => {
    if (!detail) return;
    if (action === "request_changes" && !notes.trim()) return;
    setActioning(true);
    const newStatus = action === "publish" ? "published" : action === "unpublish" ? "unpublished" : "draft";
    
    // Get admin user info for signature
    let adminId = "unknown";
    try {
      const { data: { user } } = await supabase.auth.getUser();
      adminId = user?.id || "unknown";
    } catch (error) {
      console.warn('Could not get admin user ID:', error);
    }
    
    const adminSignature = {
      admin_id: adminId,
      notes: notes.trim(),
      action: action,
      timestamp: new Date().toISOString()
    };
    
    let res;
    try {
      // Try admin service first (bypasses RLS)
      res = await updateTemplateAdmin(detail.id, { 
        status: newStatus,
        admin_notes: notes.trim(),
        admin_signature: adminSignature,
        reviewed_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Admin service not available for template update, falling back to regular service:', error);
      // Fallback to regular service (limited by RLS)
      res = await updateTemplate(detail.id, { 
        status: newStatus,
        admin_notes: notes.trim(),
        admin_signature: adminSignature,
        reviewed_at: new Date().toISOString()
      });
    }
    
    setActioning(false);
    if (res.success) {
      const actionText = action === "publish" ? "Template published" : 
                        action === "unpublish" ? "Template unpublished" : "Changes requested";
      toast({ title: actionText, description: "Admin notes and signature saved" });
      setDrawerOpen(false);
      fetchTemplates();
    } else {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    }
  };

  const statusLabel = (s: string) => s.replace("_", " ");

  return (
    <FadeIn>
      <div className="space-y-5">
        <h1 className="font-display text-2xl" style={{ color: "#F5F0E8" }}>Templates</h1>

        <div className="flex flex-wrap gap-4">
          <div className="flex gap-1">
            {STATUS_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setStatusFilter(t)}
                className="text-[12px] font-ui px-3 py-1.5 rounded-full capitalize transition-colors"
                style={{
                  background: statusFilter === t ? "#D4A017" : "transparent",
                  color: statusFilter === t ? "#0D1B2A" : "#8A96A3",
                  border: statusFilter === t ? "none" : "0.5px solid #1A2A3A",
                }}
              >
                {statusLabel(t)}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {TYPE_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className="text-[12px] font-ui px-3 py-1.5 rounded-full capitalize transition-colors"
                style={{
                  background: typeFilter === t ? "#D4A017" : "transparent",
                  color: typeFilter === t ? "#0D1B2A" : "#8A96A3",
                  border: typeFilter === t ? "none" : "0.5px solid #1A2A3A",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl p-4 space-y-3" style={cardBg}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={cardBg}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: "#1A2A3A" }}>
                  <TableHead style={{ color: "#8A96A3" }} className="w-14"></TableHead>
                  <TableHead style={{ color: "#8A96A3" }}>Name</TableHead>
                  <TableHead style={{ color: "#8A96A3" }}>Creator</TableHead>
                  <TableHead style={{ color: "#8A96A3" }}>Type</TableHead>
                  <TableHead style={{ color: "#8A96A3" }}>Status</TableHead>
                  <TableHead style={{ color: "#8A96A3" }} className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => {
                  const cover = t.template_preview_images?.find((i: any) => i.is_cover)?.image_url;
                  return (
                    <TableRow key={t.id} style={{ borderColor: "#1A2A3A" }}>
                      <TableCell>
                        {cover ? (
                          <img src={cover} alt="" className="w-12 h-12 rounded object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded flex items-center justify-center" style={{ background: "#1A2A3A" }}>
                            <Image size={14} style={{ color: "#8A96A3" }} />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-[13px] font-ui" style={{ color: "#F5F0E8" }}>{t.name}</p>
                        <p className="text-[11px] font-ui" style={{ color: "#8A96A3" }}>{t.category}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-ui" style={{ color: "#8A96A3" }}>
                          {(t.creator_profiles?.display_name || t.profiles?.full_name) ?? "Unknown"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] font-ui px-2 py-0.5 rounded-full capitalize" style={{ background: "#1A2A3A", color: "#8A96A3" }}>
                          {t.template_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-[11px] font-ui px-2 py-0.5 rounded-full capitalize"
                          style={statusPillStyle[t.status] || statusPillStyle.draft}
                        >
                          {statusLabel(t.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {t.status === "pending_review" && (
                          <button onClick={() => openReview(t.id)} className="text-xs font-ui px-3 py-1 rounded-md" style={{ background: "#D4A017", color: "#0D1B2A" }}>Review</button>
                        )}
                        {t.status === "published" && (
                          <button onClick={() => { setDetail(t); handleAction("unpublish"); }} className="text-xs font-ui px-3 py-1 rounded-md" style={{ border: "0.5px solid #2A3A4A", color: "#8A96A3" }}>Unpublish</button>
                        )}
                        {t.status === "unpublished" && (
                          <button onClick={() => { setDetail(t); handleAction("publish"); }} className="text-xs font-ui px-3 py-1 rounded-md" style={{ background: "#1A2A1A", color: "#4ADE80" }}>Publish</button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {templates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-xs font-ui" style={{ color: "#8A96A3" }}>No templates found</p>
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
            <SheetTitle className="font-display" style={{ color: "#F5F0E8" }}>Review Template</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="space-y-6 mt-4">
              {/* Template Header */}
              <div>
                <p className="text-lg font-ui font-medium" style={{ color: "#F5F0E8" }}>{detail.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-ui px-2 py-0.5 rounded-full capitalize" style={{ background: "#1A2A3A", color: "#8A96A3" }}>
                    {detail.category}
                  </span>
                  <span className="text-xs font-ui px-2 py-0.5 rounded-full capitalize" style={{ background: "#1A2A3A", color: "#8A96A3" }}>
                    {detail.template_type}
                  </span>
                  <span
                    className="text-[11px] font-ui px-2 py-0.5 rounded-full capitalize"
                    style={statusPillStyle[detail.status] || statusPillStyle.draft}
                  >
                    {statusLabel(detail.status)}
                  </span>
                </div>
              </div>

              {/* Template Description */}
              {detail.description && (
                <div>
                  <p className="text-xs font-ui mb-2" style={{ color: "#8A96A3" }}>Description</p>
                  <p className="text-sm font-ui" style={{ color: "#F5F0E8" }}>{detail.description}</p>
                </div>
              )}

              {/* Creator Information */}
              <div>
                <p className="text-xs font-ui mb-2" style={{ color: "#8A96A3" }}>Creator Information</p>
                <div className="rounded-lg p-3" style={{ background: "#080F18", border: "0.5px solid #1A2A3A" }}>
                  <div className="flex items-center gap-3">
                    {detail.creator_profiles?.avatar_url || detail.profiles?.avatar_url ? (
                      <img 
                        src={detail.creator_profiles?.avatar_url || detail.profiles?.avatar_url} 
                        alt="" 
                        className="w-10 h-10 rounded-full object-cover" 
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1A2A3A" }}>
                        <span className="text-xs font-ui" style={{ color: "#8A96A3" }}>
                          {((detail.creator_profiles?.display_name || detail.profiles?.full_name) || "Creator")?.[0]?.toUpperCase() || "C"}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-ui" style={{ color: "#F5F0E8" }}>
                        {(detail.creator_profiles?.display_name || detail.profiles?.full_name) || "Unknown Creator"}
                      </p>
                      <p className="text-xs font-ui" style={{ color: "#8A96A3" }}>
                        Creator ID: {detail.creator_id}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Images */}
              {detail.template_preview_images?.length > 0 && (
                <div>
                  <p className="text-xs font-ui mb-2" style={{ color: "#8A96A3" }}>Preview Images ({detail.template_preview_images.length})</p>
                  <div className="grid grid-cols-2 gap-2">
                    {detail.template_preview_images
                      .sort((a: any, b: any) => a.sort_order - b.sort_order)
                      .map((img: any) => (
                        <div key={img.id} className="relative group">
                          <img src={img.image_url} alt="" className="rounded-lg object-cover aspect-square w-full" />
                          {img.is_cover && (
                            <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-ui" style={{ background: "#D4A017", color: "#0D1B2A" }}>
                              Cover
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Generation Prompt */}
              {detail.generation_prompt && (
                <div>
                  <p className="text-xs font-ui mb-2" style={{ color: "#8A96A3" }}>Generation Prompt</p>
                  <pre className="rounded-lg p-3 text-xs font-mono whitespace-pre-wrap" style={{ background: "#080F18", color: "#F5F0E8", border: "0.5px solid #1A2A3A" }}>
                    {detail.generation_prompt}
                  </pre>
                </div>
              )}

              {/* Template Metadata */}
              <div>
                <p className="text-xs font-ui mb-2" style={{ color: "#8A96A3" }}>Template Details</p>
                <div className="rounded-lg p-3 space-y-2" style={{ background: "#080F18", border: "0.5px solid #1A2A3A" }}>
                  <div className="flex justify-between">
                    <span className="text-xs font-ui" style={{ color: "#8A96A3" }}>Created:</span>
                    <span className="text-xs font-ui" style={{ color: "#F5F0E8" }}>
                      {new Date(detail.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-ui" style={{ color: "#8A96A3" }}>Last Updated:</span>
                    <span className="text-xs font-ui" style={{ color: "#F5F0E8" }}>
                      {new Date(detail.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  {detail.reviewed_at && (
                    <div className="flex justify-between">
                      <span className="text-xs font-ui" style={{ color: "#8A96A3" }}>Last Reviewed:</span>
                      <span className="text-xs font-ui" style={{ color: "#F5F0E8" }}>
                        {new Date(detail.reviewed_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {detail.best_for && (
                    <div>
                      <span className="text-xs font-ui" style={{ color: "#8A96A3" }}>Best For:</span>
                      <p className="text-xs font-ui mt-1" style={{ color: "#F5F0E8" }}>{detail.best_for}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Previous Admin Review */}
              {detail.admin_notes && (
                <div>
                  <p className="text-xs font-ui mb-2" style={{ color: "#8A96A3" }}>Previous Admin Review</p>
                  <div className="rounded-lg p-3 space-y-2" style={{ background: "#080F18", border: "0.5px solid #1A2A3A" }}>
                    <p className="text-sm font-ui" style={{ color: "#F5F0E8" }}>{detail.admin_notes}</p>
                    {detail.admin_signature && (
                      <div className="text-xs font-mono" style={{ color: "#D4A017" }}>
                        Admin ID: {detail.admin_signature.admin_id} • 
                        Action: {detail.admin_signature.action} • 
                        {new Date(detail.admin_signature.timestamp).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Review Section */}
              <div>
                <p className="text-xs font-ui mb-2" style={{ color: "#8A96A3" }}>Admin Review</p>
                
                {/* Approval Notes */}
                <div className="mb-4">
                  <Textarea
                    placeholder="Enter approval notes or feedback for the creator..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="text-sm min-h-[80px]"
                    style={{ background: "#080F18", border: "0.5px solid #1A2A3A", color: "#F5F0E8" }}
                  />
                </div>

                {/* Admin Signature */}
                <div className="mb-4">
                  <p className="text-xs font-ui mb-1" style={{ color: "#8A96A3" }}>Admin Signature (ID)</p>
                  <div className="rounded-lg p-2 text-xs font-mono" style={{ background: "#080F18", border: "0.5px solid #1A2A3A", color: "#D4A017" }}>
                    Admin Review • {new Date().toISOString()}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {detail.status === "pending_review" && (
                    <>
                      <button
                        onClick={() => handleAction("publish")}
                        disabled={actioning}
                        className="flex-1 h-10 rounded-lg text-sm font-ui font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                        style={{ background: "#16A34A", color: "#fff" }}
                      >
                        {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={16} />}
                        Approve & Publish
                      </button>
                      <button
                        onClick={() => handleAction("request_changes")}
                        disabled={actioning || !notes.trim()}
                        className="flex-1 h-10 rounded-lg text-sm font-ui font-medium disabled:opacity-50"
                        style={{ border: "0.5px solid #D4A017", color: "#D4A017", background: "transparent" }}
                      >
                        Request Changes
                      </button>
                    </>
                  )}
                  
                  {detail.status === "published" && (
                    <button
                      onClick={() => handleAction("unpublish")}
                      disabled={actioning}
                      className="flex-1 h-10 rounded-lg text-sm font-ui font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{ border: "0.5px solid #F87171", color: "#F87171", background: "transparent" }}
                    >
                      {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Unpublish Template
                    </button>
                  )}
                  
                  {detail.status === "unpublished" && (
                    <button
                      onClick={() => handleAction("publish")}
                      disabled={actioning}
                      className="flex-1 h-10 rounded-lg text-sm font-ui font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{ background: "#16A34A", color: "#fff" }}
                    >
                      {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={16} />}
                      Republish Template
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </FadeIn>
  );
}
