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
import type { EstimatorInput, Estimate } from './estimate';

/**
 * Synthesize a {@link ShipDesign} from an estimator input + result.
 *
 * One thruster `DesignBlock` per direction that has a non-zero recommended count
 * (using that direction's chosen thruster type), plus the essentials and the
 * recommended power/gyro blocks. Cargo and grid size come from the input.
 */
export function estimateToDesign(
  input: EstimatorInput,
  estimate: Estimate,
  planetId: string,
): ShipDesign {
  const { config, fixedBlocks, cargo } = input;
  const blocks: DesignBlock[] = [];

  // Recommended thrusters, one entry per direction (skip empty directions).
  for (const d of DIRECTIONS) {
    const quantity = estimate.thrusters[d];
    if (quantity > 0) {
      blocks.push({ definition: config.thrusters[d], quantity, thrustDirection: d });
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
    gridSize: config.thrusters.up.gridSize,
    blocks,
    planetId,
    cargo,
  };
}
