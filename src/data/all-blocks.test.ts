/**
 * Invariants over the merged block dataset (curated vanilla + generated
 * definitions). These guard the two properties the v0.16.0 generator exists to
 * deliver: curated stats are never clobbered (override), and every buildable
 * game block is now resolvable (gap-fill) — including the ones from the "Heavy
 * Space Fighter" blueprint that motivated the feature.
 *
 * The generated dataset itself is produced by `scripts/generate-blocks` and
 * unit-tested there against fixtures; here we test the MERGE and the shape of
 * what lands in the app.
 */

import { describe, expect, it } from 'vitest';
import { ALL_BLOCKS, BLOCKS_BY_ID, BLOCKS_BY_SUBTYPE } from './all-blocks';
import { GENERATED_BLOCKS } from './generated-blocks';
import { VANILLA_BLOCKS, VANILLA_BLOCKS_BY_SUBTYPE } from './blocks';
import { DLCS_BY_ID } from './dlc';
import type { BatteryBlock, ThrusterBlock } from './schema';

describe('ALL_BLOCKS integrity', () => {
  it('has unique subtypeIds', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const b of ALL_BLOCKS) {
      if (seen.has(b.subtypeId)) dupes.push(b.subtypeId);
      seen.add(b.subtypeId);
    }
    expect(dupes).toEqual([]);
  });

  it('has unique ids', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const b of ALL_BLOCKS) {
      if (seen.has(b.id)) dupes.push(b.id);
      seen.add(b.id);
    }
    expect(dupes).toEqual([]);
  });

  it('every block has a positive mass', () => {
    const bad = ALL_BLOCKS.filter((b) => !(b.mass > 0)).map((b) => b.subtypeId);
    expect(bad).toEqual([]);
  });

  it('every block carries a known DLC', () => {
    const bad = ALL_BLOCKS.filter((b) => !DLCS_BY_ID[b.dlc]).map((b) => b.subtypeId);
    expect(bad).toEqual([]);
  });

  it('every block is vanilla or definition sourced (never blueprint/user in the dataset)', () => {
    const bad = ALL_BLOCKS.filter((b) => b.source !== 'vanilla' && b.source !== 'definition');
    expect(bad).toEqual([]);
  });

  it('contains every curated block plus the generated gap-fill', () => {
    expect(ALL_BLOCKS.length).toBeGreaterThan(GENERATED_BLOCKS.length);
    expect(ALL_BLOCKS.length).toBeGreaterThanOrEqual(VANILLA_BLOCKS.length);
    // Merged size = generated + curated-only (curated that overlaps generated
    // replaces rather than adds).
    const generatedSubtypes = new Set(GENERATED_BLOCKS.map((b) => b.subtypeId));
    const curatedOnly = VANILLA_BLOCKS.filter((b) => !generatedSubtypes.has(b.subtypeId)).length;
    expect(ALL_BLOCKS.length).toBe(GENERATED_BLOCKS.length + curatedOnly);
  });
});

describe('curated override (curated wins on conflict)', () => {
  it('resolves every curated subtype to the CURATED entry, never a generated one', () => {
    for (const curated of VANILLA_BLOCKS) {
      const resolved = BLOCKS_BY_SUBTYPE[curated.subtypeId];
      expect(resolved).toBeDefined();
      expect(resolved?.source).toBe('vanilla');
      // Identity: the merged map returns the exact curated object.
      expect(resolved).toBe(VANILLA_BLOCKS_BY_SUBTYPE[curated.subtypeId]);
    }
  });

  it('preserves hand-verified stats for known conflicting subtypes', () => {
    // These 8 subtypes exist in BOTH the curated and generated sets; the curated
    // values must survive the merge unchanged.
    const overlapping = [
      'LargeBlockBatteryBlock',
      'LargeBlockGyro',
      'SmallBlockSmallAtmosphericThrust',
      'LargeBlockLargeContainer',
      'LargeBlockCockpit',
      'LargeBlockDrill',
      'Connector',
      'LargeBlockBeacon',
    ];
    for (const subtypeId of overlapping) {
      const curated = VANILLA_BLOCKS_BY_SUBTYPE[subtypeId];
      const gen = GENERATED_BLOCKS.find((b) => b.subtypeId === subtypeId);
      const merged = BLOCKS_BY_SUBTYPE[subtypeId];
      expect(curated, `${subtypeId} should be curated`).toBeDefined();
      expect(gen, `${subtypeId} should also be generated (so override matters)`).toBeDefined();
      expect(merged?.source).toBe('vanilla');
      expect(merged?.mass).toBe(curated?.mass);
    }
  });
});

