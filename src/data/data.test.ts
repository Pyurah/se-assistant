import { describe, it, expect } from 'vitest';
import {
  VANILLA_BLOCKS,
  VANILLA_BLOCKS_BY_ID,
  VANILLA_BLOCKS_BY_SUBTYPE,
  PLANET_PRESETS,
  PLANET_PRESETS_BY_ID,
  STANDARD_GRAVITY,
} from './index';

/**
 * Data-integrity guards. These protect the dataset's invariants as it grows
 * to full vanilla coverage in Phase 1 / M1 — catching duplicate ids, negative
 * masses, and malformed thruster envelopes at test time rather than in the UI.
 */

describe('vanilla blocks dataset', () => {
  it('has unique block ids', () => {
    const ids = VANILLA_BLOCKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique subtype ids', () => {
    const subtypes = VANILLA_BLOCKS.map((b) => b.subtypeId);
    expect(new Set(subtypes).size).toBe(subtypes.length);
  });

  it('exposes consistent id and subtype lookup maps', () => {
    for (const block of VANILLA_BLOCKS) {
      expect(VANILLA_BLOCKS_BY_ID[block.id]).toBe(block);
      expect(VANILLA_BLOCKS_BY_SUBTYPE[block.subtypeId]).toBe(block);
    }
  });

  it('has positive mass and non-negative power for every block', () => {
    for (const block of VANILLA_BLOCKS) {
      expect(block.mass, `${block.id} mass`).toBeGreaterThan(0);
      if ('maxPowerDraw' in block) {
        expect(block.maxPowerDraw, `${block.id} draw`).toBeGreaterThanOrEqual(0);
      }
      if ('maxPowerOutput' in block) {
        expect(block.maxPowerOutput, `${block.id} output`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('gives thrusters positive thrust and a sane planetary-influence envelope', () => {
    const thrusters = VANILLA_BLOCKS.filter((b) => b.category === 'thruster');
    expect(thrusters.length).toBeGreaterThan(0);
    for (const t of thrusters) {
      if (t.category !== 'thruster') continue;
      expect(t.maxThrust, `${t.id} thrust`).toBeGreaterThan(0);
      if (t.minPlanetaryInfluence !== undefined && t.maxPlanetaryInfluence !== undefined) {
        expect(t.minPlanetaryInfluence).toBeLessThanOrEqual(t.maxPlanetaryInfluence);
      }
    }
  });
});

describe('planet presets', () => {
  it('has unique planet ids', () => {
    const ids = PLANET_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes a zero-g space preset with no atmosphere', () => {
    const space = PLANET_PRESETS_BY_ID['space'];
    expect(space).toBeDefined();
    expect(space!.surfaceGravity).toBe(0);
    expect(space!.hasAtmosphere).toBe(false);
    expect(space!.atmosphereDensity).toBe(0);
  });

  it('keeps atmosphere flags consistent with density', () => {
    for (const p of PLANET_PRESETS) {
      if (!p.hasAtmosphere) {
        expect(p.atmosphereDensity, `${p.id} density`).toBe(0);
      } else {
        expect(p.atmosphereDensity, `${p.id} density`).toBeGreaterThan(0);
      }
      expect(p.surfaceGravity, `${p.id} gravity`).toBeGreaterThanOrEqual(0);
    }
  });

  it('models Earthlike at standard gravity (1.0 g)', () => {
    expect(PLANET_PRESETS_BY_ID['earthlike']!.surfaceGravity).toBeCloseTo(STANDARD_GRAVITY, 2);
  });
});
