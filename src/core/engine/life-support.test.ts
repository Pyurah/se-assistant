import { describe, it, expect } from 'vitest';
import { BLOCKS_BY_SUBTYPE } from '../../data/all-blocks';
import type { ShipDesign, DesignBlock } from '../types';
import { lifeSupport, oxygenGeneration, oxygenCapacity } from './life-support';

function block(subtypeId: string, quantity: number): DesignBlock {
  const definition = BLOCKS_BY_SUBTYPE[subtypeId];
  if (!definition) throw new Error(`test setup: unknown subtypeId ${subtypeId}`);
  return { definition, quantity };
}

function ship(blocks: DesignBlock[], gridSize: 'small' | 'large' = 'large'): ShipDesign {
  return {
    id: 'ls',
    name: 'Life Support Rig',
    gridSize,
    blocks,
    planetId: 'earthlike',
    cargo: { fillFraction: 0, densityKgPerL: 2 },
  };
}

describe('oxygen generation & capacity', () => {
  it('sums large O2/H2 generator oxygen output (250 L/s each)', () => {
    expect(oxygenGeneration(ship([block('OxygenGenerator', 2)]))).toBe(500);
  });

  it('sums small O2/H2 generator oxygen output (50 L/s each)', () => {
    expect(oxygenGeneration(ship([block('OxygenGeneratorSmall', 3)], 'small'))).toBe(150);
  });

  it('sums oxygen-tank capacity (50,000 L each) and ignores hydrogen tanks', () => {
    const design = ship([block('OxygenTankSmall', 2), block('SmallHydrogenTank', 1)], 'small');
    expect(oxygenCapacity(design)).toBe(100_000); // 2 × 50,000; H2 tank excluded
  });
});

describe('lifeSupport — crew balance', () => {
  it('a large generator (250 L/s) supports 250 / 0.063 = 3968 crew', () => {
    const ls = lifeSupport(ship([block('OxygenGenerator', 1)]), { crewSize: 4 });
    // 250 / 0.063 = 3968.25… → floor 3968
    expect(ls.maxCrewSupported).toBe(3968);
    expect(ls.generationCoversCrew).toBe(true);
  });

  it('computes O₂ demand as crew × 0.063 L/s', () => {
    const ls = lifeSupport(ship([block('OxygenGenerator', 1)]), { crewSize: 4 });
    expect(ls.oxygenDemand).toBeCloseTo(0.252, 6); // 4 × 0.063
    expect(ls.oxygenBalance).toBeCloseTo(250 - 0.252, 6);
  });

  it('flags a deficit when demand exceeds generation', () => {
    // Small gen = 50 L/s → supports 50/0.063 = 793 crew; ask for 1000.
    const ls = lifeSupport(ship([block('OxygenGeneratorSmall', 1)], 'small'), { crewSize: 1000 });
    expect(ls.generationCoversCrew).toBe(false);
    expect(ls.oxygenBalance).toBeLessThan(0);
  });

  it('defaults to a crew of 1 when unspecified', () => {
    const ls = lifeSupport(ship([block('OxygenGenerator', 1)]));
    expect(ls.crewSize).toBe(1);
    expect(ls.oxygenDemand).toBeCloseTo(0.063, 6);
  });
});

describe('lifeSupport — breathing time on stored O₂', () => {
  it('divides stored O₂ by crew demand (100,000 L ÷ 0.252 L/s ≈ 396,825 s)', () => {
    const design = ship([block('OxygenTankSmall', 2)], 'small');
    const ls = lifeSupport(design, { crewSize: 4 });
    expect(ls.oxygenCapacity).toBe(100_000);
    expect(ls.breathingTimeSeconds).toBeCloseTo(100_000 / 0.252, 0);
  });

  it('is unlimited when there is no crew breathing', () => {
    const ls = lifeSupport(ship([block('OxygenTankSmall', 1)], 'small'), { crewSize: 0 });
    expect(ls.breathingTimeSeconds).toBe(Infinity);
  });

  it('is zero when there is demand but no stored O₂', () => {
    const ls = lifeSupport(ship([block('OxygenGenerator', 1)]), { crewSize: 4 });
    expect(ls.oxygenCapacity).toBe(0);
    expect(ls.breathingTimeSeconds).toBe(0);
  });
});

describe('lifeSupport — ice burn & empty state', () => {
  it('derives ice burn for O₂ as generation ÷ 10 (ice→oxygen ratio)', () => {
    // 2 large gens = 500 L/s O₂ → 500 / 10 = 50 L ice/s.
    const ls = lifeSupport(ship([block('OxygenGenerator', 2)]));
    expect(ls.iceBurnForOxygen).toBe(50);
  });

  it('reports no life support for a ship with no gas hardware', () => {
    const ls = lifeSupport(ship([block('LargeBlockCockpit', 1)]));
    expect(ls.hasLifeSupport).toBe(false);
    expect(ls.oxygenGeneration).toBe(0);
    expect(ls.oxygenCapacity).toBe(0);
  });
});
