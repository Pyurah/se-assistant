/**
 * Core domain types for a ship/base design under analysis.
 *
 * A "design" is the user-facing unit: a set of blocks (with quantities), a
 * chosen planet, and a cargo loadout. The calc engine consumes a design and
 * produces analyses (TWR, mass, power). These types are shared by the engine
 * and the UI; keeping them in `src/core` preserves the platform-agnostic
 * boundary.
 */

import type { BlockDefinition, GridSize, Direction } from '../data/schema';

/** An integer grid-cell coordinate (the blueprint's `<Min>` x/y/z). */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * A block placed in a design, resolved to its definition plus a count and the
 * six-axis orientation info the TWR engine needs. For non-thruster blocks the
 * thrust direction is irrelevant and omitted.
 */
export interface DesignBlock {
  /** Resolved block definition (vanilla, blueprint, or user-entered). */
  readonly definition: BlockDefinition;
  /** How many of this block are present. */
  readonly quantity: number;
  /**
   * For thrusters: which local axis this thruster pushes the grid toward.
   * A thruster mounted to fire "down" provides "up" thrust, etc. The blueprint
   * parser is responsible for resolving orientation to a thrust direction.
   */
  readonly thrustDirection?: Direction;
  /**
   * Grid-cell positions of each instance (length === quantity when known).
   * Preserved by the blueprint parser from each block's `<Min>` so the engine
   * can compute center-of-mass and thrust-center alignment. Absent for designs
   * built without geometry (the estimator), where those analyses are skipped.
   */
  readonly positions?: readonly Vec3[];
}

/**
 * Cargo loadout expressed as a fill fraction (0..1) of total inventory volume,
 * plus an average cargo density used to convert filled volume to added mass.
 * This drives the empty-vs-loaded TWR comparison.
 */
export interface CargoLoadout {
  /** Fraction of total inventory volume that is filled, 0..1. */
  readonly fillFraction: number;
  /** Average density of stored cargo, kg per liter. */
  readonly densityKgPerL: number;
}

export interface ShipDesign {
  readonly id: string;
  readonly name: string;
  /** The grid size this design is built on (large or small). */
  readonly gridSize: GridSize;
  readonly blocks: readonly DesignBlock[];
  /** Planet preset id the analysis is evaluated against. */
  readonly planetId: string;
  readonly cargo: CargoLoadout;
}
