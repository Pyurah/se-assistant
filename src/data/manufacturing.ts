/**
 * Manufacturing dataset — refining recipes, component recipes, and per-block
 * component build costs for Space Engineers v1.210.012 b0.
 *
 * This is the data behind the "what does it cost to build this ship?" analysis:
 * a block is built from components, components are assembled from ingots, and
 * ingots are refined from raw ore. Three linked recipe tables model that chain:
 *
 *   BLOCK_COMPONENT_COSTS  block subtypeId → { component: count }
 *   COMPONENT_RECIPES      component       → { ingots(kg), assemble time }
 *   REFINE_RECIPES         ore/metal       → { yield ratio, refine time }
 *
 * The refinery/assembler *multiplier* model (confirmed against the game):
 *   effective ingot yield = baseYield × refinery MaterialEfficiency
 *   effective refine time = oreKg × baseTime ÷ refinery RefineSpeed
 *   effective ingot cost  = recipe ingots ÷ Assembler-Efficiency world setting
 *   effective assemble t. = baseTime ÷ assembler AssemblySpeed
 *
 * Sources & confidence: recipe ratios and per-block component lists are from
 * Keen's archived `Blueprints.sbc` / `CubeBlocks.sbc`, verified to match the
 * current wiki (`spaceengineers.wiki.gg`) — the refining/assembly recipes were
 * NOT rebalanced the way thrust force was. Values that diverge or could not be
 * fully confirmed are called out in `docs/data-audit.md` → "Manufacturing data
 * (M7 / v0.14.0)" and noted inline below. Where archive and current game
 * disagree, the current-game value wins (Uranium ratio, Solar Cell recipe,
 * Basic Refinery multipliers).
 *
 * PURE DATA — no React, no DOM. Safe to import from the engine.
 */

/**
 * A metal / ore family, the key linking ore → ingot → component.
 *
 * Every member except `prototech-scrap` is a *refinable* metal with a
 * `REFINE_RECIPES` entry (ore → ingot). `prototech-scrap` is a **salvage-only
 * pseudo-ingot**: it is ground from endgame Prototech blocks, never mined or
 * refined, so it has NO refine recipe and contributes ZERO ore to a build cost.
 * The type stays in the `Metal` union so it can flow through the ingot layer
 * (and show on its own "salvaged, not mined" line), but the deliberately
 * `Partial` `REFINE_RECIPES` map is what enforces "no ore for scrap".
 */
export type Metal =
  | 'iron'
  | 'nickel'
  | 'cobalt'
  | 'silicon'
  | 'magnesium'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'uranium'
  | 'stone'
  | 'prototech-scrap';

/** Human-facing metal names (ingot form) for UI display. */
export const METAL_LABELS: Readonly<Record<Metal, string>> = {
  iron: 'Iron',
  nickel: 'Nickel',
  cobalt: 'Cobalt',
  silicon: 'Silicon',
  magnesium: 'Magnesium',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  uranium: 'Uranium',
  stone: 'Stone',
  'prototech-scrap': 'Prototech Scrap',
};

/**
 * Ore → ingot refining recipe at 1× refinery speed / 1× efficiency.
 *
 * `yieldRatio` is ingot kg per ore kg (before the refinery's MaterialEfficiency
 * multiplier); `baseTimeSeconds` is the time to process ONE kg of ore (before
 * the refinery's RefineSpeed multiplier).
 */
export interface RefineRecipe {
  readonly metal: Metal;
  /** Ingot kg produced per ore kg, at base efficiency. */
  readonly yieldRatio: number;
  /** Seconds to refine one kg of ore, at base (1×) speed. */
  readonly baseTimeSeconds: number;
}

