/**
 * Bridge: turn an estimator result into a {@link ShipDesign}.
 *
 * The estimator sizes hardware from goals and returns counts; the Analyze engine
 * (TWR, mass, power, …) consumes a `ShipDesign`. This synthesizes that design so
 * the *same trusted engine* can render an estimated build — most importantly the
 * directional TWR readout — instead of duplicating TWR math on the estimate side.
 *
 * The synthesized design is intentionally **geometry-less**: `DesignBlock.positions`
 * is omitted (the type explicitly allows this for estimator-built designs), so the
 * geometry-dependent analyses (center-of-mass, thrust alignment) are skipped while
 * the count-and-thrust-based ones (directional TWR, mass, power) work exactly.
 *
 * It is also the reusable seed for editing an imported blueprint's loadout (M6.7):
 * once an estimate is a `ShipDesign`, the mutation surface is shared with imports.
 */

import type { ShipDesign, DesignBlock } from '../types';
import { DIRECTIONS } from './twr';
import type { ManualEstimatorInput, Estimate } from './estimate';

/**
 * Synthesize a {@link ShipDesign} from a manual estimator input + result.
 *
 * One thruster `DesignBlock` per (direction, thruster type) in the user's
 * layout — a direction that mixes types (e.g. UP = large hydrogen + small ion)
 * yields one block per type, all sharing that direction's `thrustDirection` so
 * {@link directionalThrust} sums them. Plus the essentials and the recommended
 * power/gyro blocks. Cargo, grid size, and planet come from the input; the
 * `estimate` supplies only the sized power/gyro counts.
 */
export function estimateToDesign(
  input: ManualEstimatorInput,
  estimate: Estimate,
  planetId: string,
): ShipDesign {
  const { config, fixedBlocks, cargo, gridSize } = input;
  const blocks: DesignBlock[] = [];

  // User-assigned thrusters: one entry per (direction, type) with a positive count.
  for (const d of DIRECTIONS) {
    for (const assignment of config.thrusterLayout[d]) {
      if (assignment.count > 0) {
        blocks.push({ definition: assignment.definition, quantity: assignment.count, thrustDirection: d });
      }
    }
  }

  // Essentials the user committed to (no thrust direction — non-thrusters).
  for (const spec of fixedBlocks) {
    if (spec.quantity > 0) {
      blocks.push({ definition: spec.definition, quantity: spec.quantity });
    }
  }

  // Recommended power blocks.
  if (estimate.powerCount > 0) {
    blocks.push({ definition: config.power.block, quantity: estimate.powerCount });
  }

  // Recommended gyros.
  if (estimate.gyroCount > 0) {
    blocks.push({ definition: config.gyro, quantity: estimate.gyroCount });
  }

  return {
    id: 'estimate',
    name: 'Estimated build',
    gridSize,
    blocks,
    planetId,
    cargo,
    // Carry the freeform extra mass onto the synthesized design so the shared
    // mass/TWR engines re-derive the exact figures estimateManual computed
    // (always-on `added` in dry mass, loaded-only `payload` in loaded mass).
    ...(input.extraMass ? { extraMass: input.extraMass } : {}),
    // Carry the world inventory-size multiplier so the shared cargo-capacity /
    // item-count engines scale the synthesized build the same way estimateManual
    // scaled its cargo payload.
    ...(input.inventorySizeMultiplier !== undefined
      ? { inventorySizeMultiplier: input.inventorySizeMultiplier }
      : {}),
  };
}
