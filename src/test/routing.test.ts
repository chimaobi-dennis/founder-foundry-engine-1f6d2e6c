import { describe, it, expect } from 'vitest';
import { capMaxTokens, isRetryable, orderForRequest, stripReasoning, tierClass, type RouteCandidate } from '@shared/routing';
import { blendedPer1M, PROVIDER_PRESETS } from '@/services/modelRoutingService';

const cand = (over: Partial<RouteCandidate>): RouteCandidate => ({
  model_row_id: over.model_id ?? 'x', model_id: 'm', model_name: 'M', max_output: null, strip_reasoning: false, supports_vision: false,
  cost_per_1k_input: null, cost_per_1k_output: null, provider: { id: 'p', slug: 'p', base_url: '', auth_header_name: 'Authorization', auth_header_prefix: 'Bearer', is_enabled: true }, ...over,
});

describe('routing helpers', () => {
  it('maps tiers to classes', () => {
    expect(tierClass('fast')).toBe('fast');
    expect(tierClass('standard')).toBe('writing');
    expect(tierClass('reasoning')).toBe('reasoning');
    expect(tierClass('coding')).toBe('coding');
    expect(tierClass(null)).toBeNull();
  });
  it('retries provider-side failures only', () => {
    expect(isRetryable(429, 'rate limit')).toBe(true);
    expect(isRetryable(503, '')).toBe(true);
    expect(isRetryable(200, 'This model is currently experiencing high demand.')).toBe(true);
    expect(isRetryable(400, 'messages: text content blocks must be non-empty')).toBe(false);
    expect(isRetryable(401, 'invalid api key')).toBe(false);
  });
  it('strips reasoning blocks and keeps the answer', () => {
    expect(stripReasoning('<think>\nlet me see\n</think>\n{"items":[]}')).toBe('{"items":[]}');
    expect(stripReasoning('plain answer')).toBe('plain answer');
    expect(stripReasoning('<think>only thinking, never closed')).toBe('<think>only thinking, never closed');
  });
  it('puts vision models first for image requests and caps the candidate count', () => {
    const list = [cand({ model_id: 'a' }), cand({ model_id: 'b', supports_vision: true }), cand({ model_id: 'c' }), cand({ model_id: 'd' })];
    expect(orderForRequest(list, true).map((c) => c.model_id)).toEqual(['b', 'a', 'c']);
    expect(orderForRequest(list, false).map((c) => c.model_id)).toEqual(['a', 'b', 'c']);
    expect(orderForRequest([cand({ model_id: 'off', provider: { ...cand({}).provider, is_enabled: false } }), cand({ model_id: 'on' })], false).map((c) => c.model_id)).toEqual(['on']);
  });
  it('caps max tokens at what the model can produce', () => {
    expect(capMaxTokens(8000, { max_output: 4096 })).toBe(4096);
    expect(capMaxTokens(8000, { max_output: null })).toBe(8000);
    expect(capMaxTokens(1, { max_output: 4096 })).toBe(16);
  });
  it('blends a per-1M price for the admin table', () => {
    expect(blendedPer1M({ cost_per_1k_input: 0.0001, cost_per_1k_output: 0.0003 })).toBeCloseTo(0.15, 5);
    expect(blendedPer1M({ cost_per_1k_input: null, cost_per_1k_output: null })).toBeNull();
    expect(PROVIDER_PRESETS.map((p) => p.slug)).toContain('openrouter');
  });
});
