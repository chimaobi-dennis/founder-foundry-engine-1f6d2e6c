import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/use-profile";
import {
  createTemplate,
  updateTemplate,
  uploadTemplatePreviewImage,
  getCreatorTemplates,
} from "@/services/templateService";
import { useToast } from "@/hooks/use-toast";
import { CreatorTemplateEditorSkeleton } from "@/components/skeletons/PageSkeletons";
import { FadeIn } from "@/components/FadeIn";
import { ArrowLeft, Upload, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const categories = ["Skincare", "Food & Beverage", "Fashion", "Jewellery", "Electronics", "Home Decor", "Cosmetics", "General"];
const digitalOutputTypes = ["Social Media Post", "Story", "Banner", "Logo", "Mockup", "Presentation"];

export default function CreatorTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [templateId, setTemplateId] = useState(id || "");
  const [images, setImages] = useState<{ id: string; image_url: string; sort_order: number }[]>([]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    templateType: "physical" as "physical" | "digital",
    category: "General",
    digitalOutputType: "",
    bestFor: "",
    generationPrompt: "",
    previewBackground: "#1A2A3A",
    priceCredits: 1,
    isFree: true,
  });
  const [status, setStatus] = useState("draft");

  const isCreatorOrAdmin = profile?.role === "creator" || profile?.role === "admin";
  const isEditable = status === "draft" || status === "unpublished";

  useEffect(() => {
    if (!isNew && user) loadTemplate();
  }, [id, user]);

  const loadTemplate = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await getCreatorTemplates(user.id);
    const t = (data as any[])?.find((t: any) => t.id === id);
    if (t) {
      setForm({
        name: t.name || "",
        description: t.description || "",
        templateType: t.template_type || "physical",
        category: t.category || "General",
        digitalOutputType: t.digital_output_type || "",
        bestFor: (t.best_for || []).join(", "),
        generationPrompt: t.generation_prompt || "",
        previewBackground: t.preview_background || "#1A2A3A",
        priceCredits: t.price_credits || 1,
        isFree: t.is_free !== false,
      });
      setStatus(t.status || "draft");
      setImages(t.template_preview_images || []);
      setTemplateId(t.id);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (isNew && !templateId) {
        const result = await createTemplate(user.id, {
          ...form,
          bestFor: form.bestFor.split(",").map((s) => s.trim()).filter(Boolean),
        });
        if (result.success && result.templateId) {
          setTemplateId(result.templateId);
          toast({ title: "Template created" });
          navigate(`/creator/templates/${result.templateId}`, { replace: true });
        } else {
          toast({ title: "Error", description: result.error, variant: "destructive" });
        }
      } else {
        const result = await updateTemplate(templateId, {
          ...form,
          bestFor: form.bestFor.split(",").map((s) => s.trim()).filter(Boolean),
        });
        if (result.success) {
          toast({ title: "Template saved" });
        } else {
          toast({ title: "Error", description: result.error, variant: "destructive" });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    const result = await updateTemplate(templateId, { status: "pending_review" });
    if (result.success) {
      setStatus("pending_review");
      toast({ title: "Submitted for review", description: "Your template has been submitted. We will review it within 2 business days." });
    }
  };

  const handleUnpublish = async () => {
    const result = await updateTemplate(templateId, { status: "unpublished" });
    if (result.success) { setStatus("unpublished"); toast({ title: "Template unpublished" }); }
  };

  const handleRepublish = async () => {
    const result = await updateTemplate(templateId, { status: "published" });
    if (result.success) { setStatus("published"); toast({ title: "Template republished" }); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !templateId) return;
    const result = await uploadTemplatePreviewImage(templateId, file, images.length);
    if (result.success && result.imageUrl) {
      setImages([...images, { id: Date.now().toString(), image_url: result.imageUrl, sort_order: images.length }]);
      toast({ title: "Image uploaded" });
    } else {
      toast({ title: "Upload failed", description: result.error, variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!isCreatorOrAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-muted-foreground font-ui text-sm">Access denied.</p>
      </div>
    );
  }

  if (loading) {
    return <CreatorTemplateEditorSkeleton />;
  }

  return (
    <FadeIn>
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/creator")} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-xl text-foreground">{isNew ? "New template" : form.name || "Edit template"}</h1>
        {!isNew && (
          <Badge className={`ml-2 text-[11px] border-0 capitalize ${
            status === "published" ? "bg-green-500/15 text-green-500" :
            status === "pending_review" ? "bg-yellow-500/15 text-yellow-500" :
            status === "unpublished" ? "bg-red-500/15 text-red-400" :
            "bg-muted text-muted-foreground"
          }`}>
            {status === "pending_review" ? "Pending review" : status}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left — Form */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <Label className="text-xs font-ui text-muted-foreground">Template name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!isEditable} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-ui text-muted-foreground">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!isEditable} className="mt-1" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-ui text-muted-foreground">Type</Label>
                <select
                  value={form.templateType}
                  onChange={(e) => setForm({ ...form, templateType: e.target.value as any })}
                  disabled={!isEditable}
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-ui"
                >
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-ui text-muted-foreground">Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  disabled={!isEditable}
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-ui"
                >
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {form.templateType === "digital" && (
              <div>
                <Label className="text-xs font-ui text-muted-foreground">Output type</Label>
                <select
                  value={form.digitalOutputType}
                  onChange={(e) => setForm({ ...form, digitalOutputType: e.target.value })}
                  disabled={!isEditable}
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-ui"
                >
                  <option value="">Select...</option>
                  {digitalOutputTypes.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
            <div>
              <Label className="text-xs font-ui text-muted-foreground">Best for (comma-separated)</Label>
              <Input value={form.bestFor} onChange={(e) => setForm({ ...form, bestFor: e.target.value })} disabled={!isEditable} className="mt-1" placeholder="Skincare, Cosmetics" />
            </div>
            <div>
              <Label className="text-xs font-ui text-muted-foreground">Generation prompt</Label>
              <Textarea value={form.generationPrompt} onChange={(e) => setForm({ ...form, generationPrompt: e.target.value })} disabled={!isEditable} className="mt-1" rows={4} placeholder="The AI prompt used to generate outputs..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-ui text-muted-foreground">Preview background</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={form.previewBackground} onChange={(e) => setForm({ ...form, previewBackground: e.target.value })} disabled={!isEditable} className="w-10 h-10 rounded border-0 cursor-pointer" />
                  <Input value={form.previewBackground} onChange={(e) => setForm({ ...form, previewBackground: e.target.value })} disabled={!isEditable} className="flex-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-ui text-muted-foreground">Price (credits)</Label>
                <Input type="number" value={form.priceCredits} onChange={(e) => setForm({ ...form, priceCredits: Number(e.target.value) })} disabled={!isEditable} className="mt-1" min={0} />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {isEditable && (
              <button onClick={handleSave} disabled={saving || !form.name} className="h-11 px-6 rounded-lg bg-primary text-primary-foreground font-ui text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
                {saving && <span className="h-2.5 w-2.5 rounded-full bg-current/40 animate-pulse" />}
                {isNew ? "Create template" : "Save changes"}
              </button>
            )}
            {status === "draft" && templateId && (
              <button onClick={handleSubmitForReview} className="h-11 px-6 rounded-lg border border-primary text-primary font-ui text-sm font-medium hover:bg-primary/10 transition-colors">
                Submit for review
              </button>
            )}
            {status === "published" && (
              <button onClick={handleUnpublish} className="h-11 px-6 rounded-lg border border-border text-muted-foreground font-ui text-sm hover:bg-muted/50 transition-colors">
                Unpublish
              </button>
            )}
            {status === "unpublished" && (
              <button onClick={handleRepublish} className="h-11 px-6 rounded-lg border border-primary text-primary font-ui text-sm font-medium hover:bg-primary/10 transition-colors">
                Republish
              </button>
            )}
          </div>
        </div>

        {/* Right — Preview images */}
        <div className="space-y-4">
          <h3 className="font-ui text-sm text-foreground font-medium">Preview images</h3>
          <div className="space-y-3">
            {images.sort((a, b) => a.sort_order - b.sort_order).map((img, i) => (
              <div key={img.id} className="relative rounded-lg overflow-hidden border border-border">
                <img src={img.image_url} alt="" className="w-full aspect-square object-cover" />
                {i === 0 && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary/80 text-primary-foreground text-[10px] font-ui font-medium">
                    Cover
                  </span>
                )}
              </div>
            ))}
            {templateId && isEditable && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                <Upload size={20} />
                <span className="text-xs font-ui">Upload image</span>
              </button>
            )}
            {!templateId && isNew && (
              <p className="text-xs font-ui text-muted-foreground">Save the template first to upload images.</p>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>
      </div>
    </div>
    </FadeIn>
  );
}
