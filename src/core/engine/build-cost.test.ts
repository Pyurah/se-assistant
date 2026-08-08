import { describe, it, expect } from 'vitest';
import { VANILLA_BLOCKS_BY_ID } from '../../data/blocks';
import { REFINERY_PRESETS, ASSEMBLER_PRESETS } from '../../data/manufacturing';
import type { BlockDefinition } from '../../data/schema';
import type { ShipDesign, DesignBlock } from '../types';
import {
  buildCost,
  totalIngotMass,
  totalOreMass,
  hasUnknownBlocks,
} from './build-cost';

/**
 * A synthetic block whose subtypeId is exactly a recipe key, so a test can
 * isolate one recipe without depending on which dataset id maps to it.
 */
function block(subtypeId: string, overrides: Partial<BlockDefinition> = {}): BlockDefinition {
  return {
    id: `synthetic:${subtypeId}`,
    subtypeId,
    displayName: subtypeId,
    category: 'other',
    gridSize: 'large',
    dlc: 'base',
    mass: 0,
    source: 'vanilla',
    ...overrides,
  } as BlockDefinition;
}

function design(blocks: DesignBlock[]): ShipDesign {
  return {
    id: 'test',
    name: 'Test',
    gridSize: 'large',
    blocks,
    planetId: 'earthlike',
    cargo: { fillFraction: 0, densityKgPerL: 0 },
  };
}

const basicRefinery = REFINERY_PRESETS.find((r) => r.id === 'basic-refinery')!;
const basicAssembler = ASSEMBLER_PRESETS.find((a) => a.id === 'basic-assembler')!;

