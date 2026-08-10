/**
 * Mass and cargo calculations for a ship design.
 *
 * Dry mass is the sum of every block's own mass × quantity, PLUS any always-on
 * extra mass (a docked ship / bolted-on module — `extraMass.added`). Cargo
 * capacity is the sum of inventory volumes (cargo containers + cockpits). Loaded
 * mass adds the cargo payload (filled volume × average cargo density) AND any
 * loaded-only extra payload (`extraMass.payload` — a hauled load).
 *
 * These are the inputs to TWR: an empty ship and a fully-loaded ship have
 * different masses and therefore different thrust-to-weight ratios — the whole
 * point of the empty-vs-loaded comparison. Always-on extra mass counts in both
 * states (it's really there); extra payload counts only when loaded.
 */

import type { ShipDesign, DesignBlock } from '../types';
import type { BlockCategory } from '../../data/schema';

/** Mass contribution of one design block (definition mass × quantity), kg. */
function blockMass(b: DesignBlock): number {
  return b.definition.mass * b.quantity;
}

/** Sum of every block's mass × quantity, kg — blocks only, no extra mass. */
function blocksMass(design: ShipDesign): number {
  return design.blocks.reduce((sum, b) => sum + blockMass(b), 0);
}

/** Always-on extra mass (bolted-on / docked), kg. Clamped ≥ 0; 0 when absent. */
export function addedMass(design: ShipDesign): number {
  return Math.max(0, design.extraMass?.added ?? 0);
}

/** Loaded-only extra payload (hauled load), kg. Clamped ≥ 0; 0 when absent. */
export function extraPayload(design: ShipDesign): number {
  return Math.max(0, design.extraMass?.payload ?? 0);
}

/**
 * Total dry (empty) mass of the design, kg — blocks + always-on extra mass.
 *
 * Always-on extra mass is part of the empty ship (it's physically attached), so
 * it belongs in dry mass; every empty-mass consumer (empty TWR, empty accel)
 * then inherits it for free.
 */
export function dryMass(design: ShipDesign): number {
  return blocksMass(design) + addedMass(design);
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

/**
 * Total loaded mass: dry mass + cargo payload + loaded-only extra payload, kg.
 *
 * Dry mass already includes always-on extra mass, so loaded mass adds only the
 * two loaded-only contributions: the cargo hold and the hauled extra payload.
 */
export function loadedMass(design: ShipDesign): number {
  return dryMass(design) + cargoMass(design) + extraPayload(design);
}

/** A full mass/cargo summary for display. */
export interface MassSummary {
  readonly dryMass: number;
  readonly cargoCapacity: number;
  readonly cargoMass: number;
  readonly loadedMass: number;
  /** Always-on extra mass folded into dry mass (bolted-on / docked), kg. */
  readonly addedMass: number;
  /** Loaded-only extra payload folded into loaded mass (hauled load), kg. */
  readonly extraPayload: number;
  readonly byCategory: Record<BlockCategory, number>;
}

export function massSummary(design: ShipDesign): MassSummary {
  return {
    dryMass: dryMass(design),
    cargoCapacity: cargoCapacity(design),
    cargoMass: cargoMass(design),
    loadedMass: loadedMass(design),
    addedMass: addedMass(design),
    extraPayload: extraPayload(design),
    byCategory: massByCategory(design),
  };
}
