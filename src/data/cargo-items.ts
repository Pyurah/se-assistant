/**
 * Cargo item dataset — mass and volume for the game items players actually haul
 * in bulk: refined ingots, raw ores, and construction components.
 *
 * Why mass AND volume (not just density): in-game, every item shows a mass (kg)
 * and a volume (L) — e.g. a steel plate is 20 kg / 3 L. Cargo capacity is a
 * volume (the container's liters), and the *mass* a full hold adds is
 * `capacity_L × fillFraction × density`, where `density = mass / volume`. The
 * cargo UI lets the user pick an item (or type a mass + volume) and derives the
 * density the engine needs from these two figures — so the user never has to do
 * the kg/L division by hand.
 *
 * Source: the installed game's own item definitions —
 * `SpaceEngineers/Content/Data/Components.sbc` (`<Component>`: `<Mass>`,
 * `<Volume>`) and `PhysicalItems.sbc` (`<PhysicalItem>` for ores/ingots), on
 * SE v1.210.012 b0. This is a stronger primary source than the wiki. Every
 * `mass` / `volume` below is copied verbatim; `density` is derived. See
 * `docs/data-audit.md` → "Cargo item mass/volume (v0.10.0)".
 *
 * PURE DATA — no React, no DOM. Safe to import from the engine.
 */

/** Which item group a cargo item belongs to (drives UI grouping). */
export type CargoItemCategory = 'ingot' | 'ore' | 'component';

/** A single haulable item with its exact per-unit mass and volume. */
export interface CargoItem {
  /** Stable machine id, e.g. `ingot-gold`. */
  readonly id: string;
  /** Human-facing name, e.g. "Gold Ingot". */
  readonly displayName: string;
  readonly category: CargoItemCategory;
  /** The game's item SubtypeId (with its TypeId group), for reference. */
  readonly subtypeId: string;
  /** Mass of one unit, kilograms. */
  readonly mass: number;
  /** Volume of one unit, liters. */
  readonly volume: number;
}

/** Effective cargo density of an item, kg per liter (`mass / volume`). */
export function itemDensity(item: CargoItem): number {
  return item.mass / item.volume;
}

/**
 * The catalogue. Ingots first (the dense payloads that most often overload a
 * ship), then ores, then components. Values verbatim from the game files;
 * densities are shown in comments for auditability.
 */
