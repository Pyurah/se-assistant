/**
 * Unit tests for the pure block-definition parser, driven by small committed
 * fixtures in `__fixtures__/` — so they run in CI without the game installed.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildBlock,
  dlcFromTag,
  isPublic,
  massFromComponents,
  normalizeXsiType,
  parseComponentMasses,
  parseCubeBlocksFile,
  parseDisplayNames,
  type ParseContext,
  type RawDefinition,
} from './parse';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');
const read = (name: string): string => readFileSync(join(fixtures, name), 'utf8');

const componentMasses = parseComponentMasses(read('Components.sbc'));
const displayNames = parseDisplayNames(read('MyTexts.resx'));
const ctx: ParseContext = { componentMasses, displayNames };
const defs = parseCubeBlocksFile(read('CubeBlocks_Sample.sbc'));

const bySubtype = (id: string): RawDefinition => {
  const def = defs.find((d) => d.Id?.SubtypeId === id);
  if (!def) throw new Error(`fixture missing subtype ${id}`);
  return def;
};

describe('parseComponentMasses', () => {
  it('reads component subtype -> unit mass', () => {
    expect(componentMasses.get('SteelPlate')).toBe(20);
    expect(componentMasses.get('Motor')).toBe(24);
    expect(componentMasses.get('Computer')).toBe(0.2);
  });
});

describe('parseDisplayNames', () => {
  it('resolves localization keys to English strings', () => {
    expect(displayNames.get('DisplayName_Block_SmallAtmoThrust')).toBe('Atmospheric Thruster');
    expect(displayNames.get('DisplayName_Block_Battery')).toBe('Battery');
  });

  it('returns undefined for unknown keys', () => {
    expect(displayNames.get('DisplayName_Block_DoesNotExist')).toBeUndefined();
  });
});

describe('normalizeXsiType', () => {
  it('strips the MyObjectBuilder_ prefix', () => {
    expect(normalizeXsiType('MyObjectBuilder_ThrustDefinition')).toBe('ThrustDefinition');
  });
  it('strips a namespace prefix too', () => {
    expect(normalizeXsiType('xsi:MyObjectBuilder_ThrustDefinition')).toBe('ThrustDefinition');
  });
  it('returns undefined for missing type', () => {
    expect(normalizeXsiType(undefined)).toBeUndefined();
  });
});

describe('massFromComponents', () => {
  it('sums components (699 kg anchor for the small atmospheric thruster)', () => {
    expect(massFromComponents(bySubtype('SmallBlockSmallAtmosphericThrust'), componentMasses)).toBe(
      699,
    );
  });

  it('ignores nested non-component SubtypeIds (battery CriticalComponent)', () => {
    // SteelPlate 20*20=400 + PowerCell 25*80=2000 + Computer 0.2*25=5 = 2405.
    expect(massFromComponents(bySubtype('LargeBlockBatteryBlock'), componentMasses)).toBe(2405);
  });
});

describe('isPublic', () => {
  it('treats an absent <Public> tag as buildable', () => {
    expect(isPublic(bySubtype('SmallHeavyBlockArmorBlock'))).toBe(true);
  });
  it('honors <Public>false</Public>', () => {
    expect(isPublic(bySubtype('PrototypeHiddenThruster'))).toBe(false);
  });
});

describe('dlcFromTag', () => {
  it('maps a known DLC tag', () => {
    expect(dlcFromTag(bySubtype('SmallBlockBatteryBlockWarfare2'))).toBe('warfare-2');
  });
  it('defaults to base when no tag', () => {
    expect(dlcFromTag(bySubtype('SmallBlockSmallAtmosphericThrust'))).toBe('base');
  });
  it('throws on an unmapped tag', () => {
    expect(() => dlcFromTag({ DLC: 'TotallyFakeDLC' })).toThrow(/Unmapped/);
  });
});

describe('buildBlock', () => {
  it('builds a full thruster with MW->W power and the atmospheric envelope', () => {
    const { block } = buildBlock(bySubtype('SmallBlockSmallAtmosphericThrust'), ctx);
    expect(block).toMatchObject({
      id: 'gen:SmallBlockSmallAtmosphericThrust',
      subtypeId: 'SmallBlockSmallAtmosphericThrust',
      displayName: 'Atmospheric Thruster',
      category: 'thruster',
      thrusterType: 'atmospheric',
      gridSize: 'small',
      dlc: 'base',
      mass: 699,
      maxThrust: 96000,
      maxPowerDraw: 600000, // 0.6 MW -> 600000 W
      minPlanetaryInfluence: 0.3,
      maxPlanetaryInfluence: 1,
      effectivenessAtMinInfluence: 0,
      effectivenessAtMaxInfluence: 1,
      source: 'definition',
      cellCount: 3,
    });
  });

  it('builds a battery with MW->W and MWh->Wh conversions', () => {
    const { block } = buildBlock(bySubtype('LargeBlockBatteryBlock'), ctx);
    expect(block).toMatchObject({
      category: 'battery',
      maxPowerOutput: 12_000_000,
      maxPowerInput: 12_000_000,
      energyCapacity: 3_000_000, // 3 MWh -> 3,000,000 Wh
      mass: 2405,
      source: 'definition',
    });
  });

  it('tags a DLC block correctly', () => {
    const { block } = buildBlock(bySubtype('SmallBlockBatteryBlockWarfare2'), ctx);
    expect(block?.dlc).toBe('warfare-2');
    expect(block?.category).toBe('battery');
  });

  it('emits an unmapped xsi:type as mass-only "other"', () => {
    const { block } = buildBlock(bySubtype('SmallShipMergeBlock'), ctx);
    expect(block?.category).toBe('other');
    expect(block?.mass).toBeGreaterThan(0);
    expect(block && 'maxThrust' in block).toBe(false);
  });

  it('skips a non-public definition', () => {
    const { block, diagnostics } = buildBlock(bySubtype('PrototypeHiddenThruster'), ctx);
    expect(block).toBeNull();
    expect(diagnostics.some((d) => d.kind === 'skipped-non-public')).toBe(true);
  });

  it('downgrades a stat-bearing type missing a required field to "other"', () => {
    const { block, diagnostics } = buildBlock(bySubtype('BrokenThrusterNoForce'), ctx);
    expect(block?.category).toBe('other'); // NOT a fabricated 0-thrust thruster
    expect(diagnostics.some((d) => d.kind === 'downgraded-stat')).toBe(true);
  });

  it('falls back to the display key when no resx entry exists', () => {
    const { block } = buildBlock(bySubtype('SmallHeavyBlockArmorBlock'), ctx);
    // No resx entry for DisplayName_Block_HeavyArmorBlock -> key text used.
    expect(block?.displayName).toBe('DisplayName_Block_HeavyArmorBlock');
    expect(block?.category).toBe('other');
  });
});
