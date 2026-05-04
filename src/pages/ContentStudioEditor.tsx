import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import { useAuth } from "@/contexts/AuthContext";
import {
  getBriefWithCreatives,
  regenerateCreative,
  approveAllCreatives,
  scheduleCreative,
  rescheduleCreative,
  getScheduledCreative,
  type CalendarPost,
} from "@/services/contentStudioService";
import { deleteCalendarPost } from "@/services/calendarService";
import { supabase } from "@/integrations/supabase/client";
import { StudioEditor } from "@/components/prostudio/StudioEditor";
import { ScheduleModal } from "@/components/prostudio/content-studio/ScheduleModal";
import { ApproveScheduleAllModal, type ApproveSchedulePlatform } from "@/components/prostudio/content-studio/ApproveScheduleAllModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const { user } = useAuth();
  const [brief, setBrief] = useState<any>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [platformsMeta, setPlatformsMeta] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [allApprovedFlash, setAllApprovedFlash] = useState(false);
  const [schedulesByCreative, setSchedulesByCreative] = useState<Record<string, CalendarPost | null>>({});
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"new" | "reschedule">("new");
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [approveAllModalOpen, setApproveAllModalOpen] = useState(false);
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

  // Fetch schedule info for the active creative when it changes.
  useEffect(() => {
    if (!activeId || activeId.startsWith(PLACEHOLDER_PREFIX)) return;
    if (schedulesByCreative[activeId] !== undefined) return;
    let cancelled = false;
    (async () => {
      const post = await getScheduledCreative(activeId);
      if (!cancelled) {
        setSchedulesByCreative((prev) => ({ ...prev, [activeId]: post }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const active = creatives.find((c) => c.id === activeId) || null;
  const totalCount = brief?.selected_platform_ids?.length ?? canvases.length;
  const readyCount = creatives.filter(
    (c) => c.status === "ready" && !!c.visual_html
  ).length;
  const allApproved =
    creatives.length > 0 &&
    creatives.every((c) => c.is_approved === true || c.status === "scheduled");
  const activeSchedulePost = activeId ? schedulesByCreative[activeId] : null;
  const activeSchedule = activeSchedulePost
    ? {
        calendarPostId: activeSchedulePost.id,
        date: activeSchedulePost.scheduled_date,
        time: (activeSchedulePost.scheduled_time || "").slice(0, 5),
      }
    : null;

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

  const handleApproveAll = async () => {
    if (!briefId) return;
    // Pre-fetch schedule info for all ready creatives so the modal can
    // mark already-scheduled platforms as ineligible.
    const ready = creatives.filter(
      (c) => (c.status === "ready" || c.status === "approved" || c.status === "scheduled") && !!c.visual_html,
    );
    const missing = ready.filter((c) => schedulesByCreative[c.id] === undefined);
    if (missing.length) {
      const results = await Promise.all(
        missing.map(async (c) => [c.id, await getScheduledCreative(c.id)] as const),
      );
      setSchedulesByCreative((prev) => {
        const next = { ...prev };
        results.forEach(([id, post]) => {
          next[id] = post;
        });
        return next;
      });
    }
    setApproveAllModalOpen(true);
  };

  const approveAllPlatforms: ApproveSchedulePlatform[] = useMemo(() => {
    return creatives
      .filter(
        (c) => (c.status === "ready" || c.status === "approved" || c.status === "scheduled") && !!c.visual_html,
      )
      .map((c) => ({
        creativeId: c.id,
        platformName: c.content_platforms?.name || "Platform",
        platformColor: c.content_platforms?.brand_color || "#8A96A3",
        alreadyScheduled:
          c.status === "scheduled" || !!schedulesByCreative[c.id],
      }));
  }, [creatives, schedulesByCreative]);

  const handleApproveOnlyAll = async () => {
    if (!briefId) return;
    setApprovingAll(true);
    try {
      await approveAllCreatives(briefId);
      setCreatives((prev) =>
        prev.map((c) =>
          c.status === "ready" ? { ...c, is_approved: true, status: "approved" } : c,
        ),
      );
      toast.success("All platforms approved");
      setAllApprovedFlash(true);
      setTimeout(() => setAllApprovedFlash(false), 2000);
    } catch (e: any) {
      toast.error(e.message || "Failed to approve all");
      throw e;
    } finally {
      setApprovingAll(false);
    }
  };

  const handleScheduleSelectedAll = async (
    items: { creativeId: string; date: string; time: string }[],
    onProgress: (current: number, total: number, name: string) => void,
  ) => {
    if (!activeBrand?.id || !user?.id || !briefId) return;
    let count = 0;
    for (const item of items) {
      const c = creatives.find((cc) => cc.id === item.creativeId);
      if (!c) continue;
      count++;
      const name = c.content_platforms?.name || "Platform";
      onProgress(count, items.length, name);
      try {
        const post = await scheduleCreative({
          creativeId: c.id,
          briefId,
          brandId: activeBrand.id,
          userId: user.id,
          platformSlug: c.content_platforms?.slug,
          scheduledDate: item.date,
          scheduledTime: item.time,
          copyText: c.copy_text || undefined,
          headline: c.headline || undefined,
          visualHtml: c.visual_html || undefined,
        });
        setSchedulesByCreative((prev) => ({ ...prev, [c.id]: post }));
        updateCreativeLocal(c.id, {
          is_approved: true,
          status: "scheduled",
          scheduled_at: `${item.date} ${item.time}`,
        });
      } catch (e: any) {
        toast.error(`${name}: ${e.message || "Failed to schedule"}`);
        throw e;
      }
    }
    toast.success(`${items.length} ${items.length === 1 ? "platform" : "platforms"} scheduled`);
  };


  const handleApproveActive = () => {
    if (!active || activeSchedule) return;
    setScheduleMode("new");
    setScheduleModalOpen(true);
  };

  const handleReschedule = () => {
    if (!activeSchedule) return;
    setScheduleMode("reschedule");
    setScheduleModalOpen(true);
  };

  const handleScheduleConfirm = async (date: string, time: string) => {
    if (!active || !activeBrand?.id || !user?.id || !briefId) return;
    try {
      if (scheduleMode === "reschedule" && activeSchedule) {
        await rescheduleCreative(activeSchedule.calendarPostId, date, time);
        const updated: CalendarPost = {
          ...(activeSchedulePost as CalendarPost),
          scheduled_date: date,
          scheduled_time: time,
        };
        setSchedulesByCreative((prev) => ({ ...prev, [active.id]: updated }));
        toast.success(`Rescheduled to ${date} at ${time}`);
      } else {
        const platformSlug = active.content_platforms?.slug;
        const post = await scheduleCreative({
          creativeId: active.id,
          briefId,
          brandId: activeBrand.id,
          userId: user.id,
          platformSlug,
          scheduledDate: date,
          scheduledTime: time,
          copyText: active.copy_text || undefined,
          headline: active.headline || undefined,
          visualHtml: active.visual_html || undefined,
        });
        setSchedulesByCreative((prev) => ({ ...prev, [active.id]: post }));
        updateCreativeLocal(active.id, {
          is_approved: true,
          status: "scheduled",
          scheduled_at: `${date} ${time}`,
        });
        toast.success(`Scheduled for ${date} at ${time}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to schedule");
      throw e;
    }
  };

  const handleRemoveSchedule = () => {
    if (!activeSchedule) return;
    setRemoveConfirmOpen(true);
  };

  const confirmRemoveSchedule = async () => {
    if (!activeSchedule || !active) return;
    try {
      await deleteCalendarPost(activeSchedule.calendarPostId);
      setSchedulesByCreative((prev) => ({ ...prev, [active.id]: null }));
      updateCreativeLocal(active.id, {
        is_approved: true,
        status: "approved",
        scheduled_at: null,
      });
      toast.success("Removed from calendar");
    } catch (e: any) {
      toast.error(e.message || "Failed to remove");
    } finally {
      setRemoveConfirmOpen(false);
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

  const activePlatformName = active?.content_platforms?.name || "Platform";

  return (
    <>
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
        onApproveActive={handleApproveActive}
        activeSchedule={activeSchedule}
        onRescheduleActive={handleReschedule}
        onRemoveScheduleActive={handleRemoveSchedule}
        onApproveAll={handleApproveAll}
        approvingAll={approvingAll}
        allApproved={allApprovedFlash || allApproved}
      />

      <ScheduleModal
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        platformName={activePlatformName}
        initialDate={scheduleMode === "reschedule" ? activeSchedule?.date : undefined}
        initialTime={scheduleMode === "reschedule" ? activeSchedule?.time : undefined}
        onConfirm={handleScheduleConfirm}
        confirmLabel={scheduleMode === "reschedule" ? "Reschedule" : "Schedule"}
      />

      <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this from the calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              The scheduled post will be removed from your calendar. You can
              schedule it again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveSchedule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
