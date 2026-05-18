/**
 * sceneGenerationPipeline.ts
 *
 * The official generation flow.
 * Orchestrates: strategy → prompt → AI call → parse → validationGateway →
 * accept/reject → version snapshot.
 */

import type { SceneDocument } from '@/types/scene';
import { compileScenePrompt, type PromptCompilerInput, type CompiledPrompt } from './compileScenePrompt';
import { parseAISceneResponse, type AISceneResult } from './parseAISceneResponse';
import { prepareScene } from './safeRenderScene';
import { repairScene, type RepairResult } from './repairScene';
import { refineComposition, type RefinementResult } from './refineComposition';
import { evaluateSceneQuality, type QualityEvaluation, type EvaluationOptions } from './evaluateSceneQuality';
import { validateScene, type SceneValidationResult } from './sceneValidationGateway';
import type { CreativeStrategy } from './creativeStrategist';

// ─── Types ────────────────────────────────────────────────────

export type PipelineStage =
  | 'idle'
  | 'compiling_prompt'
  | 'calling_ai'
  | 'parsing'
  | 'validating'
  | 'repairing'
  | 'refining'
  | 'scoring'
  | 'complete'
  | 'rejected'
  | 'error';

export interface PipelineResult {
  /** Final scene (null if rejected/error). */
  scene: SceneDocument | null;
  /** Compiled prompt that was sent. */
  prompt: CompiledPrompt;
  /** Strategy used. */
  strategy: CreativeStrategy;
  /** Quality evaluation. */
  evaluation: QualityEvaluation | null;
  /** Repair result. */
  repair: RepairResult | null;
  /** Refinement result. */
  refinement: RefinementResult | null;
  /** Whether the scene was accepted. */
  accepted: boolean;
  /** Rejection reason if any. */
  rejectionReason: string | null;
  /** Total duration ms. */
  durationMs: number;
  /** Per-stage timing. */
  stages: Record<string, number>;
}

export interface PipelineOptions {
  /** If true, auto-refine weak scenes. Default true. */
  autoRefine?: boolean;
  /** If true, auto-repair defects. Default true. */
  autoRepair?: boolean;
  /** Minimum quality score to accept. Default 35. */
  minimumScore?: number;
  /** Maximum retries on rejection. Default 0 (no retry). */
  maxRetries?: number;
  /** Platform slug for safe zone / evaluation. */
  platformSlug?: string;
  /** Quality evaluation options. */
  evaluationOptions?: Partial<EvaluationOptions>;
  /** Progress callback. */
  onProgress?: (stage: PipelineStage, detail?: string) => void;
}

/**
 * The AI caller function signature.
 * The pipeline doesn't call AI directly — the consumer provides this.
 */
export type AiCallerFn = (systemPrompt: string, userPrompt: string) => Promise<string>;

// ─── Public API ───────────────────────────────────────────────

/**
 * Run the full generation pipeline.
 *
 * @param input   Prompt compiler input (brand, platform, content, etc.)
 * @param aiCall  Function that calls the AI and returns raw text
 * @param options Pipeline options
 */
export async function runGenerationPipeline(
  input: PromptCompilerInput,
  aiCall: AiCallerFn,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const {
    autoRefine = true,
    autoRepair = true,
    minimumScore = 35,
    maxRetries = 0,
    platformSlug,
    evaluationOptions = {},
    onProgress,
  } = options;

  const stages: Record<string, number> = {};
  const totalStart = performance.now();

  let attempt = 0;
  let lastResult: PipelineResult | null = null;

  while (attempt <= maxRetries) {
    attempt++;
    const result = await singlePipelineRun(
      input, aiCall, { autoRefine, autoRepair, minimumScore, platformSlug, evaluationOptions, onProgress, stages }
    );

    if (result.accepted || attempt > maxRetries) {
      result.durationMs = Math.round(performance.now() - totalStart);
      return result;
    }

    lastResult = result;
    onProgress?.('calling_ai', `Retry ${attempt}/${maxRetries}`);
  }

  // All retries exhausted
  return lastResult!;
}

// ─── Single Run ──────────────────────────────────────────────

async function singlePipelineRun(
  input: PromptCompilerInput,
  aiCall: AiCallerFn,
  ctx: {
    autoRefine: boolean;
    autoRepair: boolean;
    minimumScore: number;
    platformSlug?: string;
    evaluationOptions: Partial<EvaluationOptions>;
    onProgress?: (stage: PipelineStage, detail?: string) => void;
    stages: Record<string, number>;
  }
): Promise<PipelineResult> {
  const { onProgress, stages } = ctx;

  // 1. Compile prompt
  onProgress?.('compiling_prompt');
  let t = performance.now();
  const prompt = compileScenePrompt(input);
  stages.compile = Math.round(performance.now() - t);

  // 2. Call AI
  onProgress?.('calling_ai');
  t = performance.now();
  let rawResponse: string;
  try {
    rawResponse = await aiCall(prompt.systemPrompt, prompt.userPrompt);
  } catch (err) {
    return errorResult(prompt, err);
  }
  stages.ai_call = Math.round(performance.now() - t);

  // 3. Parse
  onProgress?.('parsing');
  t = performance.now();
  const parsed: AISceneResult = parseAISceneResponse(rawResponse);
  stages.parse = Math.round(performance.now() - t);

  if (parsed.type === 'empty' || !parsed.sceneJson) {
    return {
      scene: null,
      prompt,
      strategy: prompt.strategy,
      evaluation: null,
      repair: null,
      refinement: null,
      accepted: false,
      rejectionReason: 'AI returned empty or unparseable response',
      durationMs: 0,
      stages,
    };
  }

  // 4–8. Validation Gateway (validate → normalize → repair → refine → score → accept/reject)
  onProgress?.('validating');
  t = performance.now();
  const gateway = validateScene(parsed.sceneJson, {
    autoRepair: ctx.autoRepair,
    autoRefine: ctx.autoRefine,
    minimumScore: ctx.minimumScore,
    platformSlug: ctx.platformSlug,
    evaluationOptions: ctx.evaluationOptions,
  });
  stages.validate = Math.round(performance.now() - t);

  const scene = gateway.scene;
  const repair = gateway.detail.repair;
  const refinement = gateway.detail.refinement;
  const evaluation = gateway.detail.evaluation;
  const accepted = gateway.accepted;

  onProgress?.(accepted ? 'complete' : 'rejected');

  return {
    scene,
    prompt,
    strategy: prompt.strategy,
    evaluation,
    repair,
    refinement,
    accepted,
    rejectionReason: accepted ? null : (gateway.rejectedReason || `Quality score ${gateway.score} below minimum ${ctx.minimumScore}`),
    durationMs: 0,
    stages,
  };
}

function errorResult(prompt: CompiledPrompt, err: unknown): PipelineResult {
  return {
    scene: null,
    prompt,
    strategy: prompt.strategy,
    evaluation: null,
    repair: null,
    refinement: null,
    accepted: false,
    rejectionReason: `AI call failed: ${err instanceof Error ? err.message : String(err)}`,
    durationMs: 0,
    stages: {},
  };
}
