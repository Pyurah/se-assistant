import { describe, it, expect } from 'vitest';
import { VANILLA_BLOCKS_BY_ID } from '../../data/blocks';
import { BLOCKS_BY_ID } from '../../data/all-blocks';
import { PLANET_PRESETS_BY_ID } from '../../data/planets';
import type {
  BlockDefinition,
  ThrusterBlock,
  BatteryBlock,
  PowerProducerBlock,
  GyroscopeBlock,
} from '../../data/schema';
import type { ShipDesign, DesignBlock } from '../types';
import { designToEstimateSeed } from './design-to-estimate';
import { estimateToDesign } from './estimate-to-design';
import { estimateManual, type ManualEstimatorInput, type ThrusterLayout } from './estimate';

const earthlike = PLANET_PRESETS_BY_ID['earthlike']!;

const cockpit = VANILLA_BLOCKS_BY_ID['large-cockpit'] as BlockDefinition;
const largeCargo = VANILLA_BLOCKS_BY_ID['large-large-cargo-container'] as BlockDefinition;
const atmoLarge = VANILLA_BLOCKS_BY_ID['large-large-atmospheric-thruster'] as ThrusterBlock;
const atmoSmall = VANILLA_BLOCKS_BY_ID['large-small-atmospheric-thruster'] as ThrusterBlock;
const ionLarge = VANILLA_BLOCKS_BY_ID['large-large-ion-thruster'] as ThrusterBlock;
const largeBattery = VANILLA_BLOCKS_BY_ID['large-battery'] as BatteryBlock;
const largeReactor = VANILLA_BLOCKS_BY_ID['large-large-reactor'] as PowerProducerBlock;
const largeGyro = VANILLA_BLOCKS_BY_ID['large-gyroscope'] as GyroscopeBlock;

// A block that exists ONLY in the generated (definition) set, not the curated
// vanilla set — the class of block that the blueprint parser recognizes and the
// Analyze view factors in, but that the estimator seed used to wrongly drop.
const genArmor = BLOCKS_BY_ID['gen:SmallHeavyBlockArmorBlock'] as BlockDefinition;
const genSciFiThruster = BLOCKS_BY_ID['gen:SmallBlockSmallThrustSciFi'] as ThrusterBlock;

/** A modded/unrecognized block, as the parser emits for unknown subtypes. */
const moddedBlock: BlockDefinition = {
  id: 'modded:SomeExoticThruster',
  subtypeId: 'SomeExoticThruster',
  displayName: 'Exotic Thruster (modded)',
  category: 'other',
  gridSize: 'large',
  dlc: 'base',
  mass: 0,
  source: 'blueprint',
};

function design(blocks: DesignBlock[], overrides?: Partial<ShipDesign>): ShipDesign {
  return {
    id: 'test-design',
    name: 'Test Ship',
    gridSize: 'large',
    blocks,
    planetId: 'earthlike',
    cargo: { fillFraction: 0.5, densityKgPerL: 2.8 },
    ...overrides,
  };
}

