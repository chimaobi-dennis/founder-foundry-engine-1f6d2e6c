import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/use-profile";
import { getCreatorTemplates } from "@/services/templateService";
import { Plus, Image, Eye, EyeOff, Edit2 } from "lucide-react";
import { CreatorStudioSkeleton } from "@/components/skeletons/PageSkeletons";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { updateTemplate } from "@/services/templateService";
import { useToast } from "@/hooks/use-toast";

interface CreatorTemplate {
  id: string;
  name: string;
  category: string;
  template_type: string;
  status: string;
  uses_count: number;
  created_at: string;
  cover_image_url: string | null;
  template_preview_images?: { id: string; image_url: string; is_cover: boolean; sort_order: number }[];
}

export default function CreatorStudio() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<CreatorTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const isCreatorOrAdmin = profile?.role === "creator" || profile?.role === "admin";

  useEffect(() => {
    if (!isCreatorOrAdmin) return;
    loadTemplates();
  }, [user, isCreatorOrAdmin]);

  const loadTemplates = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await getCreatorTemplates(user.id);
    setTemplates((data as any) || []);
    setLoading(false);
  };

  if (!isCreatorOrAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-muted-foreground font-ui text-sm">You don't have access to Creator Studio.</p>
      </div>
    );
  }

  const published = templates.filter((t) => t.status === "published").length;
  const totalUses = templates.reduce((sum, t) => sum + (t.uses_count || 0), 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  // For "this month" we'd need per-use timestamps; approximate with 0 for now
  const thisMonthUses = 0;

  const stats = [
    { label: "Total templates", value: templates.length },
    { label: "Published", value: published },
    { label: "Total uses", value: totalUses },
    { label: "This month", value: thisMonthUses },
  ];

  const statusColor: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    pending_review: "bg-yellow-500/15 text-yellow-500",
    published: "bg-green-500/15 text-green-500",
    unpublished: "bg-red-500/15 text-red-400",
  };

  const handleTogglePublish = async (t: CreatorTemplate) => {
    const newStatus = t.status === "published" ? "unpublished" : t.status === "unpublished" ? "published" : null;
    if (!newStatus) return;
    const result = await updateTemplate(t.id, { status: newStatus });
    if (result.success) {
      toast({ title: newStatus === "published" ? "Template republished" : "Template unpublished" });
      loadTemplates();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-foreground">Creator Studio</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-ui text-muted-foreground">{profile?.full_name || "Creator"}</span>
            <Badge className="bg-green-500/15 text-green-500 border-0 text-[11px]">Approved Creator</Badge>
          </div>
        </div>
        <button
          onClick={() => navigate("/creator/templates/new")}
          className="flex items-center gap-2 h-11 px-5 rounded-lg bg-primary text-primary-foreground font-ui text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          New template
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-[11px] font-ui uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-display text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Templates table */}
      {loading ? (
        <CreatorStudioSkeleton />
      ) : templates.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground font-ui text-sm">No templates yet. Create your first one!</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Uses</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/creator/templates/${t.id}`)}
                >
                  <TableCell>
                    {t.cover_image_url ? (
                      <img src={t.cover_image_url} alt="" className="w-10 h-10 rounded-md object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                        <Image size={16} className="text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="font-ui text-sm text-foreground">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">{t.category}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px] capitalize">{t.template_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-ui font-medium ${statusColor[t.status] || ""}`}>
                      {t.status === "pending_review" ? "Pending" : t.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-ui text-sm">{t.uses_count || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/creator/templates/${t.id}`)}
                        className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      {(t.status === "published" || t.status === "unpublished") && (
                        <button
                          onClick={() => handleTogglePublish(t)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title={t.status === "published" ? "Unpublish" : "Republish"}
                        >
                          {t.status === "published" ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
