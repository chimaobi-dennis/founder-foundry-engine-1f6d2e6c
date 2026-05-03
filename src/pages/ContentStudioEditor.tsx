import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import {
  getBriefWithCreatives,
  regenerateCreative,
  approveCreativeToCalendar,
} from "@/services/contentStudioService";
import { supabase } from "@/integrations/supabase/client";
import { StudioEditor } from "@/components/prostudio/StudioEditor";
import type { CanvasItem } from "@/components/prostudio/CanvasSwitcher";

const db = supabase as any;

interface Creative {
  id: string;
  platform_id: string;
  headline: string | null;
  copy_text: string | null;
  subject_line: string | null;
  hashtags: string[] | null;
  visual_html: string | null;
  status: string | null;
  is_approved: boolean | null;
  scheduled_at: string | null;
  content_platforms: any;
}

export default function ContentStudioEditor() {
  const { briefId } = useParams<{ briefId: string }>();
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [brief, setBrief] = useState<any>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const pollRef = useRef<number | null>(null);

  const load = async () => {
    if (!briefId) return;
    try {
      const data = await getBriefWithCreatives(briefId);
      setBrief(data);
      const cs: Creative[] = data.content_studio_creatives || [];
      cs.sort(
        (a, b) =>
          (a.content_platforms?.sort_order ?? 0) -
          (b.content_platforms?.sort_order ?? 0)
      );
      setCreatives(cs);
      if (!activeId && cs.length) setActiveId(cs[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [briefId]);

  // Poll while any creative is still generating
  useEffect(() => {
    const generating =
      brief?.status === "generating" ||
      creatives.some((c) => c.status === "generating");
    if (!generating) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = window.setInterval(load, 3000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [brief?.status, creatives]);

  const active = creatives.find((c) => c.id === activeId) || null;
  const readyCount = creatives.filter((c) => c.status === "ready").length;
  const approvedCount = creatives.filter((c) => c.is_approved).length;

  const updateCreativeLocal = (id: string, patch: Partial<Creative>) => {
    setCreatives((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const saveCopy = async (id: string, patch: Partial<Creative>) => {
    updateCreativeLocal(id, patch);
    await db.from("content_studio_creatives").update(patch).eq("id", id);
  };

  const handleRegenerateVisual = async () => {
    if (!active || !activeBrand?.id) return;
    setRegenerating(true);
    updateCreativeLocal(active.id, { status: "generating" });
    const platformName = active.content_platforms?.name || "Platform";
    toast.loading(`Regenerating ${platformName} visual…`, { id: `regen-${active.id}` });
    try {
      const html = await regenerateCreative(active.id, activeBrand.id);
      updateCreativeLocal(active.id, { visual_html: html, status: "ready" });
      toast.success("✓ Visual updated", { id: `regen-${active.id}` });
    } catch (e: any) {
      toast.error(e.message || "Regeneration failed", { id: `regen-${active.id}` });
      updateCreativeLocal(active.id, { status: "ready" });
    } finally {
      setRegenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!active) return;
    try {
      // For now, just mark as approved without scheduling
      await db.from("content_studio_creatives").update({ is_approved: true }).eq("id", active.id);
      updateCreativeLocal(active.id, { is_approved: true });
      toast.success("Creative approved");
    } catch (e: any) {
      toast.error(e.message || "Failed to approve");
    }
  };

  const handleSaveCreative = async () => {
    if (!active) return;
    try {
      await db.from("content_studio_creatives").update({
        headline: active.headline,
        copy_text: active.copy_text,
        subject_line: active.subject_line,
        hashtags: active.hashtags,
      }).eq("id", active.id);
      toast.success("Creative saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
  };

  // Map creatives to CanvasItem format for StudioEditor
  const canvases: CanvasItem[] = useMemo(
    () =>
      creatives.map((c) => ({
        id: c.id,
        html: c.visual_html,
        label: c.content_platforms?.name || "Platform",
        platformIcon: c.content_platforms?.brand_color || "#8A96A3",
        platformSlug: c.content_platforms?.slug,
        copyText: c.copy_text,
        headline: c.headline,
        hashtags: c.hashtags,
        subjectLine: c.subject_line,
        characterLimit: c.content_platforms?.character_limit,
        canvasWidth: c.content_platforms?.image_width || 600,
        canvasHeight: c.content_platforms?.image_height || 600,
        status: c.status || "ready",
        isApproved: !!c.is_approved,
      })),
    [creatives]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <p className="text-muted-foreground">Brief not found</p>
        <button
          onClick={() => navigate("/content-studio")}
          className="text-primary mt-4 hover:underline"
        >
          Back to ContentStudio
        </button>
      </div>
    );
  }

  return (
    <StudioEditor
      open={true}
      onClose={() => navigate("/content-studio")}
      templateName={brief.name}
      variationHtml={active?.visual_html || null}
      variationId={activeId || ""}
      brandId={activeBrand?.id}
      mode="content-studio"
      briefName={brief.name}
      readyCount={readyCount}
      totalCount={creatives.length}
      canvases={canvases}
      activeCanvasId={activeId}
      onSelectCanvas={setActiveId}
      onSaveCreative={handleSaveCreative}
      onRegenerateVisual={handleRegenerateVisual}
      regenerating={regenerating}
      onApproveActive={handleApprove}
      onApproveAll={() => toast.info("Bulk approve coming soon")}
    />
  );
}
