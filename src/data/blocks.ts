import type { BlockDefinition } from './schema';
import { FUNCTIONAL_BLOCKS } from './functional-blocks';
import { WEAPON_BLOCKS } from './weapon-blocks';

/**
 * Curated vanilla block dataset — Space Engineers v1.210.012 b0.
 *
 * VERIFIED against the current official wiki (spaceengineers.wiki.gg, pages
 * edited 2026) with SubtypeIds and thruster effectiveness-curve semantics
 * cross-checked against Keen's `CubeBlocks.sbc`. Every value carries
 * `source: 'vanilla'`. See `docs/data-audit.md` for the citation log and the
 * handful of values still flagged as unverified (cockpit inventory volumes,
 * hydrogen-engine / wind-turbine SubtypeIds).
 *
 * All standard thrusters, cargo, cockpits, reactors, batteries, solar panels,
 * hydrogen engines and the wind turbine are base-game (`dlc: 'base'`). DLC
 * packs add only stat-identical reskins of these, so for physics the base
 * block is sufficient; DLC-specific variants can be layered on later.
 *
 * SubtypeId naming: the first token is the GRID size and the inner
 * `Small/Large` is the block-size VARIANT. e.g. `LargeBlockSmallThrust` is a
 * large-grid *small* ion thruster.
 *
 * Thruster effectiveness envelopes (design constants, identical within a type):
 *   ion         — minInfluence 0,   maxInfluence 1, eff 1.0 -> 0.3 (best in vacuum)
 *   atmospheric — minInfluence 0.3, maxInfluence 1, eff 0.0 -> 1.0 (needs air)
 *   hydrogen    — flat 1.0 everywhere (no envelope)
 *
 * Schema rule: this array must remain plain serializable data so a future
 * `.sbc` definition parser can regenerate it wholesale.
 */
