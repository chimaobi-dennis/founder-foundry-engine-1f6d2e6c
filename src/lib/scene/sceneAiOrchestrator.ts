/**
 * sceneAiOrchestrator.ts
 *
 * The AI command router.
 * Receives user editing intent (natural language or structured),
 * classifies the edit type, and dispatches to the correct engine.
 */

import type { SceneDocument } from '@/types/scene';
import { parseCreativeInstruction, type EditIntent } from './parseCreativeInstruction';
import { applyMutation, applyMutationChain } from './mutations/mutateScene';
import type { MutationId, MutationParams, MutationResult } from './mutations/mutationTypes';
import { applyPatches, patchUpdate, type PatchOp, type PatchResult } from './scenePatchEngine';
import { refineComposition, type RefinementResult } from './refineComposition';
import { repairScene, type RepairResult } from './repairScene';
import { reflowScene, reflowToPreset, type ReflowResult } from './reflowScene';

// ─── Types ────────────────────────────────────────────────────

export type OrchestratorAction =
  | { kind: 'mutation'; result: MutationResult }
  | { kind: 'patch'; result: PatchResult }
  | { kind: 'refine'; result: RefinementResult }
  | { kind: 'repair'; result: RepairResult }
  | { kind: 'reflow'; result: ReflowResult }
  | { kind: 'noop'; reason: string };

export interface OrchestratorResult {
  /** The resulting scene (or original if noop). */
  scene: SceneDocument;
  /** What action was taken. */
  action: OrchestratorAction;
  /** The parsed intent. */
  intent: EditIntent;
  /** Duration in ms. */
  durationMs: number;
}