export const CARGO_ITEMS: readonly CargoItem[] = [
  // ── Ingots (refined metal) ────────────────────────────────────────────────
  // All ingots are 1 kg/unit; volume varies, so density varies widely.
  { id: 'ingot-iron', displayName: 'Iron Ingot', category: 'ingot', subtypeId: 'Ingot/Iron', mass: 1, volume: 0.127 }, // 7.874
  { id: 'ingot-nickel', displayName: 'Nickel Ingot', category: 'ingot', subtypeId: 'Ingot/Nickel', mass: 1, volume: 0.112 }, // 8.929
  { id: 'ingot-cobalt', displayName: 'Cobalt Ingot', category: 'ingot', subtypeId: 'Ingot/Cobalt', mass: 1, volume: 0.112 }, // 8.929
  { id: 'ingot-silicon', displayName: 'Silicon Wafer', category: 'ingot', subtypeId: 'Ingot/Silicon', mass: 1, volume: 0.429 }, // 2.331
  { id: 'ingot-magnesium', displayName: 'Magnesium Powder', category: 'ingot', subtypeId: 'Ingot/Magnesium', mass: 1, volume: 0.575 }, // 1.739
  { id: 'ingot-silver', displayName: 'Silver Ingot', category: 'ingot', subtypeId: 'Ingot/Silver', mass: 1, volume: 0.095 }, // 10.526
  { id: 'ingot-gold', displayName: 'Gold Ingot', category: 'ingot', subtypeId: 'Ingot/Gold', mass: 1, volume: 0.052 }, // 19.231
  { id: 'ingot-platinum', displayName: 'Platinum Ingot', category: 'ingot', subtypeId: 'Ingot/Platinum', mass: 1, volume: 0.047 }, // 21.277
  { id: 'ingot-uranium', displayName: 'Uranium Ingot', category: 'ingot', subtypeId: 'Ingot/Uranium', mass: 1, volume: 0.052 }, // 19.231
  { id: 'ingot-stone', displayName: 'Gravel', category: 'ingot', subtypeId: 'Ingot/Stone', mass: 1, volume: 0.37 }, // 2.703

  // ── Ores (raw, unrefined) ─────────────────────────────────────────────────
  // Every ore is 1 kg / 0.37 L → 2.703 kg/L uniformly (Scrap is the exception).
  { id: 'ore-iron', displayName: 'Iron Ore', category: 'ore', subtypeId: 'Ore/Iron', mass: 1, volume: 0.37 },
  { id: 'ore-nickel', displayName: 'Nickel Ore', category: 'ore', subtypeId: 'Ore/Nickel', mass: 1, volume: 0.37 },
  { id: 'ore-cobalt', displayName: 'Cobalt Ore', category: 'ore', subtypeId: 'Ore/Cobalt', mass: 1, volume: 0.37 },
  { id: 'ore-silicon', displayName: 'Silicon Ore', category: 'ore', subtypeId: 'Ore/Silicon', mass: 1, volume: 0.37 },
  { id: 'ore-magnesium', displayName: 'Magnesium Ore', category: 'ore', subtypeId: 'Ore/Magnesium', mass: 1, volume: 0.37 },
  { id: 'ore-silver', displayName: 'Silver Ore', category: 'ore', subtypeId: 'Ore/Silver', mass: 1, volume: 0.37 },
  { id: 'ore-gold', displayName: 'Gold Ore', category: 'ore', subtypeId: 'Ore/Gold', mass: 1, volume: 0.37 },
  { id: 'ore-platinum', displayName: 'Platinum Ore', category: 'ore', subtypeId: 'Ore/Platinum', mass: 1, volume: 0.37 },
  { id: 'ore-uranium', displayName: 'Uranium Ore', category: 'ore', subtypeId: 'Ore/Uranium', mass: 1, volume: 0.37 },
  { id: 'ore-stone', displayName: 'Stone', category: 'ore', subtypeId: 'Ore/Stone', mass: 1, volume: 0.37 },
  { id: 'ore-ice', displayName: 'Ice', category: 'ore', subtypeId: 'Ore/Ice', mass: 1, volume: 0.37 },
  { id: 'ore-scrap', displayName: 'Scrap Metal', category: 'ore', subtypeId: 'Ore/Scrap', mass: 1, volume: 0.254 }, // 3.937

  // ── Components (built parts) ──────────────────────────────────────────────
  { id: 'comp-steel-plate', displayName: 'Steel Plate', category: 'component', subtypeId: 'Component/SteelPlate', mass: 20, volume: 3 }, // 6.667
  { id: 'comp-construction', displayName: 'Construction Comp.', category: 'component', subtypeId: 'Component/Construction', mass: 8, volume: 2 }, // 4.0
  { id: 'comp-interior-plate', displayName: 'Interior Plate', category: 'component', subtypeId: 'Component/InteriorPlate', mass: 3, volume: 5 }, // 0.6
  { id: 'comp-metal-grid', displayName: 'Metal Grid', category: 'component', subtypeId: 'Component/MetalGrid', mass: 6, volume: 15 }, // 0.4
  { id: 'comp-girder', displayName: 'Girder', category: 'component', subtypeId: 'Component/Girder', mass: 6, volume: 2 }, // 3.0
  { id: 'comp-small-tube', displayName: 'Small Steel Tube', category: 'component', subtypeId: 'Component/SmallTube', mass: 4, volume: 2 }, // 2.0
  { id: 'comp-large-tube', displayName: 'Large Steel Tube', category: 'component', subtypeId: 'Component/LargeTube', mass: 25, volume: 38 }, // 0.658
  { id: 'comp-motor', displayName: 'Motor', category: 'component', subtypeId: 'Component/Motor', mass: 24, volume: 8 }, // 3.0
  { id: 'comp-display', displayName: 'Display', category: 'component', subtypeId: 'Component/Display', mass: 8, volume: 6 }, // 1.333
  { id: 'comp-bulletproof-glass', displayName: 'Bulletproof Glass', category: 'component', subtypeId: 'Component/BulletproofGlass', mass: 15, volume: 8 }, // 1.875
  { id: 'comp-computer', displayName: 'Computer', category: 'component', subtypeId: 'Component/Computer', mass: 0.2, volume: 1 }, // 0.2
  { id: 'comp-reactor', displayName: 'Reactor Comp.', category: 'component', subtypeId: 'Component/Reactor', mass: 25, volume: 8 }, // 3.125
  { id: 'comp-thrust', displayName: 'Thruster Comp.', category: 'component', subtypeId: 'Component/Thrust', mass: 40, volume: 10 }, // 4.0
  { id: 'comp-gravity-generator', displayName: 'Gravity Gen. Comp.', category: 'component', subtypeId: 'Component/GravityGenerator', mass: 800, volume: 200 }, // 4.0
  { id: 'comp-medical', displayName: 'Medical Comp.', category: 'component', subtypeId: 'Component/Medical', mass: 150, volume: 160 }, // 0.938
  { id: 'comp-radio', displayName: 'Radio-comm Comp.', category: 'component', subtypeId: 'Component/RadioCommunication', mass: 8, volume: 70 }, // 0.114
  { id: 'comp-detector', displayName: 'Detector Comp.', category: 'component', subtypeId: 'Component/Detector', mass: 5, volume: 6 }, // 0.833
  { id: 'comp-explosives', displayName: 'Explosives', category: 'component', subtypeId: 'Component/Explosives', mass: 2, volume: 2 }, // 1.0
  { id: 'comp-solar-cell', displayName: 'Solar Cell', category: 'component', subtypeId: 'Component/SolarCell', mass: 6, volume: 12 }, // 0.5
  { id: 'comp-power-cell', displayName: 'Power Cell', category: 'component', subtypeId: 'Component/PowerCell', mass: 25, volume: 40 }, // 0.625
  { id: 'comp-superconductor', displayName: 'Superconductor', category: 'component', subtypeId: 'Component/Superconductor', mass: 15, volume: 8 }, // 1.875
  { id: 'comp-canvas', displayName: 'Canvas', category: 'component', subtypeId: 'Component/Canvas', mass: 15, volume: 8 }, // 1.875
];

/** Lookup by id for the cargo picker. */
export const CARGO_ITEMS_BY_ID: Readonly<Record<string, CargoItem>> = Object.fromEntries(
  CARGO_ITEMS.map((item) => [item.id, item]),
);
