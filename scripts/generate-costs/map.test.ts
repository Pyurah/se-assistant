/**
 * Unit tests for the pure component-mapping logic. Driven by in-memory count
 * maps plus the real reverse map built from `COMPONENT_RECIPES`, so they verify
 * the actual modelled vocabulary — no game install needed.
 */

import { describe, expect, it } from 'vitest';
import { buildReverseMap, mapComponentCounts } from './map';

const reverse = buildReverseMap();

describe('buildReverseMap', () => {
  it('inverts every modelled component (game SubtypeId -> ComponentId)', () => {
    expect(reverse.get('SteelPlate')).toBe('steel-plate');
    expect(reverse.get('Motor')).toBe('motor');
    // The girder fix: the game SubtypeId is `Girder`, not `GirderComponent`.
    expect(reverse.get('Girder')).toBe('girder');
    expect(reverse.get('GirderComponent')).toBeUndefined();
  });

  it('includes the newly-added Prototech + novelty components', () => {
    expect(reverse.get('PrototechPanel')).toBe('prototech-panel');
    expect(reverse.get('PrototechCapacitor')).toBe('prototech-capacitor');
    expect(reverse.get('PrototechFrame')).toBe('prototech-frame');
    expect(reverse.get('ZoneChip')).toBe('zone-chip');
    expect(reverse.get('EngineerPlushie')).toBe('engineer-plushie');
  });
});

describe('mapComponentCounts', () => {
  it('maps a fully-known block to a component cost', () => {
    const counts = new Map([
      ['SteelPlate', 150],
      ['MetalGrid', 50],
    ]);
    const result = mapComponentCounts(counts, reverse);
    expect(result).toEqual({ ok: true, cost: { 'steel-plate': 150, 'metal-grid': 50 } });
  });

  it('maps a Prototech block (mixes standard + Prototech components)', () => {
    const counts = new Map([
      ['SteelPlate', 30],
      ['PrototechPanel', 12],
      ['PrototechPropulsionUnit', 4],
    ]);
    const result = mapComponentCounts(counts, reverse);
    expect(result).toEqual({
      ok: true,
      cost: { 'steel-plate': 30, 'prototech-panel': 12, 'prototech-propulsion-unit': 4 },
    });
  });

  it('rejects a block with ANY unmapped component (honesty rule)', () => {
    const counts = new Map([
      ['SteelPlate', 10],
      ['SomeModdedComponent', 3],
    ]);
    const result = mapComponentCounts(counts, reverse);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.unmapped).toEqual(['SomeModdedComponent']);
  });

  it('rejects a block with no components (nothing to cost — never a {} entry)', () => {
    const result = mapComponentCounts(new Map(), reverse);
    expect(result).toEqual({ ok: false, unmapped: [] });
  });
});
