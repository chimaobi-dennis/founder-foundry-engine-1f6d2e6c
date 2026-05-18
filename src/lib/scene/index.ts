/**
 * Scene engine barrel export.
 *
 * Import from '@/lib/scene' to access the full rendering pipeline:
 *   validation, normalization, migrations, safe wrappers,
 *   AI parsing, composition, and studio bridge.
 */

// ─── Phase 1: Core Engine ─────────────────────────────────────

export {
  validateSceneDocument,
  normalizeSceneDocument,
  normalizeNode,
  clampBounds,
  sanitizeColor,
  type ValidationResult,
} from './validateSceneDocument';

export {
  migrateScene,
  needsMigration,
  CURRENT_SCENE_VERSION,
} from './sceneMigrations';

export {
  prepareScene,
  safeRenderToCanvas,
  safeRenderToSVG,
  safeExport,
  type PrepareResult,
} from './safeRenderScene';

// ─── Phase 2: AI Composition Pipeline ─────────────────────────

export {
  parseAISceneResponse,
  parseAIPlatformOutput,
  parseMultiPlatformResponse,
  type AISceneResult,
  type AISceneResultType,
} from './parseAISceneResponse';

export {
  htmlToScene,
  type HtmlToSceneOptions,
} from './htmlToScene';

export {
  generateCompositionRules,
  rulesToPromptBlock,
  type CompositionRules,
  type BrandContext,
  type PlatformConstraints,
  type CompositionIntent,
} from './aiCompositionRules';

export {
  getBlueprint,
  getBlueprintOrDefault,
  getAllBlueprints,
  blueprintToPromptBlock,
  type PlatformBlueprint,
} from './platformBlueprints';

export {
  stableSceneHash,
  stableSerialize,
  scenesEqual,
} from './stableSceneHash';

export {
  buildAssetManifest,
  preloadSceneAssets,
  hasExternalAssets,
  type AssetManifest,
  type PreloadResult,
} from './sceneAssetResolver';

export {
  prepareStudioScene,
  toSessionPayload,
  fromSessionPayload,
  mergeSceneNodes,
  cloneScene,
  isCompatible,
  type StudioType,
  type StudioScenePayload,
  type StudioExportRequest,
} from './studioBridge';

// ─── Phase 3: AI-Native Creative Intelligence ────────────────

export {
  applyMutation,
  applyMutationChain,
  replaceHeadline,
  rewriteCta,
  swapTypography,
  changeColorDirection,
  adjustSpacing,
  increaseDensity,
  simplifyComposition,
  boostContrast,
  findNode,
  findNodes,
  replaceNode,
  removeNode,
  addNode,
  addChildNode,
  updateText,
  updateFill,
  updateTextColor,
  resizeNode,
  repositionNode,
} from './mutations';

export type {
  MutationId,
  MutationParams,
  MutationResult,
  MutationChain,
} from './mutations';

export {
  applyPatches,
  patchUpdate,
  patchResize,
  patchReposition,
  patchRemove,
  type PatchOp,
  type PatchResult,
} from './scenePatchEngine';

export {
  diffScenes,
  scenesChanged,
  diffSummary,
  type SceneDiffResult,
  type NodeDiff,
} from './sceneDiff';

export {
  SceneHistory,
  type SceneSnapshot,
  type SnapshotSource,
  type VersionTimeline,
} from './sceneVersioning';

export {
  refineComposition,
  type RefinementResult,
  type RefinementOptions,
} from './refineComposition';

export {
  reflowScene,
  reflowToPreset,
  REFLOW_PRESETS,
  type ReflowOptions,
  type ReflowResult,
} from './reflowScene';

export {
  createHeroSection,
  createCTASection,
  createMetricsRow,
  createQuoteBlock,
  createTestimonialCard,
  createFeatureGrid,
  createSplitPanel,
  createEditorialHeader,
} from './smartComponents';

export {
  applyTokens,
  mergeTokens,
  createDefaultTokens,
  extractTokensFromScene,
  type DesignTokens,
  type ColorTokens,
  type TypographyTokens,
} from './sceneTokens';

