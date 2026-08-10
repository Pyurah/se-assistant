import { describe, it, expect } from 'vitest';
import { ALL_BLOCK_COSTS } from './all-block-costs';
import {
  BLOCK_COMPONENT_COSTS,
  COMPONENT_RECIPES,
  type ComponentId,
} from './manufacturing';
import { GENERATED_BLOCK_COSTS } from './generated-block-costs';

const VALID_COMPONENT_IDS = new Set(Object.keys(COMPONENT_RECIPES) as ComponentId[]);

describe('ALL_BLOCK_COSTS (curated ⊕ generated merge)', () => {
  it('is a superset of both sources — every subtypeId is present', () => {
    for (const subtypeId of Object.keys(GENERATED_BLOCK_COSTS)) {
      expect(ALL_BLOCK_COSTS).toHaveProperty(subtypeId);
    }
    for (const subtypeId of Object.keys(BLOCK_COMPONENT_COSTS)) {
      expect(ALL_BLOCK_COSTS).toHaveProperty(subtypeId);
    }
  });

  it('every recipe uses only valid ComponentIds with positive counts', () => {
    for (const [subtypeId, recipe] of Object.entries(ALL_BLOCK_COSTS)) {
      for (const [comp, count] of Object.entries(recipe)) {
        expect(VALID_COMPONENT_IDS, `${subtypeId} → ${comp}`).toContain(comp);
        expect(count, `${subtypeId} → ${comp}`).toBeGreaterThan(0);
      }
    }
  });

  it('generated wins on conflict — LargeRefinery uses the current-version recipe', () => {
    // The curated LargeRefinery lacked `metal-grid`; the generated one (from
    // v1.210.012 CubeBlocks.sbc) includes `metal-grid: 20`. The merged value must
    // be the generated (authoritative) recipe, not the stale curated one.
    expect(BLOCK_COMPONENT_COSTS.LargeRefinery).not.toHaveProperty('metal-grid');
    expect(GENERATED_BLOCK_COSTS.LargeRefinery).toHaveProperty('metal-grid');
    expect(ALL_BLOCK_COSTS.LargeRefinery).toEqual(GENERATED_BLOCK_COSTS.LargeRefinery);
    expect(ALL_BLOCK_COSTS.LargeRefinery).toHaveProperty('metal-grid');
  });

  it('every generated recipe survives the merge byte-for-byte', () => {
    for (const [subtypeId, recipe] of Object.entries(GENERATED_BLOCK_COSTS)) {
      expect(ALL_BLOCK_COSTS[subtypeId], subtypeId).toEqual(recipe);
    }
  });

  it('curated rows survive only as fallback where the generator has no twin', () => {
    // The hydrogen engines use a different SubtypeId in the archived curated data
    // (LargeBlockHydrogenEngine) than in the current CubeBlocks.sbc
    // (LargeHydrogenEngine), so the generator emits no LargeBlockHydrogenEngine —
    // the curated fallback is what covers that key.
    expect(GENERATED_BLOCK_COSTS).not.toHaveProperty('LargeBlockHydrogenEngine');
    expect(ALL_BLOCK_COSTS.LargeBlockHydrogenEngine).toEqual(
      BLOCK_COMPONENT_COSTS.LargeBlockHydrogenEngine,
    );
  });

  it('gap-fills blocks the curated set never covered (Jasen’s Miner blocks)', () => {
    // These were the "cost unknown" chips before the generator: conveyors and a
    // small beacon. They must now resolve to a generated recipe.
    for (const subtypeId of ['ConveyorTube', 'ConveyorTubeCurved', 'SmallBlockBeacon']) {
      expect(BLOCK_COMPONENT_COSTS).not.toHaveProperty(subtypeId);
      expect(ALL_BLOCK_COSTS[subtypeId], subtypeId).toEqual(GENERATED_BLOCK_COSTS[subtypeId]);
    }
  });

  it('generated-only entries pass through untouched', () => {
    // A block present only in the generated set is copied verbatim.
    expect(ALL_BLOCK_COSTS.LargeBlockPrototechBattery).toEqual(
      GENERATED_BLOCK_COSTS.LargeBlockPrototechBattery,
    );
  });
});