export const VANILLA_CORE_BLOCKS: readonly BlockDefinition[] = [
  // === ION THRUSTERS (electric; full thrust in vacuum) ====================
  {
    id: 'small-small-ion-thruster',
    subtypeId: 'SmallBlockSmallThrust',
    displayName: 'Ion Thruster (Small Grid)',
    category: 'thruster',
    thrusterType: 'ion',
    gridSize: 'small',
    dlc: 'base',
    mass: 121,
    maxThrust: 14_400,
    maxPowerDraw: 200_000,
    minPlanetaryInfluence: 0,
    maxPlanetaryInfluence: 1,
    effectivenessAtMinInfluence: 1.0,
    effectivenessAtMaxInfluence: 0.3,
    source: 'vanilla',
  },
  {
    id: 'small-large-ion-thruster',
    subtypeId: 'SmallBlockLargeThrust',
    displayName: 'Large Ion Thruster (Small Grid)',
    category: 'thruster',
    thrusterType: 'ion',
    gridSize: 'small',
    dlc: 'base',
    mass: 721,
    maxThrust: 172_800,
    maxPowerDraw: 2_400_000,
    minPlanetaryInfluence: 0,
    maxPlanetaryInfluence: 1,
    effectivenessAtMinInfluence: 1.0,
    effectivenessAtMaxInfluence: 0.3,
    source: 'vanilla',
  },
  {
    id: 'large-small-ion-thruster',
    subtypeId: 'LargeBlockSmallThrust',
    displayName: 'Ion Thruster (Large Grid)',
    category: 'thruster',
    thrusterType: 'ion',
    gridSize: 'large',
    dlc: 'base',
    mass: 4380,
    maxThrust: 345_600,
    maxPowerDraw: 3_360_000,
    minPlanetaryInfluence: 0,
    maxPlanetaryInfluence: 1,
    effectivenessAtMinInfluence: 1.0,
    effectivenessAtMaxInfluence: 0.3,
    source: 'vanilla',
  },
  {
    id: 'large-large-ion-thruster',
    subtypeId: 'LargeBlockLargeThrust',
    displayName: 'Large Ion Thruster (Large Grid)',
    category: 'thruster',
    thrusterType: 'ion',
    gridSize: 'large',
    dlc: 'base',
    mass: 43_200,
    maxThrust: 4_320_000,
    maxPowerDraw: 33_600_000,
    minPlanetaryInfluence: 0,
    maxPlanetaryInfluence: 1,
    effectivenessAtMinInfluence: 1.0,
    effectivenessAtMaxInfluence: 0.3,
    source: 'vanilla',
  },

  // === ATMOSPHERIC THRUSTERS (electric; need air, dead in vacuum) =========
  {
    id: 'small-small-atmospheric-thruster',
    subtypeId: 'SmallBlockSmallAtmosphericThrust',
    displayName: 'Atmospheric Thruster (Small Grid)',
    category: 'thruster',
    thrusterType: 'atmospheric',
    gridSize: 'small',
    dlc: 'base',
    mass: 699,
    maxThrust: 96_000,
    maxPowerDraw: 600_000,
    minPlanetaryInfluence: 0.3,
    maxPlanetaryInfluence: 1,
    effectivenessAtMinInfluence: 0.0,
    effectivenessAtMaxInfluence: 1.0,
    source: 'vanilla',
  },
  {
    id: 'small-large-atmospheric-thruster',
    subtypeId: 'SmallBlockLargeAtmosphericThrust',
    displayName: 'Large Atmospheric Thruster (Small Grid)',
    category: 'thruster',
    thrusterType: 'atmospheric',
    gridSize: 'small',
    dlc: 'base',
    mass: 2948,
    maxThrust: 576_000,
    maxPowerDraw: 2_400_000,
    minPlanetaryInfluence: 0.3,
    maxPlanetaryInfluence: 1,
    effectivenessAtMinInfluence: 0.0,
    effectivenessAtMaxInfluence: 1.0,
    source: 'vanilla',
  },
  {
    id: 'large-small-atmospheric-thruster',
    subtypeId: 'LargeBlockSmallAtmosphericThrust',
    displayName: 'Atmospheric Thruster (Large Grid)',
    category: 'thruster',
    thrusterType: 'atmospheric',
    gridSize: 'large',
    dlc: 'base',
    mass: 4000,
    maxThrust: 648_000,
    maxPowerDraw: 2_400_000,
    minPlanetaryInfluence: 0.3,
    maxPlanetaryInfluence: 1,
    effectivenessAtMinInfluence: 0.0,
    effectivenessAtMaxInfluence: 1.0,
    source: 'vanilla',
  },
  {
    id: 'large-large-atmospheric-thruster',
    subtypeId: 'LargeBlockLargeAtmosphericThrust',
    displayName: 'Large Atmospheric Thruster (Large Grid)',
    category: 'thruster',
    thrusterType: 'atmospheric',
    gridSize: 'large',
    dlc: 'base',
    mass: 32_970,
    maxThrust: 6_480_000,
    maxPowerDraw: 16_800_000,
    minPlanetaryInfluence: 0.3,
    maxPlanetaryInfluence: 1,
    effectivenessAtMinInfluence: 0.0,
    effectivenessAtMaxInfluence: 1.0,
    source: 'vanilla',
  },
  {
    // Sparks of the Future reskin of the small-grid Small Atmospheric Thruster.
    // Stat-identical to SmallBlockSmallAtmosphericThrust (96 kN, 0.6 MW, 699 kg).
    id: 'small-small-atmospheric-thruster-scifi',
    subtypeId: 'SmallBlockSmallAtmosphericThrustSciFi',
    displayName: 'Atmospheric Thruster (Small Grid, Sci-Fi)',
    category: 'thruster',
    thrusterType: 'atmospheric',
    gridSize: 'small',
    dlc: 'sparks-of-the-future',
    mass: 699,
    maxThrust: 96_000,
    maxPowerDraw: 600_000,
    minPlanetaryInfluence: 0.3,
    maxPlanetaryInfluence: 1,
    effectivenessAtMinInfluence: 0.0,
    effectivenessAtMaxInfluence: 1.0,
    source: 'vanilla',
  },
  {
    // Base-game flat "D-shape" large atmospheric thruster for small grid
    // (low-profile variant). 230 kN, 1 MW, 1060 kg.
    id: 'small-large-flat-atmospheric-thruster-dshape',
    subtypeId: 'SmallBlockLargeFlatAtmosphericThrustDShape',
    displayName: 'Large Flat Atmospheric Thruster (Small Grid, D-Shape)',
    category: 'thruster',
    thrusterType: 'atmospheric',
    gridSize: 'small',
    dlc: 'base',
    mass: 1060,
    maxThrust: 230_000,
    maxPowerDraw: 1_000_000,
    minPlanetaryInfluence: 0.3,
    maxPlanetaryInfluence: 1,
    effectivenessAtMinInfluence: 0.0,
    effectivenessAtMaxInfluence: 1.0,
    source: 'vanilla',
  },

  // === HYDROGEN THRUSTERS (0 W electric; burn hydrogen; flat everywhere) ==
  {
    id: 'small-small-hydrogen-thruster',
    subtypeId: 'SmallBlockSmallHydrogenThrust',
    displayName: 'Hydrogen Thruster (Small Grid)',
    category: 'thruster',
    thrusterType: 'hydrogen',
    gridSize: 'small',
    dlc: 'base',
    mass: 334,
    maxThrust: 98_400,
    maxPowerDraw: 0,
    maxHydrogenConsumption: 80.33,
    source: 'vanilla',
  },
  {
    id: 'small-large-hydrogen-thruster',
    subtypeId: 'SmallBlockLargeHydrogenThrust',
    displayName: 'Large Hydrogen Thruster (Small Grid)',
    category: 'thruster',
    thrusterType: 'hydrogen',
    gridSize: 'small',
    dlc: 'base',
    mass: 1222,
    maxThrust: 480_000,
    maxPowerDraw: 0,
    maxHydrogenConsumption: 385.6,
    source: 'vanilla',
  },
  {
    id: 'large-small-hydrogen-thruster',
    subtypeId: 'LargeBlockSmallHydrogenThrust',
    displayName: 'Hydrogen Thruster (Large Grid)',
    category: 'thruster',
    thrusterType: 'hydrogen',
    gridSize: 'large',
    dlc: 'base',
    mass: 1420,
    maxThrust: 1_080_000,
    maxPowerDraw: 0,
    maxHydrogenConsumption: 803.34,
    source: 'vanilla',
  },
  {
    id: 'large-large-hydrogen-thruster',
    subtypeId: 'LargeBlockLargeHydrogenThrust',
    displayName: 'Large Hydrogen Thruster (Large Grid)',
    category: 'thruster',
    thrusterType: 'hydrogen',
    gridSize: 'large',
    dlc: 'base',
    mass: 6940,
    maxThrust: 7_200_000,
    maxPowerDraw: 0,
    maxHydrogenConsumption: 4820.05,
    source: 'vanilla',
  },

  // === CARGO CONTAINERS ===================================================
  {
    id: 'small-small-cargo-container',
    subtypeId: 'SmallBlockSmallContainer',
    displayName: 'Small Cargo Container (Small Grid)',
    category: 'cargo',
    gridSize: 'small',
    dlc: 'base',
    mass: 49.2,
    inventoryVolume: 125,
    source: 'vanilla',
  },
  {
    id: 'small-medium-cargo-container',
    subtypeId: 'SmallBlockMediumContainer',
    displayName: 'Medium Cargo Container (Small Grid)',
    category: 'cargo',
    gridSize: 'small',
    dlc: 'base',
    mass: 274.8,
    inventoryVolume: 3375,
    source: 'vanilla',
  },
  {
    // Contact Pack reskin of the small-grid Medium Cargo Container. Same 3375 L
    // capacity; slightly heavier component list (computed 463 kg from parts).
    id: 'small-modular-cargo-container',
    subtypeId: 'SmallBlockModularContainer',
    displayName: 'Modular Cargo Container (Small Grid)',
    category: 'cargo',
    gridSize: 'small',
    dlc: 'contact',
    mass: 463,
    inventoryVolume: 3375,
    source: 'vanilla',
  },
  {
    id: 'small-large-cargo-container',
    subtypeId: 'SmallBlockLargeContainer',
    displayName: 'Large Cargo Container (Small Grid)',
    category: 'cargo',
    gridSize: 'small',
    dlc: 'base',
    mass: 626.2,
    inventoryVolume: 15_625,
    source: 'vanilla',
  },
  {
    id: 'large-small-cargo-container',
    subtypeId: 'LargeBlockSmallContainer',
    displayName: 'Small Cargo Container (Large Grid)',
    category: 'cargo',
    gridSize: 'large',
    dlc: 'base',
    mass: 648.4,
    inventoryVolume: 15_625,
    source: 'vanilla',
  },
  {
    id: 'large-large-cargo-container',
    subtypeId: 'LargeBlockLargeContainer',
    displayName: 'Large Cargo Container (Large Grid)',
    category: 'cargo',
    gridSize: 'large',
    dlc: 'base',
    mass: 2593.6,
    inventoryVolume: 421_000,
    source: 'vanilla',
  },

  // === REACTORS (1 MWh per 1 kg Uranium Ingot) ============================
  {
    id: 'small-small-reactor',
    subtypeId: 'SmallBlockSmallGenerator',
    displayName: 'Small Reactor (Small Grid)',
    category: 'reactor',
    gridSize: 'small',
    dlc: 'base',
    mass: 278,
    maxPowerOutput: 500_000,
    inventoryVolume: 125,
    inventoryConstraint: 'uranium',
    source: 'vanilla',
  },
  {
    id: 'small-large-reactor',
    subtypeId: 'SmallBlockLargeGenerator',
    displayName: 'Large Reactor (Small Grid)',
    category: 'reactor',
    gridSize: 'small',
    dlc: 'base',
    mass: 3901,
    maxPowerOutput: 14_750_000,
    inventoryVolume: 1000,
    inventoryConstraint: 'uranium',
    source: 'vanilla',
  },
  {
    id: 'large-small-reactor',
    subtypeId: 'LargeBlockSmallGenerator',
    displayName: 'Small Reactor (Large Grid)',
    category: 'reactor',
    gridSize: 'large',
    dlc: 'base',
    mass: 4793,
    maxPowerOutput: 15_000_000,
    inventoryVolume: 1000,
    inventoryConstraint: 'uranium',
    source: 'vanilla',
  },
  {
    id: 'large-large-reactor',
    subtypeId: 'LargeBlockLargeGenerator',
    displayName: 'Large Reactor (Large Grid)',
    category: 'reactor',
    gridSize: 'large',
    dlc: 'base',
    mass: 73_795,
    maxPowerOutput: 300_000_000,
    inventoryVolume: 8000,
    inventoryConstraint: 'uranium',
    source: 'vanilla',
  },

  // === BATTERIES ==========================================================
  {
    id: 'small-small-battery',
    subtypeId: 'SmallBlockSmallBatteryBlock',
    displayName: 'Small Battery (Small Grid)',
    category: 'battery',
    gridSize: 'small',
    dlc: 'base',
    mass: 146.4,
    maxPowerOutput: 200_000,
    maxPowerInput: 200_000,
    energyCapacity: 50_000, // 50 kWh — compact 1x1x1 variant
    source: 'vanilla',
  },
  {
    id: 'small-battery',
    subtypeId: 'SmallBlockBatteryBlock',
    displayName: 'Battery (Small Grid)',
    category: 'battery',
    gridSize: 'small',
    dlc: 'base',
    mass: 1040.4,
    maxPowerOutput: 4_000_000,
    maxPowerInput: 4_000_000,
    energyCapacity: 1_000_000, // 1 MWh
    source: 'vanilla',
  },
  {
    id: 'large-battery',
    subtypeId: 'LargeBlockBatteryBlock',
    displayName: 'Battery (Large Grid)',
    category: 'battery',
    gridSize: 'large',
    dlc: 'base',
    mass: 3845,
    maxPowerOutput: 12_000_000,
    maxPowerInput: 12_000_000,
    energyCapacity: 3_000_000, // 3 MWh
    source: 'vanilla',
  },
  {
    // Warfare 2 reskin — stat-identical to the large Battery. SubtypeId follows
    // Keen's Warfare2 convention; flagged for .sbc verification in data-audit.
    id: 'large-battery-warfare2',
    subtypeId: 'LargeBlockBatteryBlockWarfare2',
    displayName: 'Warfare Battery (Large Grid)',
    category: 'battery',
    gridSize: 'large',
    dlc: 'warfare-2',
    mass: 3845,
    maxPowerOutput: 12_000_000,
    maxPowerInput: 12_000_000,
    energyCapacity: 3_000_000,
    source: 'vanilla',
  },
  {
    id: 'small-battery-warfare2',
    subtypeId: 'SmallBlockBatteryBlockWarfare2',
    displayName: 'Warfare Battery (Small Grid)',
    category: 'battery',
    gridSize: 'small',
    dlc: 'warfare-2',
    mass: 1040.4,
    maxPowerOutput: 4_000_000,
    maxPowerInput: 4_000_000,
    energyCapacity: 1_000_000,
    source: 'vanilla',
  },

  // === SOLAR PANELS (output at full sun, panel normal to sun) =============
  {
    id: 'small-solar-panel',
    subtypeId: 'SmallBlockSolarPanel',
    displayName: 'Solar Panel (Small Grid)',
    category: 'solar',
    gridSize: 'small',
    dlc: 'base',
    mass: 143.2,
    maxPowerOutput: 40_000,
    source: 'vanilla',
  },
  {
    id: 'large-solar-panel',
    subtypeId: 'LargeBlockSolarPanel',
    displayName: 'Solar Panel (Large Grid)',
    category: 'solar',
    gridSize: 'large',
    dlc: 'base',
    mass: 516.8,
    maxPowerOutput: 160_000,
    source: 'vanilla',
  },

  // === HYDROGEN ENGINES ===================================================
  // NOTE: SubtypeIds follow Keen naming convention; flagged for .sbc re-verify.
  {
    id: 'small-hydrogen-engine',
    subtypeId: 'SmallBlockHydrogenEngine',
    displayName: 'Hydrogen Engine (Small Grid)',
    category: 'hydrogen-engine',
    gridSize: 'small',
    dlc: 'base',
    mass: 1005.2,
    maxPowerOutput: 500_000,
    maxHydrogenConsumption: 50, // L/s at max output (wiki)
    source: 'vanilla',
  },
  {
    id: 'large-hydrogen-engine',
    subtypeId: 'LargeBlockHydrogenEngine',
    displayName: 'Hydrogen Engine (Large Grid)',
    category: 'hydrogen-engine',
    gridSize: 'large',
    dlc: 'base',
    mass: 3253.8,
    maxPowerOutput: 5_000_000,
    maxHydrogenConsumption: 500, // L/s at max output (wiki)
    source: 'vanilla',
  },

  // === WIND TURBINE (large grid only; 400 kW average weather) =============
  {
    id: 'large-wind-turbine',
    subtypeId: 'LargeBlockWindTurbine',
    displayName: 'Wind Turbine (Large Grid)',
    category: 'wind-turbine',
    gridSize: 'large',
    dlc: 'base',
    mass: 616.4,
    maxPowerOutput: 400_000,
    source: 'vanilla',
  },

  // === COCKPITS ===========================================================
  // NOTE: inventory volume not published on wiki; flagged unverified in audit.
  {
    id: 'large-cockpit',
    subtypeId: 'LargeBlockCockpit',
    displayName: 'Cockpit (Large Grid)',
    category: 'cockpit',
    gridSize: 'large',
    dlc: 'base',
    mass: 508,
    inventoryVolume: 120,
    source: 'vanilla',
  },
  {
    id: 'small-cockpit',
    subtypeId: 'SmallBlockCockpit',
    displayName: 'Cockpit (Small Grid)',
    category: 'cockpit',
    gridSize: 'small',
    dlc: 'base',
    mass: 627,
    inventoryVolume: 120,
    source: 'vanilla',
  },
] as const;

/**
 * All curated vanilla blocks: the propulsion/cargo/power/cockpit core above
 * plus the functional "payload" & utility blocks (drills, tools, gyros,
 * connectors, lights, comms, sensors, logic) used by the block palette and the
 * requirement estimator, plus the curated weapon blocks (mass-only catalogue
 * entries; firing stats live in `weapons.ts`).
 */
export const VANILLA_BLOCKS: readonly BlockDefinition[] = [
  ...VANILLA_CORE_BLOCKS,
  ...FUNCTIONAL_BLOCKS,
  ...WEAPON_BLOCKS,
];

/** Convenience lookup by id. */
export const VANILLA_BLOCKS_BY_ID: Readonly<Record<string, BlockDefinition>> = Object.fromEntries(
  VANILLA_BLOCKS.map((b) => [b.id, b]),
);

/** Convenience lookup by the game's SubtypeId for blueprint matching. */
export const VANILLA_BLOCKS_BY_SUBTYPE: Readonly<Record<string, BlockDefinition>> =
  Object.fromEntries(VANILLA_BLOCKS.map((b) => [b.subtypeId, b]));