/**
 * Base refining recipes. All confirmed against archive + current wiki EXCEPT:
 * - `uranium` — archive 0.007, current wiki 0.01 (1%). Flagged; we use the
 *   archive 0.7% as the conservative documented value. Uranium is fuel, not a
 *   component input, so this does not affect build-cost ore totals.
 * - `stone` — really a multi-output recipe (Gravel + trace Fe/Ni/Si). We model
 *   only the Gravel path (the one a build cost consumes, via Reactor
 *   components) at the archived ~0.9 primary result. Trace metals unmodeled.
 *
 * The map is deliberately `Partial`: `prototech-scrap` is salvage-only and has
 * NO refine recipe. Under `noUncheckedIndexedAccess`, `REFINE_RECIPES[metal]`
 * is therefore `RefineRecipe | undefined`, forcing the build-cost engine to
 * skip un-refinable (salvage) ingots when it totals ore — the type system, not
 * a runtime convention, guarantees scrap never fabricates mineable ore.
 */
export const REFINE_RECIPES: Readonly<Partial<Record<Metal, RefineRecipe>>> = {
  iron: { metal: 'iron', yieldRatio: 0.7, baseTimeSeconds: 0.05 },
  nickel: { metal: 'nickel', yieldRatio: 0.4, baseTimeSeconds: 2 },
  cobalt: { metal: 'cobalt', yieldRatio: 0.3, baseTimeSeconds: 4 },
  silicon: { metal: 'silicon', yieldRatio: 0.7, baseTimeSeconds: 0.6 },
  magnesium: { metal: 'magnesium', yieldRatio: 0.007, baseTimeSeconds: 1 },
  silver: { metal: 'silver', yieldRatio: 0.1, baseTimeSeconds: 1 },
  gold: { metal: 'gold', yieldRatio: 0.01, baseTimeSeconds: 0.4 },
  platinum: { metal: 'platinum', yieldRatio: 0.005, baseTimeSeconds: 4 },
  uranium: { metal: 'uranium', yieldRatio: 0.007, baseTimeSeconds: 4 }, // flagged
  stone: { metal: 'stone', yieldRatio: 0.9, baseTimeSeconds: 0.1 }, // Gravel path only
};

/** Stable component ids (kebab-case of the game's component SubtypeId). */
export type ComponentId =
  | 'steel-plate'
  | 'construction'
  | 'interior-plate'
  | 'girder'
  | 'metal-grid'
  | 'small-tube'
  | 'large-tube'
  | 'motor'
  | 'display'
  | 'bulletproof-glass'
  | 'computer'
  | 'reactor'
  | 'thrust'
  | 'gravity-generator'
  | 'medical'
  | 'radio-communication'
  | 'detector'
  | 'solar-cell'
  | 'power-cell'
  | 'superconductor'
  | 'explosives'
  | 'canvas'
  // ── Prototech (Automatons / endgame) ─────────────────────────────────────
  | 'prototech-frame'
  | 'prototech-panel'
  | 'prototech-capacitor'
  | 'prototech-propulsion-unit'
  | 'prototech-machinery'
  | 'prototech-circuitry'
  | 'prototech-cooling-unit'
  // ── Economy / novelty (non-craftable) ────────────────────────────────────
  | 'zone-chip'
  | 'engineer-plushie'
  | 'engineer-plushie-se2'
  | 'sabiroid-plushie';

/** A component's assembly recipe: ingot cost (kg) and base assemble time. */
export interface ComponentRecipe {
  readonly id: ComponentId;
  readonly displayName: string;
  /** The game's component SubtypeId. */
  readonly subtypeId: string;
  /** Ingot cost in kg, by metal, at 1× Assembler-Efficiency. */
  readonly ingots: Partial<Record<Metal, number>>;
  /** Seconds to assemble one unit at 1× assembler speed. */
  readonly baseTimeSeconds: number;
}

/**
 * Component → ingot recipes. Ratios confirmed against archive + current wiki
 * EXCEPT `solar-cell` (current wiki 4 Ni / 6 Si supersedes the archived 10/8 —
 * solar was reworked) and `superconductor` (current game may add 3 Co —
 * flagged, omitted). Assembly base times for `metal-grid` / `reactor` /
 * `solar-cell` are archive placeholders and flagged as `likely`; refine time
 * is the headline metric, assembly time is secondary.
 */
