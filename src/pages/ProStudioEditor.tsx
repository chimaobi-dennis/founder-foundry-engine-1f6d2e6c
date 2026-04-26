import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StudioEditor } from "@/components/prostudio/StudioEditor";
import { useStudioSession } from "@/contexts/StudioSessionContext";
import { getSessionOutputs } from "@/services/templateService";
import { useBrand } from "@/hooks/use-brand";
import { toast } from "@/hooks/use-toast";

const ProStudioEditor = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, setSession } = useStudioSession();
  const { activeBrand } = useBrand();
  const [hydrating, setHydrating] = useState(false);

  const sessionParam = searchParams.get("session");
  const activeParam = searchParams.get("active");

  // Hydrate the studio session from URL params if no in-memory session exists
  // (e.g. user navigated directly via deep link or refreshed the page).
  useEffect(() => {
    if (session) return; // already have a session in memory
    if (!sessionParam) {
      // No session id in URL and no in-memory session — bounce back.
      navigate("/pro-studio", { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      setHydrating(true);
      const { data, error } = await getSessionOutputs(sessionParam);
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        toast({
          title: "Session not found",
          description: "We couldn't find that design session.",
          variant: "destructive",
        });
        navigate("/pro-studio", { replace: true });
        setHydrating(false);
        return;
      }

      const sorted = [...data].sort(
        (a: any, b: any) => (a.variation_index || 0) - (b.variation_index || 0),
      );

      const canvases = sorted.map((row: any) => ({
        id: row.id as string,
        html: (row.output_html as string) || null,
      }));
      const outputIdsByCanvas: Record<string, string> = {};
      sorted.forEach((row: any) => {
        outputIdsByCanvas[row.id] = row.id;
      });

      const activeId =
        (activeParam && canvases.find(c => c.id === activeParam)?.id) || canvases[0].id;
      const activeRow = sorted.find((r: any) => r.id === activeId) || sorted[0];
      const templateName =
        (activeRow as any).prostudio_templates?.name || "Untitled design";
      const savedIds = sorted.filter((r: any) => r.is_saved_to_library).map((r: any) => r.id);

      setSession({
        templateName,
        variationId: activeId,
        variationHtml: activeRow.output_html || null,
        outputId: activeId,
        outputIdsByCanvas,
        brandId: activeBrand?.id ?? null,
        templateId: null,
        savedCanvasIds: savedIds,
        canvases,
        activeCanvasId: activeId,
        onSelectCanvas: (id) => {
          setSession((prev) => {
            if (!prev) return prev;
            const found = prev.canvases?.find((c) => c.id === id);
            return {
              ...prev,
              activeCanvasId: id,
              variationId: id,
              variationHtml: found?.html ?? null,
              outputId: prev.outputIdsByCanvas?.[id] ?? null,
            };
          });
        },
        onExit: () => {
          // Nothing to reset — we hydrated from URL only.
        },
      });
      setHydrating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [session, sessionParam, activeParam, activeBrand?.id, navigate, setSession]);

  if (!session) {
    if (hydrating) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background text-foreground text-sm">
          Loading session…
        </div>
      );
    }
    return null;
  }

  const handleClose = () => {
    // Fire origin cleanup (clears selected template / generation state in ProStudio)
    session.onExit?.();
    setSession(null);
    navigate("/pro-studio");
  };

  return (
    <StudioEditor
      open={true}
      onClose={handleClose}
      templateName={session.templateName}
      variationHtml={session.variationHtml}
      variationId={session.variationId}
      // Note: do NOT forward session.onDownload / onSaveToLibrary so the
      // editor uses its own html2canvas + storage flow.
      brandColors={session.brandColors}
      outputId={session.outputId}
      brandId={session.brandId}
      templateId={session.templateId}
      initiallySavedCanvasIds={session.savedCanvasIds}
      canvases={session.canvases}
      activeCanvasId={session.activeCanvasId}
      onSelectCanvas={session.onSelectCanvas}
      onAddBlankCanvas={session.onAddBlankCanvas}
      onAddCanvasFromTemplate={session.onAddCanvasFromTemplate}
      onDuplicateCanvas={session.onDuplicateCanvas}
      onDeleteCanvas={session.onDeleteCanvas}
      onSetMainCanvas={session.onSetMainCanvas}
    />
  );
};

export default ProStudioEditor;
