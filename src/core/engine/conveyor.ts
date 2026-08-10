/**
 * Conveyor port & reachability audit for a ship design.
 *
 * Space Engineers has no published conveyor *throughput* (in-network transfer
 * is effectively instant), so a fabricated "items/sec" would violate the
 * project's #1 principle. The real, checkable constraint is **port size**: some
 * blocks (refineries, assemblers, large cargo, connectors, large drills, O2/H2
 * generators) can only be fed through a **large** conveyor line. A grid built
 * with only small tubes silently starves them.
 *
 * This audit is a **presence check, not a routed-connectivity solve**: a
 * blueprint carries geometry (`<Min>` positions) but not the conveyor wiring
 * graph, so we can't prove block A actually reaches block B. Instead we report:
 *   - which blocks in the design require a large port (with the reason),
 *   - whether the grid carries ANY large-port conveyor pieces to feed them,
 *   - an explicit caveat that presence ≠ routed connectivity.
 * This mirrors the honest simplifications elsewhere (stopping distance ignores
 * per-axis gravity; the throughput pipeline assumes a balanced fleet).
 *
 * PURE — no React, no DOM. Consumes only a {@link ShipDesign} and the pure
 * conveyor-ports dataset.
 */

import type { ShipDesign } from '../types';
import { largePortReason, isLargePortConveyor, type LargePortReason } from '../../data/conveyor-ports';

/** One large-port-requiring block type present in the design. */
export interface LargePortBlock {
  readonly subtypeId: string;
  readonly displayName: string;
  readonly quantity: number;
  /** Why this block needs a large conveyor port. */
  readonly reason: LargePortReason;
}

/** The conveyor port & reachability report for a design. */
export interface ConveyorAudit {
  /** Distinct block types that require a large conveyor port, sorted by count. */
  readonly largePortBlocks: readonly LargePortBlock[];
  /** Total number of large-port-requiring block instances. */
  readonly largePortBlockCount: number;
  /** Number of large-port conveyor pieces present on the grid. */
  readonly largePortConveyorCount: number;
  /** True when the grid carries at least one large-port conveyor piece. */
  readonly hasLargePortConveyors: boolean;
  /**
   * True when the design has large-port blocks but NO large-port conveyor line
   * to feed them — the actionable failure the audit exists to catch.
   */
  readonly unfeedable: boolean;
  /**
   * Honest scope note: this checks for the *presence* of large-port conveyor
   * pieces, not that they actually route to each large-port block.
   */
  readonly caveat: string;
}

const CAVEAT =
  'Presence check, not a routed-connectivity solve: a blueprint carries block ' +
  'positions but not the conveyor wiring, so this confirms the grid has large-port ' +
  'conveyor pieces — not that they connect to every large-port block. Verify the run in-game.';

/**
 * Audit a design's conveyor port requirements. See the module doc for the
 * presence-vs-connectivity scope.
 */
export function conveyorAudit(design: ShipDesign): ConveyorAudit {
  const largePortBlocks: LargePortBlock[] = [];
  let largePortBlockCount = 0;
  let largePortConveyorCount = 0;

  for (const b of design.blocks) {
    const reason = largePortReason(b.definition.subtypeId);
    if (reason) {
      largePortBlocks.push({
        subtypeId: b.definition.subtypeId,
        displayName: b.definition.displayName,
        quantity: b.quantity,
        reason,
      });
      largePortBlockCount += b.quantity;
    }
    if (isLargePortConveyor(b.definition.subtypeId)) {
      largePortConveyorCount += b.quantity;
    }
  }

  largePortBlocks.sort((a, b) => b.quantity - a.quantity || a.displayName.localeCompare(b.displayName));

  const hasLargePortConveyors = largePortConveyorCount > 0;

  return {
    largePortBlocks,
    largePortBlockCount,
    largePortConveyorCount,
    hasLargePortConveyors,
    unfeedable: largePortBlocks.length > 0 && !hasLargePortConveyors,
    caveat: CAVEAT,
  };
}

/** True when the design has anything worth auditing (any large-port block). */
export function hasConveyorConcerns(audit: ConveyorAudit): boolean {
  return audit.largePortBlocks.length > 0;
}
