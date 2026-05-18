/**
 * sceneToolingContract.ts
 *
 * The stable internal protocol for the Kinika scene engine.
 * Defines all public API surfaces: orchestrator, mutation, patch,
 * generation, export, timeline, and analytics.
 *
 * Consumers import this contract — not individual modules.
 */

import type { SceneDocument, SceneNode } from '@/types/scene';
import type { MutationId, MutationParams, MutationResult, MutationChain } from './mutations/mutationTypes';
import type { PatchOp, PatchResult } from './scenePatchEngine';
import type { EditIntent } from './parseCreativeInstruction';
import type { OrchestratorResult, OrchestratorContext } from './sceneAiOrchestrator';
import type { PipelineResult, PipelineOptions, AiCallerFn } from './sceneGenerationPipeline';
import type { PromptCompilerInput, CompiledPrompt } from './compileScenePrompt';
import type { ExportRequest, ExportResult, BatchExportRequest, BatchExportResult } from './sceneExportManager';
import type { TimelineView, TimelineEntry, RevisionComparison } from './sceneTimeline';
import type { QualityEvaluation, EvaluationOptions } from './evaluateSceneQuality';
import type { SceneCritique, CritiqueOptions } from './critiqueScene';
import type { RepairResult, RepairOptions } from './repairScene';
import type { RefinementResult, RefinementOptions } from './refineComposition';
import type { ReflowResult, ReflowOptions } from './reflowScene';
import type { DesignTokens } from './sceneTokens';
import type { CreativeMode, ModeConfig } from './creativeModes';
import type { VariationStyle, SceneVariation, VariationOptions } from './generateSceneVariations';
import type { RegenerateRequest, RegenerateContext } from './smartRegenerate';
import type { SnapshotSource } from './sceneVersioning';
import type { AnalyticsSnapshot, AnalyticsEventType } from './sceneAnalytics';

// ─── Contract Interfaces ─────────────────────────────────────

/**
 * Orchestrator API — the AI command router.
 */
export interface IOrchestratorApi {
  /** Process a natural language instruction. */
  editFromInstruction(scene: SceneDocument, instruction: string, context?: OrchestratorContext): OrchestratorResult;
  /** Process a structured intent. */
  editFromIntent(scene: SceneDocument, intent: EditIntent, context?: OrchestratorContext): OrchestratorResult;
}

/**
 * Mutation API — scene and node mutations.
 */
export interface IMutationApi {
  applyMutation(scene: SceneDocument, id: MutationId, params: MutationParams): MutationResult;
  applyChain(scene: SceneDocument, steps: Array<{ id: MutationId; params: MutationParams }>): MutationChain;
  findNode(scene: SceneDocument, nodeId: string): SceneNode | null;
  findNodes(scene: SceneDocument, predicate: (n: SceneNode) => boolean): SceneNode[];
  replaceNode(scene: SceneDocument, nodeId: string, updater: (n: SceneNode) => SceneNode): SceneDocument;
  removeNode(scene: SceneDocument, nodeId: string): SceneDocument;
  addNode(scene: SceneDocument, node: SceneNode): SceneDocument;
}

/**
 * Patch API — node-level editing.
 */
export interface IPatchApi {
  applyPatches(scene: SceneDocument, patches: PatchOp[]): PatchResult;
}

/**
 * Generation API — AI generation pipeline.
 */
export interface IGenerationApi {
  compilePrompt(input: PromptCompilerInput): CompiledPrompt;
  runPipeline(input: PromptCompilerInput, aiCall: AiCallerFn, options?: PipelineOptions): Promise<PipelineResult>;
}

/**
 * Export API — scene export orchestration.
 */
export interface IExportApi {
  exportScene(request: ExportRequest): Promise<ExportResult>;
  exportBatch(request: BatchExportRequest): Promise<BatchExportResult>;
  downloadExport(result: ExportResult): void;
}

/**
 * Timeline API — version history and branching.
 */
export interface ITimelineApi {
  push(scene: SceneDocument, source: SnapshotSource, label: string): TimelineEntry;
  undo(): SceneDocument | null;
  redo(): SceneDocument | null;
  restore(snapshotId: string): SceneDocument | null;
  getTimeline(branch?: string): TimelineView;
  compare(fromId: string, toId: string): RevisionComparison | null;
  createBranch(name: string): TimelineEntry;
}

/**
 * Quality API — evaluation, critique, repair, refinement.
 */
export interface IQualityApi {
  evaluate(scene: SceneDocument, options?: EvaluationOptions): QualityEvaluation;
  critique(scene: SceneDocument, options?: CritiqueOptions): SceneCritique;
  repair(scene: SceneDocument, options?: RepairOptions): RepairResult;
  refine(scene: SceneDocument, options?: RefinementOptions): RefinementResult;
}

/**
 * Reflow API — responsive adaptation.
 */
export interface IReflowApi {
  reflow(scene: SceneDocument, options: ReflowOptions): ReflowResult;
  reflowToPreset(scene: SceneDocument, preset: string): ReflowResult;
}

/**
 * Tokens API — design token system.
 */
export interface ITokensApi {
  apply(scene: SceneDocument, tokens: DesignTokens): SceneDocument;
  extract(scene: SceneDocument): DesignTokens;
  merge(base: DesignTokens, overrides: Partial<DesignTokens>): DesignTokens;
}

/**
 * Modes API — creative modes.
 */
export interface IModesApi {
  getMode(mode: CreativeMode): ModeConfig;
  getAllModes(): ModeConfig[];
  applyToTokens(tokens: DesignTokens, mode: CreativeMode): DesignTokens;
}

/**
 * Variations API — campaign variation engine.
 */
export interface IVariationsApi {
  generate(scene: SceneDocument, options?: VariationOptions): SceneVariation[];
  generateSingle(scene: SceneDocument, style: VariationStyle, options?: VariationOptions): SceneVariation;
}

/**
 * Regeneration API — smart selective regeneration.
 */
export interface IRegenerationApi {
  buildContext(scene: SceneDocument, request: RegenerateRequest): RegenerateContext;
  applyRegenerated(context: RegenerateContext, newNodes: SceneNode[]): SceneDocument;
  toPromptBlock(context: RegenerateContext): string;
}

/**
 * Analytics API — tracking and intelligence.
 */
export interface IAnalyticsApi {
  track(type: AnalyticsEventType, data?: Record<string, unknown>): void;
  getSnapshot(): AnalyticsSnapshot;
  getAcceptanceRate(): number;
}

// ─── Unified Contract ────────────────────────────────────────

/**
 * The complete Kinika scene engine contract.
 * All consumer-facing functionality is accessible through this interface.
 */
export interface ISceneEngine {
  orchestrator: IOrchestratorApi;
  mutations: IMutationApi;
  patches: IPatchApi;
  generation: IGenerationApi;
  exports: IExportApi;
  timeline: ITimelineApi;
  quality: IQualityApi;
  reflow: IReflowApi;
  tokens: ITokensApi;
  modes: IModesApi;
  variations: IVariationsApi;
  regeneration: IRegenerationApi;
  analytics: IAnalyticsApi;
}

// ─── Version ─────────────────────────────────────────────────

export const SCENE_ENGINE_VERSION = '4.0.0';
export const SCENE_ENGINE_PHASES = ['rendering', 'composition', 'intelligence', 'productization'] as const;
