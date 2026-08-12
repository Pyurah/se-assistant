/**
 * Mass and cargo calculations for a ship design.
 *
 * Dry mass is the sum of every block's own mass × quantity, PLUS any always-on
 * extra mass (a docked ship / bolted-on module — `extraMass.added`). Cargo
 * capacity is the sum of every item-holding block's inventory volume (cargo
 * containers, cockpits, drills, connectors, reactors, tools, …) scaled by the
 * world inventory-size multiplier. Loaded mass adds the cargo payload (filled
 * volume × average cargo density) AND any loaded-only extra payload
 * (`extraMass.payload` — a hauled load).
 *
 * These are the inputs to TWR: an empty ship and a fully-loaded ship have
 * different masses and therefore different thrust-to-weight ratios — the whole
 * point of the empty-vs-loaded comparison. Always-on extra mass counts in both
 * states (it's really there); extra payload counts only when loaded.
 */

import type { ShipDesign, DesignBlock } from '../types';
import type { BlockCategory, BlockDefinition, InventoryConstraint } from '../../data/schema';
import { inventoryAccepts, type CargoItem } from '../../data/cargo-items';

/** A block paired with a quantity — the shape design blocks and estimator specs share. */
export interface InventoryBearer {
  readonly definition: BlockDefinition;
  readonly quantity: number;
}

/** Every {@link InventoryConstraint}, for zero-initialized per-pool breakdowns. */
const ALL_CONSTRAINTS: readonly InventoryConstraint[] = [
  'any',
  'ore',
  'uranium',
  'ice',
  'component',
  'ammo',
];

/** World inventory-size multiplier of a design, clamped ≥ 0. Absent ⇒ 1 (Realistic). */
export function inventoryMultiplier(design: ShipDesign): number {
  return Math.max(0, design.inventorySizeMultiplier ?? 1);
}

/**
 * Total item-inventory volume across a block list × the world multiplier, liters.
 * Counts EVERY block carrying an `inventoryVolume` (cargo, cockpit, drill,
 * connector, collector, reactor, tool, …), not just cargo containers — the grand
 * total the game reports. Shared by the design-level {@link cargoCapacity} and the
 * estimator's fixed-block capacity so both agree.
 */
export function sumInventory(blocks: readonly InventoryBearer[], multiplier = 1): number {
  let total = 0;
  for (const b of blocks) {
    const v = b.definition.inventoryVolume;
    if (typeof v === 'number') total += v * b.quantity;
  }
  return total * Math.max(0, multiplier);
}

/**
 * Per-constraint item-inventory volume across a block list × the world multiplier,
 * liters. Every {@link InventoryConstraint} key is present (0 when nothing accepts
 * it). An absent `inventoryConstraint` on a block is treated as `'any'`.
 */
export function inventoryVolumeByConstraint(
  blocks: readonly InventoryBearer[],
  multiplier = 1,
): Record<InventoryConstraint, number> {
  const out = { any: 0, ore: 0, uranium: 0, ice: 0, component: 0, ammo: 0 } as Record<
    InventoryConstraint,
    number
  >;
  const m = Math.max(0, multiplier);
  for (const b of blocks) {
    const v = b.definition.inventoryVolume;
    if (typeof v !== 'number') continue;
    const c = b.definition.inventoryConstraint ?? 'any';
    out[c] += v * b.quantity * m;
  }
  return out;
}

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

/**
 * Total item-inventory capacity across every holding block × the world
 * inventory-size multiplier, liters. Now counts drills, connectors, reactors,
 * tools, etc. — not just cargo containers + cockpits — so a fully-loaded miner
 * fills its drills too. Every downstream consumer (cargo mass, loaded TWR, accel)
 * inherits the completeness for free.
 */
export function cargoCapacity(design: ShipDesign): number {
  return sumInventory(design.blocks, inventoryMultiplier(design));
}

/**
 * Per-constraint inventory capacity for the design (× world multiplier), liters —
 * the split behind the capacity breakdown UI. Constraints with 0 capacity are
 * still present in the record (callers filter for display).
 */
export function inventoryBreakdown(design: ShipDesign): Record<InventoryConstraint, number> {
  return inventoryVolumeByConstraint(design.blocks, inventoryMultiplier(design));
}

/**
 * How many units of `item` the ship can carry — the hauler question. Sums only
 * the inventories that actually accept the item (honoring per-inventory type
 * restrictions via {@link inventoryAccepts}), scales by the world multiplier, and
 * floors by the item's per-unit volume. E.g. Steel Plate counts containers +
 * welders but not drills; Iron Ore counts containers + drills but not reactors.
 * Returns 0 for a zero/negative-volume item.
 */
export function itemCapacity(design: ShipDesign, item: CargoItem): number {
  if (item.volume <= 0) return 0;
  const breakdown = inventoryBreakdown(design);
  let acceptingVolume = 0;
  for (const c of ALL_CONSTRAINTS) {
    if (inventoryAccepts(c, item)) acceptingVolume += breakdown[c];
  }
  return Math.floor(acceptingVolume / item.volume);
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
  /** Item-inventory capacity split by what each pool accepts (× world multiplier), L. */
  readonly inventoryByConstraint: Record<InventoryConstraint, number>;
  /** The world inventory-size multiplier this summary was computed with (≥ 0). */
  readonly inventoryMultiplier: number;
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
    inventoryByConstraint: inventoryBreakdown(design),
    inventoryMultiplier: inventoryMultiplier(design),
  };
}
