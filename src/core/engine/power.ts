/**
 * Power budget — generation vs. draw, brownout detection, battery runtime.
 *
 * Generation = reactors + solar (at full sun) + hydrogen engines + wind
 * turbines + battery discharge output. Peak draw = the sum of every block's
 * peak electrical draw (thrusters at full throttle dominate). A brownout occurs
 * when peak draw exceeds sustained generation; batteries can cover the deficit
 * for a while, which sets a runtime.
 *
 * Note: solar/wind figures are best-case (full sun / average weather). The UI
 * should label them as such; day/night and weather derating is a Phase 2 item.
 */

import type { ShipDesign } from '../types';

export interface PowerSummary {
  /** Sustained generation excluding batteries, W. */
  readonly generation: number;
  /** Battery discharge capacity (max output), W. */
  readonly batteryOutput: number;
  /** Battery stored energy, Wh. */
  readonly batteryCapacity: number;
  /** Peak electrical draw at full throttle, W. */
  readonly peakDraw: number;
  /** generation − peakDraw, W. Negative = deficit covered by batteries. */
  readonly surplus: number;
  /** True when peak draw exceeds sustained generation (batteries drain). */
  readonly brownout: boolean;
  /**
   * How long batteries can cover a deficit, hours. Infinity when there is no
   * deficit (generation meets draw); 0 when there is a deficit but no battery.
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

/** Peak electrical draw: thrusters at full throttle + all block op/idle draw. */
export function peakDraw(design: ShipDesign): number {
  let total = 0;
  for (const b of design.blocks) {
    const def = b.definition;
    // Thrusters and utility blocks expose `maxPowerDraw`; gyros and generic
    // blocks expose `powerDraw`. Sum whichever a block carries.
    if ('maxPowerDraw' in def && typeof def.maxPowerDraw === 'number') {
      total += def.maxPowerDraw * b.quantity;
    } else if ('powerDraw' in def && typeof def.powerDraw === 'number') {
      total += def.powerDraw * b.quantity;
    }
  }
  return total;
}

export function powerSummary(design: ShipDesign): PowerSummary {
  const gen = generation(design);
  const { output: batteryOutput, capacity: batteryCapacity } = batteryTotals(design);
  const draw = peakDraw(design);
  const surplus = gen - draw;
  const brownout = draw > gen + batteryOutput;

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
    peakDraw: draw,
    surplus,
    brownout,
    batteryRuntimeHours,
  };
}
