/**
 * campaignSceneSystem.ts
 *
 * Multi-asset campaign system.
 * Generates coherent scene families across platforms
 * with shared tokens, visual continuity, and campaign-level memory.
 */

import type { SceneDocument } from '@/types/scene';
import { reflowToPreset, REFLOW_PRESETS } from './reflowScene';
import { applyTokens, type DesignTokens, createDefaultTokens, mergeTokens } from './sceneTokens';
import { stableSceneHash } from './stableSceneHash';
import { BrandMemoryManager, type SceneFingerprint } from './sceneBrandMemory';

// ─── Types ────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  /** Shared design tokens for visual continuity. */
  tokens: DesignTokens;
  /** Platform assets in this campaign. */
  assets: CampaignAsset[];
  /** Campaign-level brand memory. */
  memory: BrandMemoryManager;
  /** Creation timestamp. */
  createdAt: string;
  /** Last update timestamp. */
  updatedAt: string;
}

export interface CampaignAsset {
  id: string;
  platformSlug: string;
  platformName: string;
  scene: SceneDocument;
  hash: string;
  fingerprint: SceneFingerprint;
  status: 'draft' | 'approved' | 'exported';
  createdAt: string;
}

export interface CampaignGenerationRequest {
  /** Hero scene to adapt across platforms. */
  heroScene: SceneDocument;
  /** Target platform slugs. */
  platforms: string[];
  /** Shared tokens. */
  tokens?: Partial<DesignTokens>;
  /** Campaign name. */
  name?: string;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Create a campaign from a hero scene + platform list.
 * Generates platform-adapted variants with shared tokens.
 */
export function createCampaign(request: CampaignGenerationRequest): Campaign {
  const now = new Date().toISOString();
  const campaignId = `camp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const tokens = mergeTokens(createDefaultTokens(), request.tokens || {});
  const memory = new BrandMemoryManager();

  // Generate per-platform assets
  const assets: CampaignAsset[] = request.platforms.map((slug) => {
    const preset = REFLOW_PRESETS[slug];
    let scene: SceneDocument;

    if (preset) {
      const reflow = reflowToPreset(request.heroScene, slug);
      scene = reflow.scene;
    } else {
      scene = { ...request.heroScene };
    }

    // Apply shared tokens
    scene = applyTokens(scene, tokens);

    const fp = memory.record(scene, slug);

    return {
      id: `asset_${slug}_${Math.random().toString(36).slice(2, 6)}`,
      platformSlug: slug,
      platformName: slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      scene,
      hash: stableSceneHash(scene),
      fingerprint: fp,
      status: 'draft' as const,
      createdAt: now,
    };
  });

  return {
    id: campaignId,
    name: request.name || 'Untitled Campaign',
    tokens,
    assets,
    memory,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Add a new platform asset to an existing campaign.
 */
export function addCampaignAsset(
  campaign: Campaign,
  platformSlug: string,
  scene: SceneDocument
): Campaign {
  const tokenized = applyTokens(scene, campaign.tokens);
  const fp = campaign.memory.record(tokenized, platformSlug);

  const asset: CampaignAsset = {
    id: `asset_${platformSlug}_${Math.random().toString(36).slice(2, 6)}`,
    platformSlug,
    platformName: platformSlug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    scene: tokenized,
    hash: stableSceneHash(tokenized),
    fingerprint: fp,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };

  return {
    ...campaign,
    assets: [...campaign.assets, asset],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update shared tokens and propagate to all assets.
 */
export function updateCampaignTokens(
  campaign: Campaign,
  tokenOverrides: Partial<DesignTokens>
): Campaign {
  const tokens = mergeTokens(campaign.tokens, tokenOverrides);

  const assets = campaign.assets.map((asset) => {
    const scene = applyTokens(asset.scene, tokens);
    return {
      ...asset,
      scene,
      hash: stableSceneHash(scene),
    };
  });

  return {
    ...campaign,
    tokens,
    assets,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Mark an asset as approved.
 */
export function approveAsset(campaign: Campaign, assetId: string): Campaign {
  return {
    ...campaign,
    assets: campaign.assets.map((a) =>
      a.id === assetId ? { ...a, status: 'approved' as const } : a
    ),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get campaign summary stats.
 */
export function getCampaignStats(campaign: Campaign): {
  totalAssets: number;
  drafted: number;
  approved: number;
  exported: number;
  platforms: string[];
} {
  return {
    totalAssets: campaign.assets.length,
    drafted: campaign.assets.filter((a) => a.status === 'draft').length,
    approved: campaign.assets.filter((a) => a.status === 'approved').length,
    exported: campaign.assets.filter((a) => a.status === 'exported').length,
    platforms: campaign.assets.map((a) => a.platformSlug),
  };
}