describe('gap-fill (blocks we never curated now resolve)', () => {
  // A representative slice of the "Heavy Space Fighter" blueprint's formerly
  // unrecognized subtypes — armor family, SciFi thruster, merge block,
  // projector, air vent, fighter cockpit. (Weapon subtypes that used to appear
  // here — SmallBlockMediumCalibreGun, SmallGatlingGunWarfare2 — are now curated
  // as `weapon` blocks, so they resolve to `source: 'vanilla'`; see
  // weapon-blocks.test.ts for their coverage.)
  const fighterSubtypes = [
    'SmallHeavyBlockArmorSlope',
    'SmallHeavyBlockArmorCorner',
    'HeavyHalfArmorBlock',
    'SmallBlockLargeThrustSciFi',
    'SmallBlockSmallThrustSciFi',
    'SmallShipMergeBlock',
    'SmallProjector',
    'SmallAirVent',
    'DBSmallBlockFighterCockpit',
  ];

  it('resolves each formerly-unrecognized fighter subtype from the definition set', () => {
    for (const subtypeId of fighterSubtypes) {
      const resolved = BLOCKS_BY_SUBTYPE[subtypeId];
      expect(resolved, `${subtypeId} should resolve`).toBeDefined();
      expect(resolved?.source).toBe('definition');
      expect(resolved?.mass).toBeGreaterThan(0);
    }
  });

  it('generated SciFi thrusters carry a real thrust envelope', () => {
    const sciFi = BLOCKS_BY_SUBTYPE['SmallBlockLargeThrustSciFi'] as ThrusterBlock | undefined;
    expect(sciFi?.category).toBe('thruster');
    expect(sciFi?.maxThrust).toBeGreaterThan(0);
    expect(['atmospheric', 'ion', 'hydrogen']).toContain(sciFi?.thrusterType);
  });
});

describe('generated block shape invariants', () => {
  const generated = ALL_BLOCKS.filter((b) => b.source === 'definition');

  it('every generated id is namespaced gen:<subtypeId>', () => {
    const bad = generated.filter((b) => b.id !== `gen:${b.subtypeId}`).map((b) => b.subtypeId);
    expect(bad).toEqual([]);
  });

  it('thrusters have positive thrust; effectiveness envelope is within [0,1] when present', () => {
    const thrusters = generated.filter(
      (b): b is ThrusterBlock => b.category === 'thruster',
    );
    expect(thrusters.length).toBeGreaterThan(0);
    for (const t of thrusters) {
      expect(t.maxThrust, t.subtypeId).toBeGreaterThan(0);
      expect(t.maxPowerDraw, t.subtypeId).toBeGreaterThanOrEqual(0);
      for (const v of [
        t.effectivenessAtMinInfluence,
        t.effectivenessAtMaxInfluence,
        t.minPlanetaryInfluence,
        t.maxPlanetaryInfluence,
      ]) {
        if (v !== undefined) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('batteries have positive I/O and capacity', () => {
    const batteries = generated.filter((b): b is BatteryBlock => b.category === 'battery');
    expect(batteries.length).toBeGreaterThan(0);
    for (const b of batteries) {
      expect(b.maxPowerOutput, b.subtypeId).toBeGreaterThan(0);
      expect(b.maxPowerInput, b.subtypeId).toBeGreaterThan(0);
      expect(b.energyCapacity, b.subtypeId).toBeGreaterThan(0);
    }
  });

  it('BLOCKS_BY_ID round-trips every merged block', () => {
    for (const b of ALL_BLOCKS) {
      expect(BLOCKS_BY_ID[b.id]).toBe(b);
    }
  });
});