export const COMPONENT_RECIPES: Readonly<Record<ComponentId, ComponentRecipe>> = {
  'steel-plate': { id: 'steel-plate', displayName: 'Steel Plate', subtypeId: 'SteelPlate', ingots: { iron: 21 }, baseTimeSeconds: 1 },
  construction: { id: 'construction', displayName: 'Construction Comp.', subtypeId: 'Construction', ingots: { iron: 10 }, baseTimeSeconds: 4 },
  'interior-plate': { id: 'interior-plate', displayName: 'Interior Plate', subtypeId: 'InteriorPlate', ingots: { iron: 3.5 }, baseTimeSeconds: 1 },
  girder: { id: 'girder', displayName: 'Girder', subtypeId: 'Girder', ingots: { iron: 7 }, baseTimeSeconds: 1 },
  'metal-grid': { id: 'metal-grid', displayName: 'Metal Grid', subtypeId: 'MetalGrid', ingots: { iron: 12, nickel: 5, cobalt: 3 }, baseTimeSeconds: 2 },
  'small-tube': { id: 'small-tube', displayName: 'Small Tube', subtypeId: 'SmallTube', ingots: { iron: 5 }, baseTimeSeconds: 1 },
  'large-tube': { id: 'large-tube', displayName: 'Large Tube', subtypeId: 'LargeTube', ingots: { iron: 30 }, baseTimeSeconds: 1 },
  motor: { id: 'motor', displayName: 'Motor', subtypeId: 'Motor', ingots: { iron: 20, nickel: 5 }, baseTimeSeconds: 1 },
  display: { id: 'display', displayName: 'Display', subtypeId: 'Display', ingots: { iron: 1, silicon: 5 }, baseTimeSeconds: 1 },
  'bulletproof-glass': { id: 'bulletproof-glass', displayName: 'Bulletproof Glass', subtypeId: 'BulletproofGlass', ingots: { silicon: 15 }, baseTimeSeconds: 1 },
  computer: { id: 'computer', displayName: 'Computer', subtypeId: 'Computer', ingots: { iron: 0.5, silicon: 0.2 }, baseTimeSeconds: 1 },
  reactor: { id: 'reactor', displayName: 'Reactor Comp.', subtypeId: 'Reactor', ingots: { iron: 15, stone: 20, silver: 5 }, baseTimeSeconds: 1 },
  thrust: { id: 'thrust', displayName: 'Thruster Comp.', subtypeId: 'Thrust', ingots: { iron: 30, cobalt: 10, gold: 1, platinum: 0.4 }, baseTimeSeconds: 1 },
  'gravity-generator': { id: 'gravity-generator', displayName: 'Gravity Gen. Comp.', subtypeId: 'GravityGenerator', ingots: { iron: 600, cobalt: 220, silver: 5, gold: 10 }, baseTimeSeconds: 1 },
  medical: { id: 'medical', displayName: 'Medical Comp.', subtypeId: 'Medical', ingots: { iron: 60, nickel: 70, silver: 20 }, baseTimeSeconds: 1 },
  'radio-communication': { id: 'radio-communication', displayName: 'Radio-comm Comp.', subtypeId: 'RadioCommunication', ingots: { iron: 8, silicon: 1 }, baseTimeSeconds: 1 },
  detector: { id: 'detector', displayName: 'Detector Comp.', subtypeId: 'Detector', ingots: { iron: 5, nickel: 15 }, baseTimeSeconds: 1 },
  'solar-cell': { id: 'solar-cell', displayName: 'Solar Cell', subtypeId: 'SolarCell', ingots: { nickel: 4, silicon: 6 }, baseTimeSeconds: 10 }, // current wiki
  'power-cell': { id: 'power-cell', displayName: 'Power Cell', subtypeId: 'PowerCell', ingots: { iron: 10, silicon: 1, nickel: 2 }, baseTimeSeconds: 4 },
  superconductor: { id: 'superconductor', displayName: 'Superconductor', subtypeId: 'Superconductor', ingots: { iron: 10, gold: 2 }, baseTimeSeconds: 8 },
  explosives: { id: 'explosives', displayName: 'Explosives', subtypeId: 'Explosives', ingots: { silicon: 0.5, magnesium: 2 }, baseTimeSeconds: 10 },
  canvas: { id: 'canvas', displayName: 'Canvas', subtypeId: 'Canvas', ingots: { iron: 2, silicon: 35 }, baseTimeSeconds: 4 },

  // ── Prototech (Automatons pack) ──────────────────────────────────────────
  // Recipes from Content/Data/Blueprints.sbc (v1.210.012 b0); see docs/data-audit.md.
  // PrototechPanel is fully craftable from mined ingots. The other five mix mined
  // ingots with PrototechScrap — a salvage-only pseudo-ingot (no ore, see Metal).
  'prototech-frame': { id: 'prototech-frame', displayName: 'Prototech Frame', subtypeId: 'PrototechFrame', ingots: {}, baseTimeSeconds: 1 }, // salvage-only (prereq is itself)
  'prototech-panel': { id: 'prototech-panel', displayName: 'Prototech Panel', subtypeId: 'PrototechPanel', ingots: { iron: 35, nickel: 7, cobalt: 3, magnesium: 4 }, baseTimeSeconds: 4 },
  'prototech-capacitor': { id: 'prototech-capacitor', displayName: 'Prototech Capacitor', subtypeId: 'PrototechCapacitor', ingots: { iron: 12, silicon: 4, silver: 3, gold: 6, 'prototech-scrap': 1.5 }, baseTimeSeconds: 16 },
  'prototech-propulsion-unit': { id: 'prototech-propulsion-unit', displayName: 'Prototech Propulsion Unit', subtypeId: 'PrototechPropulsionUnit', ingots: { iron: 60, cobalt: 24, gold: 6, platinum: 3, 'prototech-scrap': 1.25 }, baseTimeSeconds: 14 },
  'prototech-machinery': { id: 'prototech-machinery', displayName: 'Prototech Machinery', subtypeId: 'PrototechMachinery', ingots: { iron: 45, nickel: 12, silicon: 7, gold: 3, 'prototech-scrap': 1.15 }, baseTimeSeconds: 12 },
  'prototech-circuitry': { id: 'prototech-circuitry', displayName: 'Prototech Circuitry', subtypeId: 'PrototechCircuitry', ingots: { iron: 5, silicon: 8, gold: 2, platinum: 1.5, 'prototech-scrap': 1.75 }, baseTimeSeconds: 11 },
  'prototech-cooling-unit': { id: 'prototech-cooling-unit', displayName: 'Prototech Cooling Unit', subtypeId: 'PrototechCoolingUnit', ingots: { iron: 80, gold: 12, platinum: 3.25, 'prototech-scrap': 2.5 }, baseTimeSeconds: 9 },

  // ── Economy / novelty (non-craftable: no mineable input) ─────────────────
  'zone-chip': { id: 'zone-chip', displayName: 'Zone Chip', subtypeId: 'ZoneChip', ingots: {}, baseTimeSeconds: 1 }, // economy item (safe-zone), not assembled
  'engineer-plushie': { id: 'engineer-plushie', displayName: 'Engineer Plushie', subtypeId: 'EngineerPlushie', ingots: {}, baseTimeSeconds: 1 }, // novelty, no ingot cost
  'engineer-plushie-se2': { id: 'engineer-plushie-se2', displayName: 'Engineer Plushie (SE2)', subtypeId: 'EngineerPlushieSE2', ingots: {}, baseTimeSeconds: 1 }, // novelty, no ingot cost
  'sabiroid-plushie': { id: 'sabiroid-plushie', displayName: 'Sabiroid Plushie', subtypeId: 'SabiroidPlushie', ingots: {}, baseTimeSeconds: 1 }, // novelty, no ingot cost
};

