/**
 * Life-support analysis for a ship/base design.
 *
 * Answers "can the crew breathe, and for how long?" from the design's O2/H2
 * generators and oxygen tanks:
 *   - O₂ generation: sum of every generator's oxygenOutput (L/s).
 *   - O₂ demand: crewSize × the per-character consumption (0.063 L/s).
 *   - Balance: does generation cover the crew, and how many crew can it support?
 *   - Stored O₂: total oxygen-tank capacity → breathing time if generation stops.
 *   - Ice burn: the ice/s the generators consume to sustain their O₂ output.
 *
 * Every constant is a cited game value (see src/data/life-support.ts). Honest
 * empty state: a ship with no life-support blocks has nothing to compute, and
 * the consumer renders a tidy "no life support" panel.
 *
 * PURE — no React, no DOM. Consumes only a {@link ShipDesign} and the pure
 * life-support constants.
 */

import type { ShipDesign } from '../types';
import {
  CHARACTER_O2_CONSUMPTION_L_PER_S,
  ICE_TO_OXYGEN_RATIO,
} from '../../data/life-support';

/** Tunable life-support inputs. */
export interface LifeSupportOptions {
  /** How many crew breathe from the ship's supply. Clamped to ≥ 0. Default 1. */
  readonly crewSize?: number;
}

/** The life-support picture for a design. */
export interface LifeSupport {
  /** Total O₂ generation across all O2/H2 generators, L/s. */
  readonly oxygenGeneration: number;
  /** Total stored O₂ across all oxygen tanks, liters. */
  readonly oxygenCapacity: number;
  /** Crew count the analysis was run for. */
  readonly crewSize: number;
  /** O₂ the crew consumes, L/s (crewSize × per-character rate). */
  readonly oxygenDemand: number;
  /** generation − demand, L/s. Positive = surplus, negative = deficit. */
  readonly oxygenBalance: number;
  /** True when generation ≥ demand (generators alone keep the crew breathing). */
  readonly generationCoversCrew: boolean;
  /** Max crew the generation alone can sustain (floor of gen ÷ per-character). */
  readonly maxCrewSupported: number;
  /**
   * Seconds the stored O₂ lasts the crew if generation stops entirely. Infinity
   * when there is no crew demand (nobody breathing). 0 when there is demand but
   * no stored O₂.
   */
  readonly breathingTimeSeconds: number;
  /**
   * Ice consumed per second to sustain the current O₂ generation, L/s
   * (generation ÷ the ice→oxygen ratio). This is the O₂-side ice draw only.
   */
  readonly iceBurnForOxygen: number;
  /** True when the design has any life-support hardware (generator or O₂ tank). */
  readonly hasLifeSupport: boolean;
}

/** Total O₂ generation (L/s) from all O2/H2 generators in the design. */
export function oxygenGeneration(design: ShipDesign): number {
  let total = 0;
  for (const b of design.blocks) {
    const def = b.definition;
    if (def.category === 'gas' && typeof def.oxygenOutput === 'number') {
      total += def.oxygenOutput * b.quantity;
    }
  }
  return total;
}

/** Total stored O₂ (liters) across all oxygen tanks in the design. */
export function oxygenCapacity(design: ShipDesign): number {
  let total = 0;
  for (const b of design.blocks) {
    const def = b.definition;
    if (def.category === 'gas' && def.storedGas === 'oxygen' && typeof def.gasCapacity === 'number') {
      total += def.gasCapacity * b.quantity;
    }
  }
  return total;
}

/**
 * Compute the full life-support picture for a design and crew size. See the
 * module doc for the model; all constants are cited game values.
 */
export function lifeSupport(design: ShipDesign, options: LifeSupportOptions = {}): LifeSupport {
  const crewSize = Math.max(0, Math.floor(options.crewSize ?? 1));
  const generation = oxygenGeneration(design);
  const capacity = oxygenCapacity(design);

  const demand = crewSize * CHARACTER_O2_CONSUMPTION_L_PER_S;
  const balance = generation - demand;
  const maxCrewSupported = Math.floor(generation / CHARACTER_O2_CONSUMPTION_L_PER_S);

  // Breathing time on stored O₂ if generation stops. No demand → unlimited.
  const breathingTimeSeconds = demand > 0 ? capacity / demand : Infinity;

  const iceBurnForOxygen = generation / ICE_TO_OXYGEN_RATIO;

  return {
    oxygenGeneration: generation,
    oxygenCapacity: capacity,
    crewSize,
    oxygenDemand: demand,
    oxygenBalance: balance,
    generationCoversCrew: generation >= demand,
    maxCrewSupported,
    breathingTimeSeconds,
    iceBurnForOxygen,
    hasLifeSupport: generation > 0 || capacity > 0,
  };
}
