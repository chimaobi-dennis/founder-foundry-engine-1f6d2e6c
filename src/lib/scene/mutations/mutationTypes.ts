/**
 * mutationTypes.ts
 *
 * Type definitions for the scene mutation engine.
 * All mutations are immutable transformations — they produce new scenes.
 */

import type { SceneDocument, SceneNode } from '@/types/scene';

// ─── Mutation Identifiers ─────────────────────────────────────

export type MutationId =
  | 'replace_headline'
  | 'rewrite_cta'
  | 'swap_typography'
  | 'change_color_direction'
  | 'rebalance_layout'
  | 'increase_density'
  | 'simplify_composition'
  | 'modernize_layout'
  | 'convert_editorial_style'
  | 'alternative_hierarchy'
  | 'platform_adaptation'
  | 'resize_reflow'
  | 'swap_image'
  | 'adjust_spacing'
  | 'boost_contrast'
  | 'custom';

// ─── Mutation Params ──────────────────────────────────────────

export interface MutationParams {
  /** Target node IDs (empty = scene-level mutation). */
  targetNodeIds?: string[];
  /** New text for headline/CTA mutations. */
  text?: string;
  /** Font family override. */
  fontFamily?: string;
  /** Color overrides. */
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  /** Platform slug for adaptation. */
  platformSlug?: string;
  /** Target dimensions for resize. */
  targetWidth?: number;
  targetHeight?: number;
  /** Density direction. */
  densityDirection?: 'increase' | 'decrease';
  /** Style target. */
  styleTarget?: 'editorial' | 'minimal' | 'bold' | 'cinematic' | 'modular';
  /** Image URL for swap. */
  imageSrc?: string;
  /** Spacing multiplier (1 = current, 1.5 = 50% more space). */
  spacingMultiplier?: number;
  /** Arbitrary extra params for custom mutations. */
  extra?: Record<string, unknown>;
}

// ─── Mutation Definition ──────────────────────────────────────

export interface MutationDef {
  id: MutationId;
  name: string;
  description: string;
  /** Which node types this mutation applies to (empty = any). */
  applicableNodeTypes: SceneNode['type'][];
  /** Whether this is a scene-level or node-level mutation. */
  scope: 'scene' | 'node' | 'both';
  /** The transform function. */
  apply: (scene: SceneDocument, params: MutationParams) => SceneDocument;
}

// ─── Mutation Result ──────────────────────────────────────────

export interface MutationResult {
  /** The mutated scene. */
  scene: SceneDocument;
  /** Which mutation was applied. */
  mutationId: MutationId;
  /** Params used. */
  params: MutationParams;
  /** Nodes that were changed (IDs). */
  changedNodeIds: string[];
  /** Human-readable summary. */
  summary: string;
  /** Timestamp. */
  timestamp: number;
}

// ─── Mutation Chain ───────────────────────────────────────────

export interface MutationChain {
  /** Ordered list of mutations applied. */
  steps: MutationResult[];
  /** The original scene before any mutations. */
  originalScene: SceneDocument;
  /** The final scene after all mutations. */
  finalScene: SceneDocument;
}