export {
  BrandMemoryManager,
  fingerprintScene,
  type SceneFingerprint,
  type BrandMemory,
  type BrandTendencies,
} from './sceneBrandMemory';

export {
  generateStrategy,
  strategyToPromptBlock,
  type StrategyInput,
  type CreativeStrategy,
} from './creativeStrategist';

export {
  compileScenePrompt,
  type PromptCompilerInput,
  type CompiledPrompt,
} from './compileScenePrompt';

export {
  evaluateSceneQuality,
  type QualityEvaluation,
  type QualityIssue,
  type EvaluationOptions,
} from './evaluateSceneQuality';

export {
  repairScene,
  type RepairResult,
  type RepairAction,
  type RepairOptions,
} from './repairScene';

export {
  generateVariations,
  generateVariation,
  generateCustomVariation,
  type VariationStyle,
  type SceneVariation,
  type VariationOptions,
} from './generateSceneVariations';

// ─── Phase 4: Productization Layer ───────────────────────────

export {
  orchestrateEdit,
  orchestrateIntent,
  type OrchestratorResult,
  type OrchestratorAction,
  type OrchestratorContext,
} from './sceneAiOrchestrator';

export {
  parseCreativeInstruction,
  type EditIntent,
  type EditIntentType,
} from './parseCreativeInstruction';

export {
  SceneSessionManager,
  type SessionState,
  type AiAction,
  type SessionEvents,
} from './sceneSessionManager';

export {
  runGenerationPipeline,
  type PipelineResult,
  type PipelineStage,
  type PipelineOptions,
  type AiCallerFn,
} from './sceneGenerationPipeline';

export {
  SceneTimelineManager,
  type TimelineEntry,
  type TimelineView,
  type RevisionComparison,
} from './sceneTimeline';

export {
  buildRegenerateContext,
  applyRegeneratedNodes,
  regenerateToPromptBlock,
  type RegenerateScope,
  type RegenerateRequest,
  type RegenerateContext,
} from './smartRegenerate';

export {
  critiqueScene,
  type SceneCritique,
  type CritiqueItem,
  type CritiqueOptions,
} from './critiqueScene';

export {
  getMode,
  getAllModes,
  applyModeToTokens,
  modeToPromptBlock,
  type CreativeMode,
  type ModeConfig,
} from './creativeModes';

export {
  createCampaign,
  addCampaignAsset,
  updateCampaignTokens,
  approveAsset,
  getCampaignStats,
  type Campaign,
  type CampaignAsset,
  type CampaignGenerationRequest,
} from './campaignSceneSystem';

export {
  exportScene,
  exportBatch,
  downloadExport,
  type ExportFormat,
  type ExportRequest,
  type ExportResult,
  type BatchExportRequest,
  type BatchExportResult,
} from './sceneExportManager';

export {
  SceneAnalyticsManager,
  type AnalyticsEvent,
  type AnalyticsSnapshot,
  type AnalyticsEventType,
} from './sceneAnalytics';

export {
  SceneRecoveryManager,
  localStorageAdapter,
  createMemoryStorage,
  type RecoverySnapshot,
  type RecoveryStorage,
  type RecoveryOptions,
} from './sceneRecovery';

export {
  cullToViewport,
  SceneRenderCache,
  ImageMemoryManager,
  MutationBatcher,
  estimateComplexity,
  type Viewport,
  type CullingResult,
} from './sceneRuntimeOptimizer';

export {
  SCENE_ENGINE_VERSION,
  SCENE_ENGINE_PHASES,
  type ISceneEngine,
  type IOrchestratorApi,
  type IMutationApi,
  type IPatchApi,
  type IGenerationApi,
  type IExportApi,
  type ITimelineApi,
  type IQualityApi,
  type IReflowApi,
  type ITokensApi,
  type IModesApi,
  type IVariationsApi,
  type IRegenerationApi,
  type IAnalyticsApi,
} from './sceneToolingContract';

// ─── Phase 6A: Reliability Layer ──────────────────────────────
export {
  validateScene,
  checkExportSafety,
  type SceneValidationResult,
  type SceneMetrics,
  type QualityTier,
  type GatewayOptions,
  type ExportSafetyResult,
  type ExportSafetyIssue,
} from './sceneValidationGateway';
