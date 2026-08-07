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
  estimateRequirements,
  uniformThrusters,
  type EstimatorInput,
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

function input(overrides?: Partial<EstimatorInput['config']>): EstimatorInput {
  return {
    fixedBlocks: essentials,
    planet: earthlike,
    cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    config: {
      targetTwr: 2.0,
      lateralThrustFraction: 0.5,
      thrusters: uniformThrusters(atmoLarge),
      power: { kind: 'battery', block: largeBattery },
      runtimeTargetHours: 0.25,
      gyro: largeGyro,
      responsiveness: 'normal',
      ...overrides,
    },
  };
}

describe('estimateToDesign', () => {
  it('synthesizes a design with one thruster block per non-empty direction', () => {
    const inp = input();
    const est = estimateRequirements(inp);
    const design = estimateToDesign(inp, est, 'earthlike');

    const thrusterBlocks = design.blocks.filter((b) => b.thrustDirection !== undefined);
    // Every non-zero direction is represented, with the right count + definition.
    for (const d of DIRECTIONS) {
      const block = thrusterBlocks.find((b) => b.thrustDirection === d);
      if (est.thrusters[d] > 0) {
        expect(block).toBeDefined();
        expect(block!.quantity).toBe(est.thrusters[d]);
        expect(block!.definition.id).toBe(atmoLarge.id);
      } else {
        expect(block).toBeUndefined();
      }
    }
  });

  it('includes the essentials, power, and gyro blocks (geometry-less)', () => {
    const inp = input();
    const est = estimateRequirements(inp);
    const design = estimateToDesign(inp, est, 'earthlike');

    expect(design.blocks.some((b) => b.definition.id === largeCockpit.id)).toBe(true);
    expect(design.blocks.some((b) => b.definition.id === largeBattery.id)).toBe(true);
    expect(design.blocks.some((b) => b.definition.id === largeGyro.id)).toBe(true);
    // No positions on any block — estimator designs carry no geometry.
    expect(design.blocks.every((b) => b.positions === undefined)).toBe(true);
    expect(design.planetId).toBe('earthlike');
    expect(design.gridSize).toBe('large');
  });

  it('round-trips: liftAnalysis on the design reproduces the estimate up-TWR', () => {
    const inp = input();
    const est = estimateRequirements(inp);
    const design = estimateToDesign(inp, est, 'earthlike');
    const lift = liftAnalysis(design, earthlike);

    // The real TWR engine, run on the synthesized design, must agree with the
    // estimator's own achievedUpTwr (both use effectiveThrust + weight).
    expect(lift.loadedUpTwr).toBeCloseTo(est.achievedUpTwr, 6);
    // And masses agree too, since both sum definition.mass × quantity.
    expect(designDryMass(design)).toBeCloseTo(est.dryMass, 3);
    expect(designLoadedMass(design)).toBeCloseTo(est.loadedMass, 3);
  });

  it('exposes all six directional TWR values (not just up)', () => {
    const inp = input();
    const est = estimateRequirements(inp);
    const design = estimateToDesign(inp, est, 'earthlike');
    const dir = directionalTwr(design, earthlike, est.loadedMass);
    // Lateral directions were sized to half the up thrust, so they lift too.
    expect(dir.up).toBeGreaterThanOrEqual(2.0);
    expect(dir.forward).toBeGreaterThan(0);
    expect(dir.left).toBeGreaterThan(0);
  });

  it('carries mixed thruster types through to per-direction blocks', () => {
    // Atmospheric everywhere except the sides, which use ion. On Earthlike the
    // atmospheric UP axis lifts and ion (weak but feasible here) fills the sides,
    // so both types appear on their assigned directions.
    const mixed = uniformThrusters(atmoLarge);
    const inp = input({ thrusters: { ...mixed, left: ionLarge, right: ionLarge } });
    const est = estimateRequirements(inp);
    const design = estimateToDesign(inp, est, 'earthlike');

    const left = design.blocks.find((b) => b.thrustDirection === 'left');
    const up = design.blocks.find((b) => b.thrustDirection === 'up');
    expect(left?.definition.id).toBe(ionLarge.id);
    expect(up?.definition.id).toBe(atmoLarge.id);
  });
});