/** A block's component build cost: how many of each component it takes. */
export type BlockComponentCost = Partial<Record<ComponentId, number>>;

/**
 * Per-block component costs, keyed by the game's block SubtypeId (matching the
 * dataset's `subtypeId` field so the engine can look up a design block's cost).
 * All [ARCHIVE]-sourced rows are exact `<Components>` sums (duplicate finishing
 * components folded in); hydrogen-engine / wind-turbine / survival-kit rows are
 * current-wiki (`likely`). Blocks absent here (lights, sensors, beacons,
 * antennas, conveyors, landing gear, logic/control) have no recipe in the
 * dataset yet — the engine surfaces them as "cost unknown", never zeroed.
 */
export const BLOCK_COMPONENT_COSTS: Readonly<Record<string, BlockComponentCost>> = {
  // ── Production ────────────────────────────────────────────────────────────
  LargeRefinery: { 'steel-plate': 1200, construction: 40, 'large-tube': 20, motor: 16, computer: 20 },
  LargeAssembler: { 'steel-plate': 150, construction: 40, motor: 8, display: 4, computer: 80 },

  // ── Cargo containers ────────────────────────────────────────────────────
  LargeBlockSmallContainer: { 'interior-plate': 40, construction: 40, 'metal-grid': 4, 'small-tube': 20, motor: 4, display: 1, computer: 2 },
  LargeBlockLargeContainer: { 'interior-plate': 360, construction: 80, 'metal-grid': 24, 'small-tube': 60, motor: 20, display: 1, computer: 8 },
  SmallBlockSmallContainer: { 'interior-plate': 3, construction: 1, computer: 1, motor: 1, display: 1 },
  SmallBlockMediumContainer: { 'interior-plate': 30, construction: 10, computer: 4, motor: 4, display: 1 },
  SmallBlockLargeContainer: { 'interior-plate': 75, construction: 25, computer: 6, motor: 8, display: 1 },

  // ── Ion thrusters ─────────────────────────────────────────────────────────
  LargeBlockLargeThrust: { 'steel-plate': 150, construction: 100, 'large-tube': 40, thrust: 960 },
  LargeBlockSmallThrust: { 'steel-plate': 25, construction: 60, 'large-tube': 8, thrust: 80 },
  SmallBlockLargeThrust: { 'steel-plate': 5, construction: 2, 'large-tube': 5, thrust: 12 },
  SmallBlockSmallThrust: { 'steel-plate': 2, 'large-tube': 1, thrust: 1, construction: 1 },

  // ── Atmospheric thrusters ─────────────────────────────────────────────────
  LargeBlockLargeAtmosphericThrust: { 'steel-plate': 230, construction: 60, 'large-tube': 50, 'metal-grid': 40, motor: 1136 },
  LargeBlockSmallAtmosphericThrust: { 'steel-plate': 35, construction: 50, 'large-tube': 8, 'metal-grid': 10, motor: 113 },
  SmallBlockLargeAtmosphericThrust: { 'steel-plate': 20, construction: 30, 'large-tube': 4, 'metal-grid': 8, motor: 144 },
  SmallBlockSmallAtmosphericThrust: { 'steel-plate': 3, 'large-tube': 1, 'metal-grid': 1, motor: 18, construction: 2 },

  // ── Hydrogen thrusters ────────────────────────────────────────────────────
  LargeBlockLargeHydrogenThrust: { 'steel-plate': 150, construction: 180, 'metal-grid': 250, 'large-tube': 40 },
  LargeBlockSmallHydrogenThrust: { 'steel-plate': 25, construction: 60, 'metal-grid': 40, 'large-tube': 8 },
  SmallBlockLargeHydrogenThrust: { 'steel-plate': 30, construction: 30, 'metal-grid': 22, 'large-tube': 10 },
  SmallBlockSmallHydrogenThrust: { 'steel-plate': 7, construction: 15, 'metal-grid': 4, 'large-tube': 2 },

  // ── Power ─────────────────────────────────────────────────────────────────
  LargeBlockLargeGenerator: { 'steel-plate': 1000, construction: 70, 'metal-grid': 40, 'large-tube': 40, superconductor: 100, reactor: 2000, motor: 20, computer: 75 },
  LargeBlockSmallGenerator: { 'steel-plate': 80, construction: 40, 'metal-grid': 4, 'large-tube': 8, reactor: 100, motor: 6, computer: 25 },
  SmallBlockLargeGenerator: { 'steel-plate': 60, construction: 9, 'metal-grid': 9, 'large-tube': 3, reactor: 95, motor: 5, computer: 25 },
  SmallBlockSmallGenerator: { 'steel-plate': 3, construction: 10, 'metal-grid': 2, 'large-tube': 1, reactor: 3, motor: 1, computer: 10 },
  LargeBlockBatteryBlock: { 'steel-plate': 80, construction: 30, 'power-cell': 120, computer: 25 },
  SmallBlockBatteryBlock: { 'steel-plate': 25, construction: 5, 'power-cell': 20, computer: 2 },
  LargeBlockSolarPanel: { 'steel-plate': 4, construction: 10, 'large-tube': 1, computer: 2, 'solar-cell': 64 },
  SmallBlockSolarPanel: { 'steel-plate': 2, construction: 2, girder: 4, computer: 1, 'solar-cell': 16, 'bulletproof-glass': 1 },
  // Hydrogen engine / wind turbine — current wiki (likely).
  LargeBlockHydrogenEngine: { 'steel-plate': 100, 'small-tube': 20, 'power-cell': 1, motor: 12, 'large-tube': 12, construction: 70, computer: 4 },
  SmallBlockHydrogenEngine: { 'steel-plate': 30, 'small-tube': 6, 'power-cell': 1, motor: 4, 'large-tube': 4, construction: 20, computer: 1 },
  LargeBlockWindTurbine: { 'interior-plate': 20, girder: 24, construction: 20, motor: 8, computer: 2 },

  // ── Cockpits ──────────────────────────────────────────────────────────────
  LargeBlockCockpit: { 'interior-plate': 20, construction: 20, motor: 2, computer: 100, display: 10, 'bulletproof-glass': 10 },
  SmallBlockCockpit: { 'steel-plate': 10, construction: 10, motor: 1, display: 5, computer: 15, 'bulletproof-glass': 30 },

  // ── Gyroscopes ────────────────────────────────────────────────────────────
  LargeBlockGyro: { 'steel-plate': 600, construction: 40, 'large-tube': 4, 'metal-grid': 50, motor: 4, computer: 5 },
  SmallBlockGyro: { 'steel-plate': 25, construction: 5, 'large-tube': 1, motor: 2, computer: 3 },

  // ── Tools ─────────────────────────────────────────────────────────────────
  LargeBlockDrill: { 'steel-plate': 300, construction: 40, 'small-tube': 24, 'large-tube': 12, motor: 5, computer: 5 },
  SmallBlockDrill: { 'steel-plate': 32, construction: 30, 'large-tube': 4, motor: 1, computer: 1 },
  LargeShipWelder: { 'steel-plate': 20, construction: 30, 'large-tube': 1, motor: 2, computer: 2 },
  SmallShipWelder: { 'steel-plate': 12, construction: 17, 'small-tube': 6, motor: 2, computer: 2 },
  LargeShipGrinder: { 'steel-plate': 20, construction: 30, 'large-tube': 1, motor: 4, computer: 2 },
  SmallShipGrinder: { 'steel-plate': 12, construction: 17, 'small-tube': 4, motor: 4, computer: 2 },

  // ── Connector ─────────────────────────────────────────────────────────────
  Connector: { 'steel-plate': 150, construction: 40, 'small-tube': 12, motor: 8, computer: 20 },

  // ── Gas systems ───────────────────────────────────────────────────────────
  OxygenGenerator: { 'steel-plate': 120, construction: 5, 'large-tube': 2, motor: 4, computer: 5 },
  OxygenGeneratorSmall: { 'steel-plate': 8, construction: 8, motor: 1, 'large-tube': 2, computer: 3 },
  LargeHydrogenTank: { 'steel-plate': 280, 'large-tube': 80, 'small-tube': 60, computer: 8, construction: 40 },
  SmallHydrogenTank: { 'steel-plate': 80, 'large-tube': 40, 'small-tube': 60, computer: 8, construction: 40 },
  OxygenTankSmall: { 'steel-plate': 14, construction: 10, 'small-tube': 10, 'large-tube': 2, computer: 3 },

  // ── Survival kit (small grid) ─────────────────────────────────────────────
  SurvivalKit: { 'steel-plate': 6, motor: 4, medical: 3, display: 1, construction: 2, computer: 5 },

  // ── Armor (light) ─────────────────────────────────────────────────────────
  SmallBlockArmorBlock: { 'steel-plate': 1 },
  LargeBlockArmorBlock: { 'steel-plate': 25 },
};

