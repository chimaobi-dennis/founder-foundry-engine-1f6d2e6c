import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FadeIn } from "@/components/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Image, Check, Loader2 } from "lucide-react";
import { getAllTemplates, getTemplateDetail } from "@/services/adminService";
import { updateTemplate } from "@/services/templateService";
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
    const { data } = await getAllTemplates(
      statusFilter === "all" ? undefined : statusFilter,
      typeFilter === "all" ? undefined : typeFilter,
    );
    setTemplates(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, [statusFilter, typeFilter]);

  const openReview = async (id: string) => {
    const { data } = await getTemplateDetail(id);
    if (data) {
      setDetail(data);
      setNotes("");
      setDrawerOpen(true);
    }
  };

  const handleAction = async (action: "publish" | "unpublish" | "request_changes") => {
    if (!detail) return;
    if (action === "request_changes" && !notes.trim()) return;
    setActioning(true);
    const newStatus = action === "publish" ? "published" : action === "unpublish" ? "unpublished" : "draft";
    const res = await updateTemplate(detail.id, { status: newStatus });
    setActioning(false);
    if (res.success) {
      toast({ title: action === "publish" ? "Template published" : action === "unpublish" ? "Template unpublished" : "Changes requested" });
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
                        <span className="text-xs font-ui" style={{ color: "#8A96A3" }}>{t.profiles?.full_name ?? "Unknown"}</span>
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
            <div className="space-y-4 mt-4">
              <div>
                <p className="text-sm font-ui font-medium" style={{ color: "#F5F0E8" }}>{detail.name}</p>
                <p className="text-xs font-ui" style={{ color: "#8A96A3" }}>{detail.category} · {detail.template_type}</p>
              </div>
              {detail.description && <p className="text-sm font-ui" style={{ color: "#8A96A3" }}>{detail.description}</p>}
              
              {detail.template_preview_images?.length > 0 && (
                <div>
                  <p className="text-xs font-ui mb-2" style={{ color: "#8A96A3" }}>Preview Images</p>
                  <div className="grid grid-cols-2 gap-2">
                    {detail.template_preview_images
                      .sort((a: any, b: any) => a.sort_order - b.sort_order)
                      .map((img: any) => (
                        <img key={img.id} src={img.image_url} alt="" className="rounded-lg object-cover aspect-square w-full" />
                      ))}
                  </div>
                </div>
              )}

              {detail.generation_prompt && (
                <div>
                  <p className="text-xs font-ui mb-1" style={{ color: "#8A96A3" }}>Generation Prompt</p>
                  <pre className="rounded-lg p-3 text-xs font-mono whitespace-pre-wrap" style={{ background: "#080F18", color: "#F5F0E8", border: "0.5px solid #1A2A3A" }}>
                    {detail.generation_prompt}
                  </pre>
                </div>
              )}

              <div>
                <p className="text-xs font-ui mb-1" style={{ color: "#8A96A3" }}>Creator: {detail.profiles?.full_name ?? "Unknown"}</p>
              </div>

              <div>
                <p className="text-xs font-ui mb-1" style={{ color: "#8A96A3" }}>Feedback (required for changes)</p>
                <Textarea
                  placeholder="Notes for the creator..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-sm"
                  style={{ background: "#080F18", border: "0.5px solid #1A2A3A", color: "#F5F0E8" }}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleAction("publish")}
                  disabled={actioning}
                  className="flex-1 h-10 rounded-lg text-sm font-ui font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                  style={{ background: "#16A34A", color: "#fff" }}
                >
                  {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={16} />}
                  Publish template
                </button>
                <button
                  onClick={() => handleAction("request_changes")}
                  disabled={actioning || !notes.trim()}
                  className="flex-1 h-10 rounded-lg text-sm font-ui font-medium disabled:opacity-50"
                  style={{ border: "0.5px solid #D4A017", color: "#D4A017", background: "transparent" }}
                >
                  Request changes
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </FadeIn>
  );
}
