import { describe, it, expect } from 'vitest';
import { coerceReadback, readbackToDna, sectionLabels, confidenceFrom } from '@shared/understanding';

const stages = ['spark', 'shape', 'validate', 'brand', 'launch', 'grow'];

describe('coerceReadback', () => {
  it('keeps known sections, labels them for the kind, bounds everything', () => {
    const rb = coerceReadback({
      name: 'Växjö Bageri', kind: 'running', descriptor: 'a neighbourhood bakery', stage_key: 'brand', promise: 'Good bread, close by.',
      sections: [
        { key: 'what', value: 'Sourdough and buns.', source: 'site', confidence: 'high' },
        { key: 'who', value: 'Families and offices.', source: 'Instagram', confidence: 'fairly sure' },
        { key: 'bogus', value: 'x' },
        { key: 'voice', value: 'Not specified', source: 'none' },
        { key: 'stage', value: 'Three years in, one shop.', confidence: 'guess' },
      ],
      not_known: ['Prices', '', 'Delivery', 'a', 'b', 'c', 'd'],
      goals: ['Fill weekdays', 'More regulars', 'Instagram orders', 'too many'],
    }, stages)!;
    expect(rb.kind).toBe('running');
    expect(rb.stage_key).toBe('brand');
    expect(rb.sections.map((s) => s.key)).toEqual(['what', 'who', 'stage']);
    expect(rb.sections[0]).toMatchObject({ label: 'What you sell', confidence: 'sure', source: 'site' });
    expect(rb.sections[1].confidence).toBe('fairly_sure');
    expect(rb.sections[2]).toMatchObject({ source: 'what you said', confidence: 'guess' });
    expect(rb.not_known).toEqual(['Prices', 'Delivery', 'a', 'b', 'c']);
    expect(rb.goals).toEqual(['Fill weekdays', 'More regulars', 'Instagram orders']);
  });
  it('falls back on the first stage and rejects thin read-backs', () => {
    expect(coerceReadback({ kind: 'creator', stage_key: 'nope', sections: [{ key: 'what', value: 'Cooking videos.' }, { key: 'who', value: 'Home cooks.' }] }, stages)!.stage_key).toBe('spark');
    expect(coerceReadback({ sections: [{ key: 'what', value: 'only one' }] }, stages)).toBeNull();
    expect(coerceReadback('no', stages)).toBeNull();
  });
  it('labels differ by kind', () => {
    expect(sectionLabels('creator').who).toBe('Your audience');
    expect(sectionLabels('starting').problem).toBe('The problem worth solving');
    expect(sectionLabels('other').what).toBe('What you sell');
    expect(confidenceFrom('medium')).toBe('fairly_sure');
  });
});

describe('readbackToDna', () => {
  it('maps approved sections onto brand_dna with provenance', () => {
    const rb = coerceReadback({ name: 'Bageri', kind: 'running', descriptor: 'a bakery', promise: 'Warm lunch nearby.', sections: [
      { key: 'what', value: 'Bread.', source: 'site', confidence: 'sure' },
      { key: 'voice', value: 'Warm, plain.', source: 'site', confidence: 'guess' },
      { key: 'stage', value: 'Year three.' },
    ] }, stages)!;
    const { dna, meta } = readbackToDna(rb);
    expect(dna).toMatchObject({ product_positioning: 'Bread.', brand_voice: 'Warm, plain.', core_promise: 'Warm lunch nearby.', positioning_statement: 'Bageri: a bakery' });
    expect(dna).not.toHaveProperty('stage');
    expect(meta.brand_voice).toEqual({ source: 'site', confidence: 'guess' });
  });
});
