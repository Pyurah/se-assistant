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
import { estimateRequirements, uniformThrusters, type EstimatorInput } from './estimate';

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
const genSciFiThrusterLarge = BLOCKS_BY_ID['gen:SmallBlockLargeThrustSciFi'] as ThrusterBlock;

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

    // Essentials (cockpit + cargo) carry over; sized blocks (thruster/battery/gyro) do not.
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

  it('picks the biggest total-thrust contributor as the dominant thruster, not the most numerous', () => {
    const seed = designToEstimateSeed(
      design([
        { definition: atmoSmall, quantity: 10, thrustDirection: 'up' },
        { definition: atmoLarge, quantity: 4, thrustDirection: 'up' },
      ]),
    );
    // atmoSmall is more numerous (10 vs 4) but atmoLarge contributes far more
    // total thrust (4 × 6.48 MN = 25.9 MN vs 10 × 648 kN = 6.48 MN), so it wins.
    // This is the main-drive-vs-maneuvering-thrusters case: size the build around
    // the engines doing the actual propulsion, not the numerous small RCS ones.
    expect(seed.thrusterId).toBe(atmoLarge.id);
  });

  it('breaks a thrust-contribution tie by id', () => {
    const seed = designToEstimateSeed(
      design([
        // Equal total thrust: 1 × 6.48 MN == 10 × 648 kN. Tie → lower id wins.
        { definition: atmoLarge, quantity: 1, thrustDirection: 'up' },
        { definition: atmoSmall, quantity: 10, thrustDirection: 'up' },
      ]),
    );
    // 'large-large-...' < 'large-small-...' lexically, so atmoLarge is chosen.
    expect(seed.thrusterId).toBe(atmoLarge.id);
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

  it('returns null config choices (→ grid defaults) when a design has no thrusters/power', () => {
    const seed = designToEstimateSeed(design([{ definition: cockpit, quantity: 1 }]));
    expect(seed.thrusterId).toBeNull();
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
    // Even though gyros outnumber batteries, the dominant *power* block is the battery.
    expect(seed.powerBlockId).toBe(largeBattery.id);
  });

  it('reports modded / unrecognized blocks as skipped, never as essentials', () => {
    const seed = designToEstimateSeed(
      design([
        { definition: cockpit, quantity: 1 },
        { definition: moddedBlock, quantity: 6, thrustDirection: 'up' },
      ]),
    );
    expect(seed.fixedBlocks.map((b) => b.id)).not.toContain(moddedBlock.id);
    expect(seed.skipped).toHaveLength(1);
    expect(seed.skipped[0]).toMatchObject({
      id: moddedBlock.id,
      name: moddedBlock.displayName,
      quantity: 6,
    });
  });

  it('carries generated (definition) non-sized blocks over as essentials, not skipped', () => {
    // Regression: generated `source:'definition'` blocks (armor, conveyors, …) are
    // recognized by the parser and factored into Analyze mode. They must also carry
    // into an Estimate build as fixed essentials — every recognized block counts
    // toward mass even though the estimator can't re-size it.
    const seed = designToEstimateSeed(
      design([{ definition: genArmor, quantity: 523 }], { gridSize: 'small' }),
    );
    expect(seed.fixedBlocks).toEqual([{ id: genArmor.id, quantity: 523 }]);
    expect(seed.skipped).toHaveLength(0);
  });

  it('seeds a generated thruster as the dominant config choice', () => {
    // A ship whose thrusters are only in the generated set (e.g. Sci-Fi ion) must
    // still preset the estimator's thruster config, not fall back to a grid default.
    const seed = designToEstimateSeed(
      design([{ definition: genSciFiThruster, quantity: 28, thrustDirection: 'up' }], {
        gridSize: 'small',
      }),
    );
    expect(seed.thrusterId).toBe(genSciFiThruster.id);
  });

  it('round-trips estimateToDesign → designToEstimateSeed for config identity', () => {
    // Build a real estimate, synthesize a design, then seed back from it. The
    // grid, non-sized essentials, planet, cargo, and *config choices* (thruster
    // + power type) must survive — sized counts are intentionally re-derived.
    const input: EstimatorInput = {
      fixedBlocks: [
        { definition: cockpit, quantity: 1 },
        { definition: largeCargo, quantity: 2 },
      ],
      planet: earthlike,
      cargo: { fillFraction: 0.4, densityKgPerL: 2.5 },
      config: {
        targetTwr: 2.0,
        lateralThrustFraction: 0.5,
        thrusters: uniformThrusters(atmoLarge),
        power: { kind: 'battery', block: largeBattery },
        runtimeTargetHours: 0.25,
        gyro: largeGyro,
        responsiveness: 'normal',
      },
    };
    const estimate = estimateRequirements(input);
    const synthesized = estimateToDesign(input, estimate, 'earthlike');
    const seed = designToEstimateSeed(synthesized);

    expect(seed.gridSize).toBe('large');
    expect(seed.planetId).toBe('earthlike');
    expect(seed.cargo).toEqual({ fillFraction: 0.4, densityKgPerL: 2.5 });
    expect(seed.fixedBlocks).toEqual([
      { id: cockpit.id, quantity: 1 },
      { id: largeCargo.id, quantity: 2 },
    ]);
    // Config choices recovered from the dominant sized blocks.
    expect(seed.thrusterId).toBe(atmoLarge.id);
    expect(seed.powerBlockId).toBe(largeBattery.id);
    expect(seed.powerKind).toBe('battery');
    expect(seed.skipped).toHaveLength(0);
  });

  it('does not select a mixed build’s minority thruster as dominant', () => {
    // A mixed build: atmospheric up (many), ion sides (few). Atmospheric wins.
    const seed = designToEstimateSeed(
      design([
        { definition: atmoLarge, quantity: 12, thrustDirection: 'up' },
        { definition: ionLarge, quantity: 2, thrustDirection: 'left' },
        { definition: ionLarge, quantity: 2, thrustDirection: 'right' },
      ]),
    );
    expect(seed.thrusterId).toBe(atmoLarge.id);
  });

  it('picks the main-drive thruster over numerous maneuvering thrusters (Heavy Space Fighter regression)', () => {
    // The real bug: a small-grid fighter carries MANY small maneuvering/RCS
    // thrusters (28 × 14.4 kN = 403 kN total) plus FEWER large main-drive
    // thrusters (23 × 172.8 kN = 3.97 MN total). Selecting by count picked the
    // small thruster, so the estimator tried to build the whole ship out of RCS,
    // needed thousands, blew the sanity cap, and returned an all-zero build. The
    // main drive contributes ~10× the total thrust and must be the seed choice.
    const seed = designToEstimateSeed(
      design(
        [
          { definition: genSciFiThruster, quantity: 28, thrustDirection: 'left' },
          { definition: genSciFiThrusterLarge, quantity: 23, thrustDirection: 'forward' },
        ],
        { gridSize: 'small' },
      ),
    );
    expect(seed.thrusterId).toBe(genSciFiThrusterLarge.id);
  });
});