/**
 * Reskin / DLC-variant aliases → base SubtypeId whose cost they share. These
 * blocks are stat-identical to a base block (per `docs/data-audit.md`) and are
 * built from the same components, so we reuse the base recipe rather than
 * duplicating it.
 */
export const BLOCK_COST_ALIASES: Readonly<Record<string, string>> = {
  SmallBlockSmallAtmosphericThrustSciFi: 'SmallBlockSmallAtmosphericThrust',
  SmallShipWelderReskin: 'SmallShipWelder',
  SmallBlockModularContainer: 'SmallBlockMediumContainer',
  LargeBlockBatteryBlockWarfare2: 'LargeBlockBatteryBlock',
  SmallBlockBatteryBlockWarfare2: 'SmallBlockBatteryBlock',
};

/** A refinery block's throughput multipliers. */
export interface RefineryPreset {
  readonly id: string;
  readonly displayName: string;
  /** Divides refine time (higher = faster). */
  readonly refineSpeed: number;
  /** Multiplies ingot yield. */
  readonly materialEfficiency: number;
  /**
   * Whether the block has upgrade-module ports. The Basic Refinery has none, so
   * Yield/Speed modules do not apply to it (see {@link applyRefineryModules}).
   */
  readonly hasModulePorts: boolean;
}

