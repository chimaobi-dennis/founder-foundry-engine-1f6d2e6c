import { useState, useEffect } from "react";
import { useProfile } from "@/hooks/use-profile";
import { Navigate } from "react-router-dom";
import { Shield, FileText, Users, Clock, ChevronRight, Check, X, Loader2, Image } from "lucide-react";
import { AdminSkeleton } from "@/components/skeletons/PageSkeletons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import {
  getAdminStats,
  getPendingTemplates,
  getTemplateDetail,
  getPendingApplications,
  approveCreator,
  rejectCreator,
} from "@/services/adminService";
import { updateTemplate } from "@/services/templateService";

interface Stats {
  totalTemplates: number;
  pendingReview: number;
  totalCreators: number;
  pendingApplications: number;
}

export default function Admin() {
  const { profile, loading: profileLoading } = useProfile();
  const [stats, setStats] = useState<Stats>({ totalTemplates: 0, pendingReview: 0, totalCreators: 0, pendingApplications: 0 });
  const [templates, setTemplates] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Template review panel
  const [reviewTemplate, setReviewTemplate] = useState<any>(null);
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [templateNotes, setTemplateNotes] = useState("");
  const [templateActioning, setTemplateActioning] = useState(false);

  // Application review panel
  const [reviewApp, setReviewApp] = useState<any>(null);
  const [appPanelOpen, setAppPanelOpen] = useState(false);
  const [appNotes, setAppNotes] = useState("");
  const [appActioning, setAppActioning] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [s, t, a] = await Promise.all([
      getAdminStats(),
      getPendingTemplates(),
      getPendingApplications(),
    ]);
    setStats(s);
    setTemplates(t.data ?? []);
    setApplications(a.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  if (profileLoading || loading) {
    return <AdminSkeleton />;
  }

  if (profile?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const openTemplateReview = async (templateId: string) => {
    const { data } = await getTemplateDetail(templateId);
    if (data) {
      setReviewTemplate(data);
      setTemplateNotes("");
      setTemplatePanelOpen(true);
    }
  };

  const handlePublishTemplate = async () => {
    if (!reviewTemplate) return;
    setTemplateActioning(true);
    const result = await updateTemplate(reviewTemplate.id, { status: "published" });
    setTemplateActioning(false);
    if (result.success) {
      toast({ title: "Template published", description: `"${reviewTemplate.name}" is now live.` });
      setTemplatePanelOpen(false);
      fetchAll();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };

  const handleRequestChanges = async () => {
    if (!reviewTemplate || !templateNotes.trim()) return;
    setTemplateActioning(true);
    const result = await updateTemplate(reviewTemplate.id, { status: "draft" });
    setTemplateActioning(false);
    if (result.success) {
      toast({ title: "Changes requested", description: "Template returned to draft with feedback." });
      setTemplatePanelOpen(false);
      fetchAll();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };

  const handleApproveApp = async () => {
    if (!reviewApp || !appNotes.trim()) return;
    setAppActioning(true);
    const result = await approveCreator(reviewApp.id, appNotes);
    setAppActioning(false);
    if (result.success) {
      toast({ title: "Creator approved", description: "The applicant now has creator access." });
      setAppPanelOpen(false);
      fetchAll();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };

  const handleRejectApp = async () => {
    if (!reviewApp || !appNotes.trim()) return;
    setAppActioning(true);
    const result = await rejectCreator(reviewApp.id, appNotes);
    setAppActioning(false);
    if (result.success) {
      toast({ title: "Application rejected" });
      setAppPanelOpen(false);
      fetchAll();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };

  const statCards = [
    { label: "Total templates", value: stats.totalTemplates, icon: FileText },
    { label: "Pending review", value: stats.pendingReview, icon: Clock },
    { label: "Total creators", value: stats.totalCreators, icon: Users },
    { label: "Applications pending", value: stats.pendingApplications, icon: Shield },
  ];

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 overflow-y-auto">
      <h1 className="font-heading text-2xl text-foreground">Admin Panel</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <s.icon size={16} />
              <span className="text-xs font-ui">{s.label}</span>
            </div>
            <p className="text-2xl font-heading text-foreground">{loading ? "–" : s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending template reviews */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg text-foreground">Pending Template Reviews</h2>
        {templates.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">No templates pending review.</p>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t: any) => {
                  const cover = t.template_preview_images?.find((i: any) => i.is_cover)?.image_url;
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        {cover ? (
                          <img src={cover} alt="" className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <Image size={14} className="text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-ui text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.category}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{t.template_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.profiles?.full_name ?? "Unknown"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(t.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="default" onClick={() => openTemplateReview(t.id)}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Creator applications */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg text-foreground">Creator Applications</h2>
        {applications.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">No pending applications.</p>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="text-sm font-ui text-foreground">{a.profiles?.full_name ?? "Unknown"}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.experience ?? "–"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => { setReviewApp(a); setAppNotes(""); setAppPanelOpen(true); }}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Template review panel */}
      <Sheet open={templatePanelOpen} onOpenChange={setTemplatePanelOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-heading">Review Template</SheetTitle>
          </SheetHeader>
          {reviewTemplate && (
            <div className="space-y-4 mt-4">
              <div>
                <p className="text-sm font-ui text-foreground font-medium">{reviewTemplate.name}</p>
                <p className="text-xs text-muted-foreground">{reviewTemplate.category} · {reviewTemplate.template_type}</p>
              </div>
              {reviewTemplate.description && (
                <p className="text-sm text-muted-foreground">{reviewTemplate.description}</p>
              )}
              {reviewTemplate.generation_prompt && (
                <div>
                  <p className="text-xs font-ui text-muted-foreground mb-1">Generation Prompt</p>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap">
                    {reviewTemplate.generation_prompt}
                  </div>
                </div>
              )}
              {reviewTemplate.template_preview_images?.length > 0 && (
                <div>
                  <p className="text-xs font-ui text-muted-foreground mb-2">Preview Images</p>
                  <div className="grid grid-cols-2 gap-2">
                    {reviewTemplate.template_preview_images
                      .sort((a: any, b: any) => a.sort_order - b.sort_order)
                      .map((img: any) => (
                        <img key={img.id} src={img.image_url} alt="" className="rounded-lg object-cover aspect-square w-full" />
                      ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-ui text-muted-foreground mb-1">Feedback (required for changes)</p>
                <Textarea
                  placeholder="Notes for the creator..."
                  value={templateNotes}
                  onChange={(e) => setTemplateNotes(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handlePublishTemplate}
                  disabled={templateActioning}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {templateActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={16} className="mr-1" />}
                  Publish
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRequestChanges}
                  disabled={templateActioning || !templateNotes.trim()}
                  className="flex-1 border-primary text-primary hover:bg-primary/10"
                >
                  Request Changes
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Application review panel */}
      <Sheet open={appPanelOpen} onOpenChange={setAppPanelOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-heading">Review Application</SheetTitle>
          </SheetHeader>
          {reviewApp && (
            <div className="space-y-4 mt-4">
              <div>
                <p className="text-sm font-ui text-foreground font-medium">{reviewApp.profiles?.full_name ?? "Unknown"}</p>
              </div>
              {reviewApp.motivation && (
                <div>
                  <p className="text-xs font-ui text-muted-foreground mb-1">Motivation</p>
                  <p className="text-sm text-foreground">{reviewApp.motivation}</p>
                </div>
              )}
              {reviewApp.portfolio_url && (
                <div>
                  <p className="text-xs font-ui text-muted-foreground mb-1">Portfolio</p>
                  <a href={reviewApp.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{reviewApp.portfolio_url}</a>
                </div>
              )}
              {reviewApp.experience && (
                <div>
                  <p className="text-xs font-ui text-muted-foreground mb-1">Experience</p>
                  <p className="text-sm text-foreground">{reviewApp.experience}</p>
                </div>
              )}
              {reviewApp.sample_prompt && (
                <div>
                  <p className="text-xs font-ui text-muted-foreground mb-1">Sample Prompt</p>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap">
                    {reviewApp.sample_prompt}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-ui text-muted-foreground mb-1">Notes (required)</p>
                <Textarea
                  placeholder="Admin notes..."
                  value={appNotes}
                  onChange={(e) => setAppNotes(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleApproveApp}
                  disabled={appActioning || !appNotes.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {appActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={16} className="mr-1" />}
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRejectApp}
                  disabled={appActioning || !appNotes.trim()}
                  className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                >
                  <X size={16} className="mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
