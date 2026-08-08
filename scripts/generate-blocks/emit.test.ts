/**
 * Unit tests for the pure emitter — determinism and
 * exactOptionalPropertyTypes-safety (no `undefined` tokens in output).
 */

import { describe, expect, it } from 'vitest';
import type { BlockDefinition } from '../../src/data/schema';
import { emitModule } from './emit';

const THRUSTER: BlockDefinition = {
  id: 'gen:SmallBlockSmallAtmosphericThrust',
  subtypeId: 'SmallBlockSmallAtmosphericThrust',
  displayName: 'Atmospheric Thruster',
  category: 'thruster',
  thrusterType: 'atmospheric',
  gridSize: 'small',
  dlc: 'base',
  mass: 699,
  maxThrust: 96000,
  maxPowerDraw: 600000,
  minPlanetaryInfluence: 0.3,
  maxPlanetaryInfluence: 1,
  effectivenessAtMinInfluence: 0,
  effectivenessAtMaxInfluence: 1,
  source: 'definition',
};

const ARMOR: BlockDefinition = {
  id: 'gen:SmallHeavyBlockArmorBlock',
  subtypeId: 'SmallHeavyBlockArmorBlock',
  displayName: 'Heavy Armor Block',
  category: 'other',
  gridSize: 'small',
  dlc: 'base',
  mass: 3300,
  source: 'definition',
};

describe('emitModule', () => {
  it('produces a DO-NOT-EDIT banner, the import, and the export', () => {
    const out = emitModule([THRUSTER], 'v1.210.012 b0');
    expect(out).toContain('GENERATED FILE — DO NOT EDIT BY HAND');
    expect(out).toContain("import type { BlockDefinition } from './schema';");
    expect(out).toContain('export const GENERATED_BLOCKS: readonly BlockDefinition[] = [');
    expect(out).toContain('v1.210.012 b0');
  });

  it('never emits a literal `undefined` (exactOptionalPropertyTypes-safe)', () => {
    // ARMOR has none of the thruster optionals; they must be omitted, not
    // serialized as `key: undefined`.
    const out = emitModule([ARMOR, THRUSTER], 'build');
    expect(out).not.toMatch(/\bundefined\b/);
  });

  it('is deterministic and sorted by subtypeId', () => {
    const a = emitModule([THRUSTER, ARMOR], 'build');
    const b = emitModule([ARMOR, THRUSTER], 'build');
    expect(a).toBe(b);
    // ARMOR (S...Heavy) sorts before THRUSTER (S...Small...Atmo)? Compare keys.
    const idxArmor = a.indexOf('SmallHeavyBlockArmorBlock');
    const idxThrust = a.indexOf('SmallBlockSmallAtmosphericThrust');
    expect(idxArmor).toBeGreaterThan(-1);
    expect(idxThrust).toBeGreaterThan(-1);
    // "SmallB" < "SmallH", so the thruster entry comes first.
    expect(idxThrust).toBeLessThan(idxArmor);
  });

  it('omits absent optional keys but keeps present ones', () => {
    const out = emitModule([ARMOR], 'build');
    expect(out).not.toContain('maxThrust');
    expect(out).not.toContain('thrusterType');
    expect(out).toContain('"category":"other"');
    expect(out).toContain('"mass":3300');
  });
});