/** An assembler block's throughput multiplier. */
export interface AssemblerPreset {
  readonly id: string;
  readonly displayName: string;
  /** Divides assemble time (higher = faster). */
  readonly assemblySpeed: number;
  /**
   * Whether the block has upgrade-module ports. The Basic Assembler has none,
   * so Speed modules do not apply to it (see {@link applyAssemblerModules}).
   */
  readonly hasModulePorts: boolean;
}

/**
 * Refinery presets. Standard Refinery (1.3 / 0.8) is exact [ARCHIVE]. Basic
 * Refinery (0.65 / 0.7) is current wiki and supersedes the archived "Blast
 * Furnace" (1.6 / 0.9); validated by the current-game combined figure
 * (0.7 × 0.7 = 0.49 iron yield). Survival-kit refining is omitted for now
 * (unconfirmed multipliers — see the audit doc).
 */
export const REFINERY_PRESETS: readonly RefineryPreset[] = [
  { id: 'refinery', displayName: 'Refinery', refineSpeed: 1.3, materialEfficiency: 0.8, hasModulePorts: true },
  { id: 'basic-refinery', displayName: 'Basic Refinery', refineSpeed: 0.65, materialEfficiency: 0.7, hasModulePorts: false },
];

/** Assembler presets. Standard (1.0) exact [ARCHIVE]; Basic (0.5) current wiki. */
export const ASSEMBLER_PRESETS: readonly AssemblerPreset[] = [
  { id: 'assembler', displayName: 'Assembler', assemblySpeed: 1.0, hasModulePorts: true },
  { id: 'basic-assembler', displayName: 'Basic Assembler', assemblySpeed: 0.5, hasModulePorts: false },
];

