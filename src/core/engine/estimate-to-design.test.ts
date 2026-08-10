import { describe, it, expect } from 'vitest';
import { VANILLA_BLOCKS_BY_ID } from '../../data/blocks';
import { PLANET_PRESETS_BY_ID } from '../../data/planets';
import type {
  ThrusterBlock,
  GyroscopeBlock,
  BatteryBlock,
  BlockDefinition,
} from '../../data/schema';
import {
  estimateManual,
  type ManualEstimatorInput,
  type ThrusterLayout,
  type FixedBlockSpec,
} from './estimate';
import { estimateToDesign } from './estimate-to-design';
import { liftAnalysis, directionalTwr, DIRECTIONS } from './twr';
import { dryMass as designDryMass, loadedMass as designLoadedMass } from './mass';

const earthlike = PLANET_PRESETS_BY_ID['earthlike']!;

const atmoLarge = VANILLA_BLOCKS_BY_ID['large-large-atmospheric-thruster'] as ThrusterBlock;
const ionLarge = VANILLA_BLOCKS_BY_ID['large-large-ion-thruster'] as ThrusterBlock;
const largeBattery = VANILLA_BLOCKS_BY_ID['large-battery'] as BatteryBlock;
const largeCockpit = VANILLA_BLOCKS_BY_ID['large-cockpit'] as BlockDefinition;

const largeGyro: GyroscopeBlock = {
  id: 'test-large-gyro',
  subtypeId: 'LargeBlockGyro',
  displayName: 'Gyroscope (Large Grid)',
  category: 'gyroscope',
  gridSize: 'large',
  dlc: 'base',
  mass: 12_817,
  maxTorque: 33_600_000,
  powerDraw: 30,
  source: 'vanilla',
};

const essentials: FixedBlockSpec[] = [{ definition: largeCockpit, quantity: 1 }];

/** A uniform per-direction layout: `count` of `block` on every axis. */
function uniformLayout(block: ThrusterBlock, count: number): ThrusterLayout {
  return {
    up: [{ definition: block, count }],
    down: [{ definition: block, count }],
    forward: [{ definition: block, count }],
    backward: [{ definition: block, count }],
    left: [{ definition: block, count }],
    right: [{ definition: block, count }],
  };
}

function input(layout: ThrusterLayout, overrides?: Partial<ManualEstimatorInput>): ManualEstimatorInput {
  return {
    fixedBlocks: essentials,
    planet: earthlike,
    cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    gridSize: 'large',
    config: {
      thrusterLayout: layout,
      power: { kind: 'battery', block: largeBattery },
      runtimeTargetHours: 0.25,
      gyro: largeGyro,
      targetTurnTime: 2.5,
    },
    ...overrides,
  };
}

describe('estimateToDesign', () => {
  it('synthesizes a design with one thruster block per assigned direction', () => {
    const layout = uniformLayout(atmoLarge, 5);
    const inp = input(layout);
    const est = estimateManual(inp);
    const design = estimateToDesign(inp, est, 'earthlike');

    const thrusterBlocks = design.blocks.filter((b) => b.thrustDirection !== undefined);
    for (const d of DIRECTIONS) {
      const block = thrusterBlocks.find((b) => b.thrustDirection === d);
      expect(block).toBeDefined();
      expect(block!.quantity).toBe(5);
      expect(block!.definition.id).toBe(atmoLarge.id);
    }
  });

  it('omits directions with no assigned thrusters', () => {
    const layout: ThrusterLayout = {
      up: [{ definition: atmoLarge, count: 4 }],
      down: [],
      forward: [],
      backward: [],
      left: [],
      right: [],
    };
    const inp = input(layout);
    const est = estimateManual(inp);
    const design = estimateToDesign(inp, est, 'earthlike');
    const dirs = design.blocks.filter((b) => b.thrustDirection !== undefined).map((b) => b.thrustDirection);
    expect(dirs).toEqual(['up']);
  });

  it('includes the essentials, power, and gyro blocks (geometry-less)', () => {
    const inp = input(uniformLayout(atmoLarge, 5));
    const est = estimateManual(inp);
    const design = estimateToDesign(inp, est, 'earthlike');

    expect(design.blocks.some((b) => b.definition.id === largeCockpit.id)).toBe(true);
    expect(design.blocks.some((b) => b.definition.id === largeBattery.id)).toBe(true);
    expect(design.blocks.some((b) => b.definition.id === largeGyro.id)).toBe(true);
    expect(design.blocks.every((b) => b.positions === undefined)).toBe(true);
    expect(design.planetId).toBe('earthlike');
    expect(design.gridSize).toBe('large');
  });

  it('round-trips: liftAnalysis on the design reproduces the estimate up-TWR + masses', () => {
    const inp = input(uniformLayout(atmoLarge, 6));
    const est = estimateManual(inp);
    const design = estimateToDesign(inp, est, 'earthlike');
    const lift = liftAnalysis(design, earthlike);

    expect(lift.loadedUpTwr).toBeCloseTo(est.achievedUpTwr, 6);
    expect(designDryMass(design)).toBeCloseTo(est.dryMass, 3);
    expect(designLoadedMass(design)).toBeCloseTo(est.loadedMass, 3);
  });

  it('emits one block per TYPE when a direction mixes thruster types, summing thrust', () => {
    // UP = 4 atmospheric + 2 ion; both feasible on Earthlike, so both appear and
    // their thrust sums through directionalTwr.
    const layout: ThrusterLayout = {
      up: [
        { definition: atmoLarge, count: 4 },
        { definition: ionLarge, count: 2 },
      ],
      down: [],
      forward: [],
      backward: [],
      left: [],
      right: [],
    };
    const inp = input(layout);
    const est = estimateManual(inp);
    const design = estimateToDesign(inp, est, 'earthlike');

    const upBlocks = design.blocks.filter((b) => b.thrustDirection === 'up');
    expect(upBlocks).toHaveLength(2); // one per type
    const ids = upBlocks.map((b) => b.definition.id).sort();
    expect(ids).toEqual([atmoLarge.id, ionLarge.id].sort());

    // directionalTwr sums both types on the UP axis.
    const dir = directionalTwr(design, earthlike, est.loadedMass);
    expect(dir.up).toBeGreaterThan(0);
    expect(est.thrusters.up).toBe(6); // 4 + 2
  });

  it('carries extra mass onto the design so the shared engine reproduces the masses', () => {
    const inp = input(uniformLayout(atmoLarge, 6), {
      cargo: { fillFraction: 1.0, densityKgPerL: 2.0 },
      extraMass: { added: 25_000, payload: 10_000 },
    });
    const est = estimateManual(inp);
    const design = estimateToDesign(inp, est, 'earthlike');

    // The synthesized design carries the same extra mass...
    expect(design.extraMass).toEqual({ added: 25_000, payload: 10_000 });
    // ...so the trusted mass engine re-derives exactly what estimateManual computed.
    expect(designDryMass(design)).toBeCloseTo(est.dryMass, 3);
    expect(designLoadedMass(design)).toBeCloseTo(est.loadedMass, 3);
  });

  it('omits extraMass from the design when the input has none', () => {
    const inp = input(uniformLayout(atmoLarge, 5));
    const est = estimateManual(inp);
    const design = estimateToDesign(inp, est, 'earthlike');
    expect(design.extraMass).toBeUndefined();
  });
});