export interface OrchestratorContext {
  /** IDs of currently selected nodes (for targeted edits). */
  selectedNodeIds?: string[];
  /** Platform slug (for reflow/safe zone awareness). */
  platformSlug?: string;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Process a natural language editing instruction.
 */
export function orchestrateEdit(
  scene: SceneDocument,
  instruction: string,
  context: OrchestratorContext = {}
): OrchestratorResult {
  const start = performance.now();
  const intent = parseCreativeInstruction(instruction);
  const action = routeIntent(scene, intent, context);
  const durationMs = Math.round(performance.now() - start);

  return {
    scene: extractScene(action, scene),
    action,
    intent,
    durationMs,
  };
}

/**
 * Process a pre-parsed structured intent.
 */
export function orchestrateIntent(
  scene: SceneDocument,
  intent: EditIntent,
  context: OrchestratorContext = {}
): OrchestratorResult {
  const start = performance.now();
  const action = routeIntent(scene, intent, context);
  const durationMs = Math.round(performance.now() - start);

  return {
    scene: extractScene(action, scene),
    action,
    intent,
    durationMs,
  };
}

// ─── Routing ──────────────────────────────────────────────────

function routeIntent(
  scene: SceneDocument,
  intent: EditIntent,
  ctx: OrchestratorContext
): OrchestratorAction {
  switch (intent.type) {
    // ── Direct mutations ──
    case 'headline_edit':
      if (intent.text) {
        return mut(scene, 'replace_headline', { text: intent.text });
      }
      if (intent.style) {
        return mutChain(scene, [
          { id: 'replace_headline', params: { text: intent.text || '' } },
          { id: 'boost_contrast', params: {} },
        ]);
      }
      return noop('Headline edit requires text or style');

    case 'cta_edit':
      if (intent.text) {
        return mut(scene, 'rewrite_cta', { text: intent.text });
      }
      return mut(scene, 'rewrite_cta', { text: '' });

    case 'typography_change':
      if (intent.fontFamily) {
        return mut(scene, 'swap_typography', { fontFamily: intent.fontFamily });
      }
      return noop('Typography change requires a font name');

    case 'color_change':
      if (intent.color) {
        return mut(scene, 'change_color_direction', { primaryColor: intent.color });
      }
      return noop('Color change requires a color value');

    case 'spacing_change':
      return mut(scene, 'adjust_spacing', {
        spacingMultiplier: intent.direction === 'increase' ? 1.15 : intent.direction === 'decrease' ? 0.85 : 1.05,
      });

    case 'density_change':
      if (intent.direction === 'decrease') {
        return mut(scene, 'simplify_composition', {});
      }
      return mut(scene, 'increase_density', {});

    case 'simplify':
      return mut(scene, 'simplify_composition', {});

    case 'modernize':
      return mutChain(scene, [
        { id: 'swap_typography', params: { fontFamily: 'Space Grotesk' } },
        { id: 'adjust_spacing', params: { spacingMultiplier: 1.1 } },
        { id: 'boost_contrast', params: {} },
      ]);

    case 'hierarchy_change':
      return mut(scene, 'boost_contrast', {});

    // ── Tone / style (mutation chains) ──
    case 'tone_shift':
    case 'style_conversion':
      return handleStyleShift(scene, intent);

    // ── Patch-based (node-level) ──
    case 'regenerate_section':
      return handleSectionRegenerate(scene, intent, ctx);

    // ── Engine dispatches ──
    case 'refine': {
      const r = refineComposition(scene, { platformSlug: ctx.platformSlug });
      return { kind: 'refine', result: r };
    }

    case 'repair': {
      const r = repairScene(scene, { platformSlug: ctx.platformSlug });
      return { kind: 'repair', result: r };
    }

    case 'platform_adapt': {
      if (intent.platform) {
        const r = reflowToPreset(scene, intent.platform);
        return { kind: 'reflow', result: r };
      }
      return noop('Platform adapt requires a platform');
    }

    case 'regenerate_full':
      return noop('Full regeneration requires the generation pipeline (external AI call)');

    case 'unknown':
      // Try refine as safe fallback
      if (intent.confidence < 0.4) {
        const r = refineComposition(scene, { platformSlug: ctx.platformSlug });
        return { kind: 'refine', result: r };
      }
      return noop(`Could not parse instruction: "${intent.raw}"`);

    default:
      return noop(`Unhandled intent type: ${intent.type}`);
  }
}

// ─── Style Handlers ──────────────────────────────────────────

function handleStyleShift(scene: SceneDocument, intent: EditIntent): OrchestratorAction {
  const style = intent.style || '';
  const steps: Array<{ id: MutationId; params: MutationParams }> = [];

  switch (style) {
    case 'aggressive':
    case 'bold':
    case 'urgent':
      steps.push({ id: 'boost_contrast', params: {} });
      steps.push({ id: 'increase_density', params: {} });
      break;
    case 'minimal':
    case 'clean':
    case 'restrained':
      steps.push({ id: 'simplify_composition', params: {} });
      steps.push({ id: 'adjust_spacing', params: { spacingMultiplier: 1.2 } });
      break;
    case 'premium':
    case 'luxury':
    case 'elegant':
      steps.push({ id: 'adjust_spacing', params: { spacingMultiplier: 1.15 } });
      steps.push({ id: 'swap_typography', params: { fontFamily: 'Playfair Display' } });
      break;
    case 'modern':
    case 'contemporary':
      steps.push({ id: 'swap_typography', params: { fontFamily: 'Space Grotesk' } });
      steps.push({ id: 'boost_contrast', params: {} });
      break;
    case 'editorial':
      steps.push({ id: 'adjust_spacing', params: { spacingMultiplier: 1.1 } });
      steps.push({ id: 'swap_typography', params: { fontFamily: 'DM Sans' } });
      break;
    default:
      steps.push({ id: 'boost_contrast', params: {} });
  }

  if (steps.length === 0) return noop(`No mutations for style: ${style}`);

  const chain = applyMutationChain(scene, steps);
  return { kind: 'mutation', result: chain.steps[chain.steps.length - 1] };
}

function handleSectionRegenerate(
  scene: SceneDocument,
  intent: EditIntent,
  ctx: OrchestratorContext
): OrchestratorAction {
  // Use patches to clear and signal for regeneration
  const patches: PatchOp[] = [];

  if (intent.target === 'hero' && ctx.selectedNodeIds?.length) {
    for (const id of ctx.selectedNodeIds) {
      patches.push(patchUpdate(id, { opacity: 0.3 }));
    }
  }

  if (patches.length > 0) {
    const result = applyPatches(scene, patches);
    return { kind: 'patch', result };
  }

  return noop('Section regeneration requires selected nodes or external AI');
}

// ─── Helpers ──────────────────────────────────────────────────

function mut(scene: SceneDocument, id: MutationId, params: MutationParams): OrchestratorAction {
  const result = applyMutation(scene, id, params);
  return { kind: 'mutation', result };
}

function mutChain(
  scene: SceneDocument,
  steps: Array<{ id: MutationId; params: MutationParams }>
): OrchestratorAction {
  const chain = applyMutationChain(scene, steps);
  const last = chain.steps[chain.steps.length - 1];
  return { kind: 'mutation', result: { ...last, scene: chain.finalScene } };
}

function noop(reason: string): OrchestratorAction {
  return { kind: 'noop', reason };
}

function extractScene(action: OrchestratorAction, fallback: SceneDocument): SceneDocument {
  switch (action.kind) {
    case 'mutation': return action.result.scene;
    case 'patch': return action.result.scene;
    case 'refine': return action.result.scene;
    case 'repair': return action.result.scene;
    case 'reflow': return action.result.scene;
    case 'noop': return fallback;
  }
}
