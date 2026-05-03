import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import {
  getBriefWithCreatives,
  regenerateCreative,
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

const PLACEHOLDER_PREFIX = "pending-";

export default function ContentStudioEditor() {
  const { briefId } = useParams<{ briefId: string }>();
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [brief, setBrief] = useState<any>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [platformsMeta, setPlatformsMeta] = useState<any[]>([]);
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [briefId]);

  // Fetch platform metadata for selected_platform_ids so we can show
  // placeholder canvases (with proper dimensions + names) the instant the
  // editor mounts — before any content_studio_creatives rows exist.
  useEffect(() => {
    const ids: string[] = brief?.selected_platform_ids || [];
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      const { data } = await db
        .from("content_platforms")
        .select("*")
        .in("id", ids)
        .order("sort_order");
      if (!cancelled && data) setPlatformsMeta(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [brief?.selected_platform_ids?.join("|")]);

  // Poll while initial generation is in progress OR any creative is generating.
  useEffect(() => {
    const expectedTotal = brief?.selected_platform_ids?.length ?? 0;
    const stillBuilding =
      brief?.status === "generating" ||
      creatives.length < expectedTotal ||
      creatives.some((c) => c.status === "generating" || !c.visual_html);
    if (!stillBuilding) {
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
  }, [brief?.status, brief?.selected_platform_ids?.length, creatives]);

  // Map selected platforms → canvases. Use real creative when present,
  // otherwise a placeholder in `generating` state so the loading UI shows
  // immediately on mount.
  const canvases: CanvasItem[] = useMemo(() => {
    const byPlatform = new Map<string, Creative>();
    creatives.forEach((c) => byPlatform.set(c.platform_id, c));

    const list = platformsMeta.length
      ? platformsMeta
      : creatives.map((c) => c.content_platforms).filter(Boolean);

    return list.map((p: any) => {
      const c = byPlatform.get(p.id);
      if (c) {
        return {
          id: c.id,
          html: c.visual_html,
          label: c.content_platforms?.name || p.name || "Platform",
          platformIcon: c.content_platforms?.brand_color || p.brand_color || "#8A96A3",
          platformSlug: c.content_platforms?.slug || p.slug,
          copyText: c.copy_text,
          headline: c.headline,
          hashtags: c.hashtags,
          subjectLine: c.subject_line,
          characterLimit: c.content_platforms?.character_limit ?? p.character_limit,
          canvasWidth: c.content_platforms?.image_width || p.image_width || 600,
          canvasHeight: c.content_platforms?.image_height || p.image_height || 600,
          status: (!c.visual_html && (c.status === "ready" || !c.status))
            ? "generating"
            : (c.status || "ready"),
          isApproved: !!c.is_approved,
        };
      }
      // Placeholder while generation is in flight.
      return {
        id: `${PLACEHOLDER_PREFIX}${p.id}`,
        html: null,
        label: p.name || "Platform",
        platformIcon: p.brand_color || "#8A96A3",
        platformSlug: p.slug,
        copyText: null,
        headline: null,
        hashtags: null,
        subjectLine: null,
        characterLimit: p.character_limit ?? null,
        canvasWidth: p.image_width || 600,
        canvasHeight: p.image_height || 600,
        status: "generating",
        isApproved: false,
      } as CanvasItem;
    });
  }, [creatives, platformsMeta]);

  // Default selection + reconcile when a placeholder gets replaced by a real creative.
  useEffect(() => {
    if (!canvases.length) return;
    if (!activeId) {
      setActiveId(canvases[0].id);
      return;
    }
    if (activeId.startsWith(PLACEHOLDER_PREFIX)) {
      const platformId = activeId.slice(PLACEHOLDER_PREFIX.length);
      const real = creatives.find((c) => c.platform_id === platformId);
      if (real) setActiveId(real.id);
    } else if (!canvases.find((c) => c.id === activeId)) {
      setActiveId(canvases[0].id);
    }
  }, [canvases, activeId, creatives]);

  const active = creatives.find((c) => c.id === activeId) || null;
  const totalCount =
    brief?.selected_platform_ids?.length ?? canvases.length;
  const readyCount = creatives.filter(
    (c) => c.status === "ready" && !!c.visual_html
  ).length;

  const updateCreativeLocal = (id: string, patch: Partial<Creative>) => {
    setCreatives((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
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
      totalCount={totalCount}
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
