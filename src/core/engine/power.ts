/**
 * Power budget — supply vs. draw, brownout detection, battery runtime.
 *
 * Supply has two parts: sustained *generation* (reactors + solar at full sun +
 * hydrogen engines + wind turbines) and *battery discharge* (instantaneous, but
 * drains a finite store). Total available power is the sum — a battery-only ship
 * is powered by its batteries, not "0 W". A brownout occurs when realistic peak
 * draw exceeds total available power.
 *
 * Peak draw is a REALISTIC worst case, not the naive sum of every thruster:
 * opposing thrusters (up vs. down, forward vs. back, left vs. right) never fire
 * together, so we take the larger of each opposing pair and add all non-thruster
 * draw. Summing all six axes would roughly double the true thruster load and
 * invent brownouts that never happen in flight.
 *
 * Note: solar/wind figures are best-case (full sun / average weather). The UI
 * should label them as such; day/night and weather derating is a Phase 2 item.
 */

import type { ShipDesign } from '../types';
import type { Direction } from '../../data/schema';

export interface PowerSummary {
  /** Sustained generation excluding batteries, W. */
  readonly generation: number;
  /** Battery discharge capacity (max output), W. */
  readonly batteryOutput: number;
  /** Battery stored energy, Wh. */
  readonly batteryCapacity: number;
  /** Total instantaneous supply: generation + battery discharge, W. */
  readonly availablePower: number;
  /** Realistic peak electrical draw (max per opposing thruster pair), W. */
  readonly peakDraw: number;
  /** availablePower − peakDraw, W. Negative = draw exceeds all supply. */
  readonly surplus: number;
  /** True when peak draw exceeds total available power (gen + battery). */
  readonly brownout: boolean;
  /** True when there is no sustained generation — the ship runs on batteries. */
  readonly batteryOnly: boolean;
  /**
   * How long batteries can cover the draw not met by sustained generation,
   * hours. Infinity when generation alone meets draw; 0 when there is a deficit
   * but no battery.
   */
  readonly batteryRuntimeHours: number;
}

/** Sum sustained generation from reactors, solar, hydrogen engines, wind. */
function generation(design: ShipDesign): number {
  let total = 0;
  for (const b of design.blocks) {
    const def = b.definition;
    if (
      def.category === 'reactor' ||
      def.category === 'solar' ||
      def.category === 'hydrogen-engine' ||
      def.category === 'wind-turbine'
    ) {
      total += def.maxPowerOutput * b.quantity;
    }
  }
  return total;
}

function batteryTotals(design: ShipDesign): { output: number; capacity: number } {
  let output = 0;
  let capacity = 0;
  for (const b of design.blocks) {
    const def = b.definition;
    if (def.category === 'battery') {
      output += def.maxPowerOutput * b.quantity;
      capacity += def.energyCapacity * b.quantity;
    }
  }
  return { output, capacity };
}

/** The electrical draw a block carries: `maxPowerDraw` or `powerDraw`, W. */
function blockDraw(def: ShipDesign['blocks'][number]['definition']): number {
  if ('maxPowerDraw' in def && typeof def.maxPowerDraw === 'number') return def.maxPowerDraw;
  if ('powerDraw' in def && typeof def.powerDraw === 'number') return def.powerDraw;
  return 0;
}

/**
 * Realistic peak electrical draw at full throttle, W.
 *
 * Thrusters are bucketed by thrust direction and each opposing pair contributes
 * only its larger side (you can fire up OR down, never both), then the three
 * axes are summed with all non-thruster draw. A thruster with no resolved
 * direction is counted in full (we can't prove it opposes anything).
 */
export function peakDraw(design: ShipDesign): number {
  const axis: Record<Direction, number> = {
    up: 0,
    down: 0,
    forward: 0,
    backward: 0,
    left: 0,
    right: 0,
  };
  let nonThruster = 0;
  for (const b of design.blocks) {
    const def = b.definition;
    const draw = blockDraw(def) * b.quantity;
    if (def.category === 'thruster' && b.thrustDirection !== undefined) {
      axis[b.thrustDirection] += draw;
    } else {
      nonThruster += draw;
    }
  }
  const opposedPeak =
    Math.max(axis.up, axis.down) +
    Math.max(axis.forward, axis.backward) +
    Math.max(axis.left, axis.right);
  return opposedPeak + nonThruster;
}

export function powerSummary(design: ShipDesign): PowerSummary {
  const gen = generation(design);
  const { output: batteryOutput, capacity: batteryCapacity } = batteryTotals(design);
  const draw = peakDraw(design);
  const availablePower = gen + batteryOutput;
  const surplus = availablePower - draw;
  const brownout = draw > availablePower;

  // Deficit that batteries must cover (only the part generation can't supply).
  const deficit = Math.max(0, draw - gen);
  let batteryRuntimeHours: number;
  if (deficit === 0) {
    batteryRuntimeHours = Infinity; // generation alone meets draw
  } else if (batteryCapacity === 0) {
    batteryRuntimeHours = 0; // deficit but nothing stored
  } else {
    // Wh / W = h. Capped by discharge rate: if deficit exceeds battery output,
    // the batteries can't even sustain it — but they still drain, so runtime is
    // capacity / deficit (they empty while under-supplying).
    batteryRuntimeHours = batteryCapacity / deficit;
  }

  return {
    generation: gen,
    batteryOutput,
    batteryCapacity,
    availablePower,
    peakDraw: draw,
    surplus,
    brownout,
    batteryOnly: gen === 0 && batteryOutput > 0,
    batteryRuntimeHours,
  };
}
