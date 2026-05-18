/**
 * sceneAnalytics.ts
 *
 * Tracks mutation frequency, accepted generations, rejected layouts,
 * readability scores, preferred compositions, and export behavior.
 * Becomes future training intelligence.
 */

// ─── Types ────────────────────────────────────────────────────

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export type AnalyticsEventType =
  | 'generation_accepted'
  | 'generation_rejected'
  | 'mutation_applied'
  | 'edit_instruction'
  | 'export_completed'
  | 'refinement_applied'
  | 'repair_applied'
  | 'reflow_applied'
  | 'undo'
  | 'redo'
  | 'session_started'
  | 'session_ended';

export interface AnalyticsSnapshot {
  totalEvents: number;
  generationsAccepted: number;
  generationsRejected: number;
  mutationsApplied: number;
  exportsCompleted: number;
  averageQualityScore: number;
  topMutations: Array<{ label: string; count: number }>;
  topPlatforms: Array<{ label: string; count: number }>;
  topFormats: Array<{ label: string; count: number }>;
  sessionCount: number;
  editInstructions: number;
}

// ─── Analytics Manager ───────────────────────────────────────

export class SceneAnalyticsManager {
  private events: AnalyticsEvent[] = [];

  // ── Recording ──

  track(type: AnalyticsEventType, data: Record<string, unknown> = {}): void {
    this.events.push({
      type,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  trackGeneration(accepted: boolean, score: number, platform?: string): void {
    this.track(accepted ? 'generation_accepted' : 'generation_rejected', {
      score,
      platform: platform || 'unknown',
    });
  }

  trackMutation(mutationId: string, changedNodes: number): void {
    this.track('mutation_applied', { mutationId, changedNodes });
  }

  trackExport(format: string, platform?: string, durationMs?: number): void {
    this.track('export_completed', { format, platform, durationMs });
  }

  trackEdit(instruction: string, intentType: string, confidence: number): void {
    this.track('edit_instruction', { instruction, intentType, confidence });
  }

  // ── Queries ──

  getSnapshot(): AnalyticsSnapshot {
    const gen = this.events.filter((e) => e.type === 'generation_accepted' || e.type === 'generation_rejected');
    const accepted = gen.filter((e) => e.type === 'generation_accepted');
    const rejected = gen.filter((e) => e.type === 'generation_rejected');

    const scores = gen.map((e) => (e.data.score as number) || 0).filter((s) => s > 0);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    const mutations = this.events.filter((e) => e.type === 'mutation_applied');
    const mutationCounts = countBy(mutations, (e) => e.data.mutationId as string);

    const exports = this.events.filter((e) => e.type === 'export_completed');
    const formatCounts = countBy(exports, (e) => e.data.format as string);
    const platformCounts = countBy(
      [...gen, ...exports].filter((e) => e.data.platform),
      (e) => e.data.platform as string
    );

    const sessions = this.events.filter((e) => e.type === 'session_started').length;
    const edits = this.events.filter((e) => e.type === 'edit_instruction').length;

    return {
      totalEvents: this.events.length,
      generationsAccepted: accepted.length,
      generationsRejected: rejected.length,
      mutationsApplied: mutations.length,
      exportsCompleted: exports.length,
      averageQualityScore: avgScore,
      topMutations: mapToSorted(mutationCounts),
      topPlatforms: mapToSorted(platformCounts),
      topFormats: mapToSorted(formatCounts),
      sessionCount: sessions,
      editInstructions: edits,
    };
  }

  /** Get acceptance rate as fraction 0–1. */
  getAcceptanceRate(): number {
    const gen = this.events.filter((e) => e.type === 'generation_accepted' || e.type === 'generation_rejected');
    if (gen.length === 0) return 0;
    return gen.filter((e) => e.type === 'generation_accepted').length / gen.length;
  }

  /** Get all events of a type. */
  getEvents(type?: AnalyticsEventType): AnalyticsEvent[] {
    return type ? this.events.filter((e) => e.type === type) : [...this.events];
  }

  /** Export all events for persistence. */
  export(): AnalyticsEvent[] {
    return [...this.events];
  }

  /** Import previously persisted events. */
  import(events: AnalyticsEvent[]): void {
    this.events.push(...events);
  }

  /** Clear all events. */
  clear(): void {
    this.events = [];
  }

  get size(): number {
    return this.events.length;
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function countBy<T>(items: T[], keyFn: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    if (key) map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function mapToSorted(map: Map<string, number>): Array<{ label: string; count: number }> {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}