describe('designToEstimateSeed', () => {
  it('carries non-sized essentials through with their exact counts', () => {
    const seed = designToEstimateSeed(
      design([
        { definition: cockpit, quantity: 1 },
        { definition: largeCargo, quantity: 3 },
        { definition: atmoLarge, quantity: 8, thrustDirection: 'up' },
        { definition: largeBattery, quantity: 2 },
        { definition: largeGyro, quantity: 4 },
      ]),
    );

    // Essentials (cockpit + cargo) carry over; sized blocks (battery/gyro) do not.
    expect(seed.fixedBlocks).toEqual([
      { id: cockpit.id, quantity: 1 },
      { id: largeCargo.id, quantity: 3 },
    ]);
    const fixedIds = seed.fixedBlocks.map((b) => b.id);
    expect(fixedIds).not.toContain(atmoLarge.id);
    expect(fixedIds).not.toContain(largeBattery.id);
    expect(fixedIds).not.toContain(largeGyro.id);
  });

  it('carries grid, planet, and cargo straight through', () => {
    const seed = designToEstimateSeed(
      design([{ definition: cockpit, quantity: 1 }], {
        gridSize: 'large',
        planetId: 'mars',
        cargo: { fillFraction: 0.25, densityKgPerL: 1.5 },
      }),
    );
    expect(seed.gridSize).toBe('large');
    expect(seed.planetId).toBe('mars');
    expect(seed.cargo).toEqual({ fillFraction: 0.25, densityKgPerL: 1.5 });
  });

  it('merges duplicate non-sized block ids into a single essential', () => {
    const seed = designToEstimateSeed(
      design([
        { definition: largeCargo, quantity: 2 },
        { definition: largeCargo, quantity: 3 },
      ]),
    );
    expect(seed.fixedBlocks).toEqual([{ id: largeCargo.id, quantity: 5 }]);
  });

  it('carries the real per-direction thruster layout into stacks', () => {
    const seed = designToEstimateSeed(
      design([
        { definition: atmoLarge, quantity: 8, thrustDirection: 'up' },
        { definition: atmoLarge, quantity: 4, thrustDirection: 'down' },
        { definition: ionLarge, quantity: 2, thrustDirection: 'left' },
      ]),
    );
    expect(seed.thrusterStacks.up).toEqual([{ blockId: atmoLarge.id, count: 8 }]);
    expect(seed.thrusterStacks.down).toEqual([{ blockId: atmoLarge.id, count: 4 }]);
    expect(seed.thrusterStacks.left).toEqual([{ blockId: ionLarge.id, count: 2 }]);
    expect(seed.thrusterStacks.right).toEqual([]);
    expect(seed.thrusterStacks.forward).toEqual([]);
  });

  it('preserves MULTIPLE thruster types mixed in one direction', () => {
    const seed = designToEstimateSeed(
      design([
        { definition: atmoLarge, quantity: 4, thrustDirection: 'up' },
        { definition: ionLarge, quantity: 6, thrustDirection: 'up' },
      ]),
    );
    expect(seed.thrusterStacks.up).toEqual([
      { blockId: atmoLarge.id, count: 4 },
      { blockId: ionLarge.id, count: 6 },
    ]);
  });

  it('merges duplicate (direction, type) entries into a single stack row', () => {
    const seed = designToEstimateSeed(
      design([
        { definition: atmoLarge, quantity: 3, thrustDirection: 'up' },
        { definition: atmoLarge, quantity: 5, thrustDirection: 'up' },
      ]),
    );
    expect(seed.thrusterStacks.up).toEqual([{ blockId: atmoLarge.id, count: 8 }]);
  });

  it('omits UNORIENTED thrusters from the stacks (no direction to attribute to)', () => {
    const seed = designToEstimateSeed(
      design([
        { definition: atmoLarge, quantity: 4, thrustDirection: 'up' },
        { definition: atmoSmall, quantity: 10 }, // no thrustDirection
      ]),
    );
    expect(seed.thrusterStacks.up).toEqual([{ blockId: atmoLarge.id, count: 4 }]);
    // The unoriented atmoSmall appears nowhere in the stacks.
    const allEntries = Object.values(seed.thrusterStacks).flat();
    expect(allEntries.some((e) => e.blockId === atmoSmall.id)).toBe(false);
    // Nor is it a skipped block — it's recognized, just unattributable.
    expect(seed.skipped).toHaveLength(0);
  });

  it('derives powerKind from the dominant power block (battery)', () => {
    const seed = designToEstimateSeed(
      design([
        { definition: largeBattery, quantity: 3 },
        { definition: largeReactor, quantity: 1 },
      ]),
    );
    expect(seed.powerBlockId).toBe(largeBattery.id);
    expect(seed.powerKind).toBe('battery');
  });

  it('derives powerKind as producer when a reactor dominates', () => {
    const seed = designToEstimateSeed(
      design([
        { definition: largeReactor, quantity: 3 },
        { definition: largeBattery, quantity: 1 },
      ]),
    );
    expect(seed.powerBlockId).toBe(largeReactor.id);
    expect(seed.powerKind).toBe('producer');
  });

  it('returns empty stacks + null power (→ grid defaults) when a design has no thrusters/power', () => {
    const seed = designToEstimateSeed(design([{ definition: cockpit, quantity: 1 }]));
    expect(Object.values(seed.thrusterStacks).every((s) => s.length === 0)).toBe(true);
    expect(seed.powerBlockId).toBeNull();
    expect(seed.powerKind).toBe('battery');
  });

  it('excludes gyros from the power tally (sized purely from mass)', () => {
    const seed = designToEstimateSeed(
      design([
        { definition: largeGyro, quantity: 8 },
        { definition: largeBattery, quantity: 1 },
      ]),
    );
    expect(seed.powerBlockId).toBe(largeBattery.id);
  });

  it('reports modded / unrecognized blocks as skipped, never as essentials or stacks', () => {
    const seed = designToEstimateSeed(
      design([
        { definition: cockpit, quantity: 1 },
        { definition: moddedBlock, quantity: 6, thrustDirection: 'up' },
      ]),
    );
    expect(seed.fixedBlocks.map((b) => b.id)).not.toContain(moddedBlock.id);
    expect(Object.values(seed.thrusterStacks).flat().some((e) => e.blockId === moddedBlock.id)).toBe(false);
    expect(seed.skipped).toHaveLength(1);
    expect(seed.skipped[0]).toMatchObject({
      id: moddedBlock.id,
      name: moddedBlock.displayName,
      quantity: 6,
    });
  });

  it('carries generated (definition) non-sized blocks over as essentials, not skipped', () => {
    const seed = designToEstimateSeed(
      design([{ definition: genArmor, quantity: 523 }], { gridSize: 'small' }),
    );
    expect(seed.fixedBlocks).toEqual([{ id: genArmor.id, quantity: 523 }]);
    expect(seed.skipped).toHaveLength(0);
  });

  it('carries generated thrusters into the stacks with their real direction', () => {
    const seed = designToEstimateSeed(
      design([{ definition: genSciFiThruster, quantity: 28, thrustDirection: 'left' }], {
        gridSize: 'small',
      }),
    );
    expect(seed.thrusterStacks.left).toEqual([{ blockId: genSciFiThruster.id, count: 28 }]);
  });

  it('round-trips estimateToDesign → designToEstimateSeed for the full layout', () => {
    // Build a manual estimate with a mixed UP axis, synthesize a design, then seed
    // back from it. Grid, essentials, planet, cargo, power, and the FULL thruster
    // layout must survive.
    const layout: ThrusterLayout = {
      up: [
        { definition: atmoLarge, count: 6 },
        { definition: ionLarge, count: 2 },
      ],
      down: [{ definition: atmoLarge, count: 3 }],
      forward: [],
      backward: [],
      left: [],
      right: [],
    };
    const input: ManualEstimatorInput = {
      fixedBlocks: [
        { definition: cockpit, quantity: 1 },
        { definition: largeCargo, quantity: 2 },
      ],
      planet: earthlike,
      cargo: { fillFraction: 0.4, densityKgPerL: 2.5 },
      gridSize: 'large',
      config: {
        thrusterLayout: layout,
        power: { kind: 'battery', block: largeBattery },
        runtimeTargetHours: 0.25,
        gyro: largeGyro,
        targetTurnTime: 2.5,
      },
    };
    const estimate = estimateManual(input);
    const synthesized = estimateToDesign(input, estimate, 'earthlike');
    const seed = designToEstimateSeed(synthesized);

    expect(seed.gridSize).toBe('large');
    expect(seed.planetId).toBe('earthlike');
    expect(seed.cargo).toEqual({ fillFraction: 0.4, densityKgPerL: 2.5 });
    expect(seed.fixedBlocks).toEqual([
      { id: cockpit.id, quantity: 1 },
      { id: largeCargo.id, quantity: 2 },
    ]);
    expect(seed.thrusterStacks.up).toEqual([
      { blockId: atmoLarge.id, count: 6 },
      { blockId: ionLarge.id, count: 2 },
    ]);
    expect(seed.thrusterStacks.down).toEqual([{ blockId: atmoLarge.id, count: 3 }]);
    expect(seed.thrusterStacks.left).toEqual([]);
    expect(seed.powerBlockId).toBe(largeBattery.id);
    expect(seed.powerKind).toBe('battery');
    expect(seed.skipped).toHaveLength(0);
  });
});
