import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StudioEditor } from "@/components/prostudio/StudioEditor";
import { useStudioSession } from "@/contexts/StudioSessionContext";

const ProStudioEditor = () => {
  const navigate = useNavigate();
  const { session, setSession } = useStudioSession();

  // If user lands here without an active session (e.g. direct URL or refresh),
  // bounce them back to the templates grid.
  useEffect(() => {
    if (!session) {
      navigate("/pro-studio", { replace: true });
    }
  }, [session, navigate]);

  if (!session) return null;

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