/** Sensible defaults: a standard Refinery + Assembler at the Realistic setting. */
export const DEFAULT_REFINERY: RefineryPreset = {
  id: 'refinery',
  displayName: 'Refinery',
  refineSpeed: 1.3,
  materialEfficiency: 0.8,
  hasModulePorts: true,
};
export const DEFAULT_ASSEMBLER: AssemblerPreset = {
  id: 'assembler',
  displayName: 'Assembler',
  assemblySpeed: 1.0,
  hasModulePorts: true,
};

/**
 * The world's Assembler-Efficiency multiplier (x1 Realistic / x3 / x10). It
 * DIVIDES the ingot cost of every component. Default x1 = full cost as listed.
 */
export const DEFAULT_ASSEMBLER_EFFICIENCY = 1;

// ── Upgrade modules (Yield / Speed) ──────────────────────────────────────────
//
// Refinery/assembler upgrade modules attach to the block's ports and multiply
// its throughput. Values verified against the current game (spaceengineers.wiki.gg,
// "Yield Module" / "Speed Module"):
//   - A full-size Refinery has 4 upgrade ports, SHARED between Yield and Speed
//     (so yield + speed ≤ 4). A full-size Assembler has 8 ports.
//   - The Basic Refinery / Basic Assembler have NO ports (`hasModulePorts:false`).
//   - Yield Modules affect REFINERIES ONLY — they have no effect on assemblers.
//
// The slot-sharing cap (yield + speed ≤ refinery ports) is enforced by the UI
// that owns the module counts, not by the pure helpers below — the helpers only
// clamp each input to its own module maximum.

