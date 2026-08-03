/**
 * Mass and cargo calculations for a ship design.
 *
 * Dry mass is the sum of every block's own mass × quantity. Cargo capacity is
 * the sum of inventory volumes (cargo containers + cockpits). Loaded mass adds
 * the cargo payload: filled volume × average cargo density.
 *
 * These are the inputs to TWR: an empty ship and a fully-loaded ship have
 * different masses and therefore different thrust-to-weight ratios — the whole
 * point of the empty-vs-loaded comparison.
 */

import type { ShipDesign, DesignBlock } from '../types';
import type { BlockCategory } from '../../data/schema';

/** Mass contribution of one design block (definition mass × quantity), kg. */
function blockMass(b: DesignBlock): number {
  return b.definition.mass * b.quantity;
}

/** Total dry (empty) mass of the design, kg. */
export function dryMass(design: ShipDesign): number {
  return design.blocks.reduce((sum, b) => sum + blockMass(b), 0);
}

/** Dry mass broken down by block category, kg. Categories with 0 are omitted. */
export function massByCategory(design: ShipDesign): Record<BlockCategory, number> {
  const out = {} as Record<BlockCategory, number>;
  for (const b of design.blocks) {
    const cat = b.definition.category;
    out[cat] = (out[cat] ?? 0) + blockMass(b);
  }
  return out;
}

/** Total inventory capacity across cargo containers and cockpits, liters. */
export function cargoCapacity(design: ShipDesign): number {
  let total = 0;
  for (const b of design.blocks) {
    const def = b.definition;
    if (def.category === 'cargo' || def.category === 'cockpit') {
      total += def.inventoryVolume * b.quantity;
    }
  }
  return total;
}

/**
 * Mass of the cargo payload, kg — filled volume × average density.
 *
 * `fillFraction` (0..1) of total capacity is filled; `densityKgPerL` converts
 * that filled volume to mass. Fill fraction is clamped to [0, 1].
 */
export function cargoMass(design: ShipDesign): number {
  const capacity = cargoCapacity(design);
  const fill = Math.min(1, Math.max(0, design.cargo.fillFraction));
  return capacity * fill * design.cargo.densityKgPerL;
}

/** Total loaded mass: dry mass + cargo payload, kg. */
export function loadedMass(design: ShipDesign): number {
  return dryMass(design) + cargoMass(design);
}

/** A full mass/cargo summary for display. */
export interface MassSummary {
  readonly dryMass: number;
  readonly cargoCapacity: number;
  readonly cargoMass: number;
  readonly loadedMass: number;
  readonly byCategory: Record<BlockCategory, number>;
}

export function massSummary(design: ShipDesign): MassSummary {
  return {
    dryMass: dryMass(design),
    cargoCapacity: cargoCapacity(design),
    cargoMass: cargoMass(design),
    loadedMass: loadedMass(design),
    byCategory: massByCategory(design),
  };
}
