import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FadeIn } from "@/components/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Image, Check } from "lucide-react";
import { getAllTemplates, getTemplateDetail, getAllTemplatesAdmin, getTemplateDetailAdmin, updateTemplateAdmin } from "@/services/adminService";
import { updateTemplate } from "@/services/templateService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STATUS_TABS = ["all", "pending_review", "published", "draft", "unpublished"];
const TYPE_TABS = ["all", "physical", "digital"];

const statusPillStyle: Record<string, React.CSSProperties> = {
  published: { background: "#E6F4EC", color: "#157347" },
  pending_review: { background: "#FFF1D6", color: "#1E4ED8" },
  draft: { background: "#DDE3EC", color: "#5B6472" },
  unpublished: { background: "#FDECEC", color: "#B42318" },
};

export default function AdminTemplates() {
  const [searchParams] = useSearchParams();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("filter") || "all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setActionLoading = (key: string, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  const isActionLoading = (key: string) => loadingStates[key] === true;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [actioning, setActioning] = useState(false);

  const cardBg = { background: "#FFFFFF", border: "1px solid #DDE3EC" };

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
    const loadingKey = `${action}-template-${detail.id}`;
    setActionLoading(loadingKey, true);
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
        admin_signature: JSON.stringify(adminSignature),
        reviewed_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Admin service not available for template update, falling back to regular service:', error);
      // Fallback to regular service (limited by RLS)
      res = await updateTemplate(detail.id, { 
        status: newStatus,
        admin_notes: notes.trim(),
        admin_signature: JSON.stringify(adminSignature),
        reviewed_at: new Date().toISOString()
      });
    }
    
    setActioning(false);
    setActionLoading(loadingKey, false);
    if (res.success) {
      const actionText = action === "publish" ? "Published" : 
                        action === "unpublish" ? "Unpublished" : "Changes requested";
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
        <h1 className="font-display text-2xl" style={{ color: "#0B1220" }}>Templates</h1>

        <div className="flex flex-wrap gap-4">
          <div className="flex gap-1">
            {STATUS_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setStatusFilter(t)}
                className="text-[12px] font-ui px-3 py-1.5 rounded-full capitalize transition-colors"
                style={{
                  background: statusFilter === t ? "#1E4ED8" : "transparent",
                  color: statusFilter === t ? "#FFFFFF" : "#5B6472",
                  border: statusFilter === t ? "none" : "1px solid #DDE3EC",
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
                  background: typeFilter === t ? "#1E4ED8" : "transparent",
                  color: typeFilter === t ? "#FFFFFF" : "#5B6472",
                  border: typeFilter === t ? "none" : "1px solid #DDE3EC",
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
                <TableRow style={{ borderColor: "#DDE3EC" }}>
                  <TableHead style={{ color: "#5B6472" }} className="w-14"></TableHead>
                  <TableHead style={{ color: "#5B6472" }}>Name</TableHead>
                  <TableHead style={{ color: "#5B6472" }}>Creator</TableHead>
                  <TableHead style={{ color: "#5B6472" }}>Type</TableHead>
                  <TableHead style={{ color: "#5B6472" }}>Status</TableHead>
                  <TableHead style={{ color: "#5B6472" }} className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => {
                  const cover = t.template_preview_images?.find((i: any) => i.is_cover)?.image_url;
                  return (
                    <TableRow key={t.id} style={{ borderColor: "#DDE3EC" }}>
                      <TableCell>
                        {cover ? (
                          <img src={cover} alt="" className="w-12 h-12 rounded object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded flex items-center justify-center" style={{ background: "#DDE3EC" }}>
                            <Image size={14} style={{ color: "#5B6472" }} />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-[13px] font-ui" style={{ color: "#0B1220" }}>{t.name}</p>
                        <p className="text-[11px] font-ui" style={{ color: "#5B6472" }}>{t.category}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-ui" style={{ color: "#5B6472" }}>
                          {(t.creator_profiles?.display_name || t.profiles?.full_name) ?? "Unknown"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] font-ui px-2 py-0.5 rounded-full capitalize" style={{ background: "#DDE3EC", color: "#5B6472" }}>
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
                          <button onClick={() => openReview(t.id)} className="text-xs font-ui px-3 py-1 rounded-md" style={{ background: "#1E4ED8", color: "#FFFFFF" }}>Review</button>
                        )}
                        {t.status === "published" && (
                          <button 
                            onClick={() => { setDetail(t); handleAction("unpublish"); }} 
                            disabled={isActionLoading(`unpublish-template-${t.id}`)}
                            className="text-xs font-ui px-3 py-1 rounded-md disabled:opacity-50" 
                            style={{ 
                              border: "1px solid #C9D2DE", 
                              color: "#5B6472",
                              opacity: isActionLoading(`unpublish-template-${t.id}`) ? 0.7 : 1,
                              cursor: isActionLoading(`unpublish-template-${t.id}`) ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {isActionLoading(`unpublish-template-${t.id}`) ? '...' : 'Unpublish'}
                          </button>
                        )}
                        {t.status === "unpublished" && (
                          <button 
                            onClick={() => { setDetail(t); handleAction("publish"); }} 
                            disabled={isActionLoading(`publish-template-${t.id}`)}
                            className="text-xs font-ui px-3 py-1 rounded-md disabled:opacity-50" 
                            style={{ 
                              background: "#E6F4EC", 
                              color: "#157347",
                              opacity: isActionLoading(`publish-template-${t.id}`) ? 0.7 : 1,
                              cursor: isActionLoading(`publish-template-${t.id}`) ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {isActionLoading(`publish-template-${t.id}`) ? '...' : 'Publish'}
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {templates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-xs font-ui" style={{ color: "#5B6472" }}>No templates found</p>
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
            <SheetTitle className="font-display" style={{ color: "#0B1220" }}>Review Template</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="space-y-6 mt-4">
              {/* Template Header */}
              <div>
                <p className="text-lg font-ui font-medium" style={{ color: "#0B1220" }}>{detail.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-ui px-2 py-0.5 rounded-full capitalize" style={{ background: "#DDE3EC", color: "#5B6472" }}>
                    {detail.category}
                  </span>
                  <span className="text-xs font-ui px-2 py-0.5 rounded-full capitalize" style={{ background: "#DDE3EC", color: "#5B6472" }}>
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
                  <p className="text-xs font-ui mb-2" style={{ color: "#5B6472" }}>Description</p>
                  <p className="text-sm font-ui" style={{ color: "#0B1220" }}>{detail.description}</p>
                </div>
              )}

              {/* Creator Information */}
              <div>
                <p className="text-xs font-ui mb-2" style={{ color: "#5B6472" }}>Creator Information</p>
                <div className="rounded-lg p-3" style={{ background: "#F5F7FA", border: "1px solid #DDE3EC" }}>
                  <div className="flex items-center gap-3">
                    {detail.creator_profiles?.avatar_url || detail.profiles?.avatar_url ? (
                      <img 
                        src={detail.creator_profiles?.avatar_url || detail.profiles?.avatar_url} 
                        alt="" 
                        className="w-10 h-10 rounded-full object-cover" 
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#DDE3EC" }}>
                        <span className="text-xs font-ui" style={{ color: "#5B6472" }}>
                          {((detail.creator_profiles?.display_name || detail.profiles?.full_name) || "Creator")?.[0]?.toUpperCase() || "C"}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-ui" style={{ color: "#0B1220" }}>
                        {(detail.creator_profiles?.display_name || detail.profiles?.full_name) || "Unknown Creator"}
                      </p>
                      <p className="text-xs font-ui" style={{ color: "#5B6472" }}>
                        Creator ID: {detail.creator_id}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Images */}
              {detail.template_preview_images?.length > 0 && (
                <div>
                  <p className="text-xs font-ui mb-2" style={{ color: "#5B6472" }}>Preview Images ({detail.template_preview_images.length})</p>
                  <div className="grid grid-cols-2 gap-2">
                    {detail.template_preview_images
                      .sort((a: any, b: any) => a.sort_order - b.sort_order)
                      .map((img: any) => (
                        <div key={img.id} className="relative group">
                          <img src={img.image_url} alt="" className="rounded-lg object-cover aspect-square w-full" />
                          {img.is_cover && (
                            <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-ui" style={{ background: "#1E4ED8", color: "#FFFFFF" }}>
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
                  <p className="text-xs font-ui mb-2" style={{ color: "#5B6472" }}>Generation Prompt</p>
                  <pre className="rounded-lg p-3 text-xs font-mono whitespace-pre-wrap" style={{ background: "#F5F7FA", color: "#0B1220", border: "1px solid #DDE3EC" }}>
                    {detail.generation_prompt}
                  </pre>
                </div>
              )}

              {/* Template Metadata */}
              <div>
                <p className="text-xs font-ui mb-2" style={{ color: "#5B6472" }}>Template Details</p>
                <div className="rounded-lg p-3 space-y-2" style={{ background: "#F5F7FA", border: "1px solid #DDE3EC" }}>
                  <div className="flex justify-between">
                    <span className="text-xs font-ui" style={{ color: "#5B6472" }}>Created:</span>
                    <span className="text-xs font-ui" style={{ color: "#0B1220" }}>
                      {new Date(detail.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-ui" style={{ color: "#5B6472" }}>Last Updated:</span>
                    <span className="text-xs font-ui" style={{ color: "#0B1220" }}>
                      {new Date(detail.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  {detail.reviewed_at && (
                    <div className="flex justify-between">
                      <span className="text-xs font-ui" style={{ color: "#5B6472" }}>Last Reviewed:</span>
                      <span className="text-xs font-ui" style={{ color: "#0B1220" }}>
                        {new Date(detail.reviewed_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {detail.best_for && (
                    <div>
                      <span className="text-xs font-ui" style={{ color: "#5B6472" }}>Best For:</span>
                      <p className="text-xs font-ui mt-1" style={{ color: "#0B1220" }}>{detail.best_for}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Previous Admin Review */}
              {detail.admin_notes && (
                <div>
                  <p className="text-xs font-ui mb-2" style={{ color: "#5B6472" }}>Previous Admin Review</p>
                  <div className="rounded-lg p-3 space-y-2" style={{ background: "#F5F7FA", border: "1px solid #DDE3EC" }}>
                    <p className="text-sm font-ui" style={{ color: "#0B1220" }}>{detail.admin_notes}</p>
                    {detail.admin_signature && (
                      <div className="text-xs font-mono" style={{ color: "#1E4ED8" }}>
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
                <p className="text-xs font-ui mb-2" style={{ color: "#5B6472" }}>Admin Review</p>
                
                {/* Approval Notes */}
                <div className="mb-4">
                  <Textarea
                    placeholder="Enter approval notes or feedback for the creator..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="text-sm min-h-[80px]"
                    style={{ background: "#F5F7FA", border: "1px solid #DDE3EC", color: "#0B1220" }}
                  />
                </div>

                {/* Admin Signature */}
                <div className="mb-4">
                  <p className="text-xs font-ui mb-1" style={{ color: "#5B6472" }}>Admin Signature (ID)</p>
                  <div className="rounded-lg p-2 text-xs font-mono" style={{ background: "#F5F7FA", border: "1px solid #DDE3EC", color: "#1E4ED8" }}>
                    Admin Review • {new Date().toISOString()}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {detail.status === "pending_review" && (
                    <>
                      <button
                        onClick={() => handleAction("publish")}
                        disabled={isActionLoading(`publish-template-${detail.id}`) || isActionLoading(`request-changes-template-${detail.id}`)}
                        className="flex-1 h-10 rounded-lg text-sm font-ui font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                        style={{ 
                          background: "#157347", 
                          color: "#fff",
                          opacity: isActionLoading(`publish-template-${detail.id}`) ? 0.7 : 1,
                          cursor: isActionLoading(`publish-template-${detail.id}`) ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isActionLoading(`publish-template-${detail.id}`) ? (
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
                        {isActionLoading(`publish-template-${detail.id}`) ? 'Publishing...' : 'Approve & Publish'}
                      </button>
                      <button
                        onClick={() => handleAction("request_changes")}
                        disabled={isActionLoading(`publish-template-${detail.id}`) || isActionLoading(`request-changes-template-${detail.id}`) || !notes.trim()}
                        className="flex-1 h-10 rounded-lg text-sm font-ui font-medium disabled:opacity-50"
                        style={{ 
                          border: "1px solid #1E4ED8", 
                          color: "#1E4ED8", 
                          background: "transparent",
                          opacity: isActionLoading(`request-changes-template-${detail.id}`) ? 0.7 : 1,
                          cursor: isActionLoading(`request-changes-template-${detail.id}`) ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isActionLoading(`request-changes-template-${detail.id}`) ? 'Sending...' : 'Request Changes'}
                      </button>
                    </>
                  )}
                  
                  {detail.status === "published" && (
                    <button
                      onClick={() => handleAction("unpublish")}
                      disabled={isActionLoading(`unpublish-template-${detail.id}`)}
                      className="flex-1 h-10 rounded-lg text-sm font-ui font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{ 
                        border: "1px solid #B42318", 
                        color: "#B42318", 
                        background: "transparent",
                        opacity: isActionLoading(`unpublish-template-${detail.id}`) ? 0.7 : 1,
                        cursor: isActionLoading(`unpublish-template-${detail.id}`) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isActionLoading(`unpublish-template-${detail.id}`) ? (
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
                      ) : null}
                      {isActionLoading(`unpublish-template-${detail.id}`) ? 'Unpublishing...' : 'Unpublish Template'}
                    </button>
                  )}
                  
                  {detail.status === "unpublished" && (
                    <button
                      onClick={() => handleAction("publish")}
                      disabled={isActionLoading(`publish-template-${detail.id}`)}
                      className="flex-1 h-10 rounded-lg text-sm font-ui font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{ 
                        background: "#157347", 
                        color: "#fff",
                        opacity: isActionLoading(`publish-template-${detail.id}`) ? 0.7 : 1,
                        cursor: isActionLoading(`publish-template-${detail.id}`) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isActionLoading(`publish-template-${detail.id}`) ? (
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
                      {isActionLoading(`publish-template-${detail.id}`) ? 'Publishing...' : 'Republish Template'}
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