/** Upgrade-module port count on a full-size Refinery (Yield + Speed share these). */
export const REFINERY_MODULE_SLOTS = 4;

/** Upgrade-module port count on a full-size Assembler (Speed only, for cost). */
export const ASSEMBLER_MODULE_SLOTS = 8;

/**
 * Refinery ingot-yield multiplier by installed Yield Module count (index = count).
 * Verified curve: 0→100%, 1→119%, 2→141%, 3→168%, 4→200% effectiveness. Four
 * Yield Modules double a refinery's ingot output (its maximum). Multiplies the
 * refinery's base `materialEfficiency`.
 */
export const YIELD_MODULE_EFFECTIVENESS: readonly number[] = [1.0, 1.19, 1.41, 1.68, 2.0];

/**
 * Production-speed multiplier from `count` Speed Modules: `1 + count`. Verified
 * curve: 1→2×, 2→3×, 3→4×, 4→5× (each module "acts like one extra machine").
 * Applies to both refineries (multiplies `refineSpeed`) and assemblers
 * (multiplies `assemblySpeed`). Negative counts are treated as zero.
 */
export function speedModuleMultiplier(count: number): number {
  return 1 + Math.max(0, Math.floor(count));
}

/** Clamp a module count to `[0, max]` (integer). */
function clampModuleCount(count: number, max: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(max, Math.max(0, Math.floor(count)));
}

/**
 * Compose an effective {@link RefineryPreset} with `yield`/`speed` upgrade
 * modules applied: `materialEfficiency × YIELD_MODULE_EFFECTIVENESS[yield]` and
 * `refineSpeed × speedModuleMultiplier(speed)`. Each count is clamped to
 * `[0, REFINERY_MODULE_SLOTS]` independently — the caller (UI) is responsible
 * for the shared-slot cap `yield + speed ≤ REFINERY_MODULE_SLOTS`. A refinery
 * with no ports (Basic) is returned unchanged.
 */
export function applyRefineryModules(
  preset: RefineryPreset,
  modules: { readonly yield: number; readonly speed: number },
): RefineryPreset {
  if (!preset.hasModulePorts) return preset;
  const yieldCount = clampModuleCount(modules.yield, REFINERY_MODULE_SLOTS);
  const speedCount = clampModuleCount(modules.speed, REFINERY_MODULE_SLOTS);
  const yieldMult = YIELD_MODULE_EFFECTIVENESS[yieldCount] ?? 1;
  return {
    ...preset,
    materialEfficiency: preset.materialEfficiency * yieldMult,
    refineSpeed: preset.refineSpeed * speedModuleMultiplier(speedCount),
  };
}

/**
 * Compose an effective {@link AssemblerPreset} with `speed` upgrade modules
 * applied: `assemblySpeed × speedModuleMultiplier(speed)`, `speed` clamped to
 * `[0, ASSEMBLER_MODULE_SLOTS]`. Assemblers accept only Speed modules (Yield
 * modules have no assembler effect). An assembler with no ports (Basic) is
 * returned unchanged.
 */
export function applyAssemblerModules(
  preset: AssemblerPreset,
  modules: { readonly speed: number },
): AssemblerPreset {
  if (!preset.hasModulePorts) return preset;
  const speedCount = clampModuleCount(modules.speed, ASSEMBLER_MODULE_SLOTS);
  return {
    ...preset,
    assemblySpeed: preset.assemblySpeed * speedModuleMultiplier(speedCount),
  };
}