describe('buildCost', () => {
  it('costs a single-component block down to ore (steel plate armor)', () => {
    // SmallBlockArmorBlock = 1 Steel Plate. Steel Plate = 21 kg Iron ingot.
    // Default refinery iron yield = 0.7 × 0.8 = 0.56 → ore = 21 / 0.56 = 37.5 kg.
    const cost = buildCost(design([{ definition: block('SmallBlockArmorBlock'), quantity: 1 }]));

    expect(cost.components['steel-plate']).toBe(1);
    expect(cost.ingots.iron).toBeCloseTo(21, 6);
    expect(cost.ore.iron).toBeCloseTo(37.5, 6);
    expect(cost.unknownBlocks).toHaveLength(0);
    expect(cost.knownBlockTypes).toBe(1);
    expect(cost.totalBlockTypes).toBe(1);
  });

  it('scales linearly with block quantity', () => {
    const cost = buildCost(design([{ definition: block('SmallBlockArmorBlock'), quantity: 10 }]));
    expect(cost.components['steel-plate']).toBe(10);
    expect(cost.ingots.iron).toBeCloseTo(210, 6);
    expect(cost.ore.iron).toBeCloseTo(375, 6);
  });

  it('sums a multi-component, multi-metal block (cockpit) with hand-verified ingots', () => {
    // LargeBlockCockpit: interior-plate 20, construction 20, motor 2,
    // computer 100, display 10, bulletproof-glass 10.
    //   iron    = 20·3.5 + 20·10 + 2·20 + 100·0.5 + 10·1        = 370
    //   nickel  = 2·5                                            = 10
    //   silicon = 100·0.2 + 10·5 + 10·15                         = 220
    const cost = buildCost(design([{ definition: block('LargeBlockCockpit'), quantity: 1 }]));

    expect(cost.ingots.iron).toBeCloseTo(370, 6);
    expect(cost.ingots.nickel).toBeCloseTo(10, 6);
    expect(cost.ingots.silicon).toBeCloseTo(220, 6);

    // Ore = ingot / (baseYield × 0.8): iron/0.56, nickel/0.32, silicon/0.56.
    expect(cost.ore.iron).toBeCloseTo(370 / 0.56, 6);
    expect(cost.ore.nickel).toBeCloseTo(10 / 0.32, 6);
    expect(cost.ore.silicon).toBeCloseTo(220 / 0.56, 6);
  });

  it('divides ingot cost by the Assembler-Efficiency world setting', () => {
    const realistic = buildCost(design([{ definition: block('SmallBlockArmorBlock'), quantity: 1 }]));
    const x3 = buildCost(design([{ definition: block('SmallBlockArmorBlock'), quantity: 1 }]), {
      assemblerEfficiency: 3,
    });
    expect(x3.ingots.iron).toBeCloseTo(realistic.ingots.iron! / 3, 6);
    // Component count is unchanged — efficiency only cheapens ingots.
    expect(x3.components['steel-plate']).toBe(1);
  });

  it('clamps assembler efficiency below 1 to 1 (no free ingots)', () => {
    const cost = buildCost(design([{ definition: block('SmallBlockArmorBlock'), quantity: 1 }]), {
      assemblerEfficiency: 0.1,
    });
    expect(cost.ingots.iron).toBeCloseTo(21, 6);
  });

  it('a worse refinery needs more ore and more refine time', () => {
    const d = design([{ definition: block('SmallBlockArmorBlock'), quantity: 1 }]);
    const std = buildCost(d);
    const basic = buildCost(d, { refinery: basicRefinery });

    // Basic refinery iron yield = 0.7 × 0.7 = 0.49 → ore = 21 / 0.49.
    expect(basic.ore.iron).toBeCloseTo(21 / 0.49, 6);
    expect(basic.ore.iron!).toBeGreaterThan(std.ore.iron!);
    expect(basic.refineTimeSeconds).toBeGreaterThan(std.refineTimeSeconds);
  });

  it('computes refine + assemble time from the chosen speeds', () => {
    // 1 armor block: 1 steel-plate (assemble base 1 s) → refine 37.5 kg iron ore
    // at iron base 0.05 s/kg. Standard: assembler 1×, refinery 1.3×.
    const cost = buildCost(design([{ definition: block('SmallBlockArmorBlock'), quantity: 1 }]));
    expect(cost.assembleTimeSeconds).toBeCloseTo(1 / 1.0, 6);
    expect(cost.refineTimeSeconds).toBeCloseTo((37.5 * 0.05) / 1.3, 6);

    // A basic assembler (0.5×) doubles assemble time.
    const slow = buildCost(design([{ definition: block('SmallBlockArmorBlock'), quantity: 1 }]), {
      assembler: basicAssembler,
    });
    expect(slow.assembleTimeSeconds).toBeCloseTo(2, 6);
  });

  it('surfaces unrecognized blocks instead of costing them as zero', () => {
    const cost = buildCost(
      design([
        { definition: block('SmallBlockArmorBlock'), quantity: 1 },
        {
          definition: block('SomeExoticModdedBlock', { displayName: 'Exotic (modded)', source: 'blueprint' }),
          quantity: 4,
        },
      ]),
    );
    expect(cost.unknownBlocks).toEqual([
      { subtypeId: 'SomeExoticModdedBlock', displayName: 'Exotic (modded)', quantity: 4 },
    ]);
    expect(cost.knownBlockTypes).toBe(1);
    expect(cost.totalBlockTypes).toBe(2);
    expect(hasUnknownBlocks(cost)).toBe(true);
    // The known block still costs correctly.
    expect(cost.ingots.iron).toBeCloseTo(21, 6);
  });

  it('resolves reskin/variant aliases to the base recipe', () => {
    // SmallShipWelderReskin shares SmallShipWelder's recipe.
    const reskin = buildCost(design([{ definition: block('SmallShipWelderReskin'), quantity: 1 }]));
    const base = buildCost(design([{ definition: block('SmallShipWelder'), quantity: 1 }]));
    expect(reskin.ingots).toEqual(base.ingots);
    expect(reskin.unknownBlocks).toHaveLength(0);
  });

  it('merges costs across many different block types', () => {
    const cost = buildCost(
      design([
        { definition: block('SmallBlockArmorBlock'), quantity: 2 }, // 2 steel-plate
        { definition: block('LargeBlockArmorBlock'), quantity: 1 }, // 25 steel-plate
      ]),
    );
    expect(cost.components['steel-plate']).toBe(27);
    expect(cost.ingots.iron).toBeCloseTo(27 * 21, 6);
  });

  it('works on a real dataset block (large cockpit id → LargeBlockCockpit)', () => {
    const cockpit = VANILLA_BLOCKS_BY_ID['large-cockpit'] as BlockDefinition;
    const cost = buildCost(design([{ definition: cockpit, quantity: 1 }]));
    // Same hand-verified ingot totals as the synthetic cockpit above.
    expect(cost.ingots.iron).toBeCloseTo(370, 6);
    expect(cost.ingots.silicon).toBeCloseTo(220, 6);
    expect(cost.unknownBlocks).toHaveLength(0);
  });

  it('totalIngotMass / totalOreMass sum across metals', () => {
    const cost = buildCost(design([{ definition: block('LargeBlockCockpit'), quantity: 1 }]));
    expect(totalIngotMass(cost)).toBeCloseTo(370 + 10 + 220, 6);
    expect(totalOreMass(cost)).toBeCloseTo(370 / 0.56 + 10 / 0.32 + 220 / 0.56, 6);
  });

  it('an all-unknown design yields empty totals but reports every block', () => {
    const cost = buildCost(
      design([{ definition: block('TotallyUnknownThing', { source: 'blueprint' }), quantity: 3 }]),
    );
    expect(cost.components).toEqual({});
    expect(cost.ingots).toEqual({});
    expect(cost.ore).toEqual({});
    expect(totalOreMass(cost)).toBe(0);
    expect(cost.knownBlockTypes).toBe(0);
    expect(cost.unknownBlocks).toHaveLength(1);
  });
});
