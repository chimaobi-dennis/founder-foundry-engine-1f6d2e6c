// Public API for the scene editor module.
export { SceneEditor } from "./SceneEditor";
export { SceneCanvas } from "./SceneCanvas";
export { SceneRenderer } from "./SceneRenderer";
export { SceneToolbar } from "./SceneToolbar";
export { SceneLayersPanel } from "./SceneLayersPanel";
export { ScenePropertiesPanel } from "./ScenePropertiesPanel";
export { EngineSwitch } from "./EngineSwitch";
export { SceneStoreProvider, useSceneStore, useSceneStoreSafe, sceneHelpers } from "./sceneStore";
export { useSceneAutosave } from "./useSceneAutosave";
export { useSceneExport } from "./useSceneExport";
export { SceneDebugOverlay } from "./SceneDebugOverlay";
export { SceneFrameNode } from "./SceneFrameNode";
export { SceneStackNode } from "./SceneStackNode";
export { SceneSvgNode } from "./SceneSvgNode";
export { SceneIconNode } from "./SceneIconNode";
export { SceneButtonNode } from "./SceneButtonNode";

// Phase 5 — Experience Layer
export { AiCopilotPanel } from "./AiCopilotPanel";
export { ScenePatchPreview } from "./ScenePatchPreview";
export { SceneTimelinePanel } from "./SceneTimelinePanel";
export { CampaignWorkspace } from "./CampaignWorkspace";
export { TokenEditor } from "./TokenEditor";
export { AiQuickActions } from "./AiQuickActions";
export { SceneCommandPalette } from "./SceneCommandPalette";
export { ExportPanel } from "./ExportPanel";
export { AiLoadingOverlay, AiStatusPill } from "./AiLoadingOverlay";
export { SmartInspector } from "./SmartInspector";
export { SceneDiffOverlay } from "./SceneDiffOverlay";
export { FadeIn, SlidePanel, PulseHighlight, ScaleHover, Stagger, Shimmer, PropagationFlash } from "./SceneMotion";
export { FocusModeControls, FocusModeToggle } from "./FocusMode";
export { UnifiedToolbar } from "./UnifiedToolbar";
export { DemoShowcase } from "./DemoShowcase";
export { useSortedNodes, useDebouncedUpdate, useVisibleNodeIds, useSceneComplexity } from "./useScenePerformance";
export { EDITOR_SPACING, EDITOR_COLORS, EDITOR_TYPE, EDITOR_TRANSITIONS, EDITOR_Z, EDITOR_SHORTCUTS } from "./designTokens";
