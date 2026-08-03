import type { BlockDefinition } from './schema';

/**
 * Curated vanilla block dataset — SEED.
 *
 * This file currently contains a small, representative slice of blocks so the
 * calc engine and UI have real data to build against. Completing this dataset
 * to full vanilla coverage (all thruster types x both grid sizes x both
 * variants, all cargo containers, all power sources) is roadmap Phase 1 / M1.
 *
 * Every value carries `source: 'vanilla'` and MUST be verified against the
 * current game version during the M1 data-audit. Treat the seed numbers as
 * placeholders-for-shape, not yet as authoritative game stats.
 *
 * Schema rule: this array must remain plain serializable data so a future
 * `.sbc` definition parser can regenerate it wholesale.
 */
export const VANILLA_BLOCKS: readonly BlockDefinition[] = [
  // --- Thrusters (seed) ---------------------------------------------------
  {
    id: 'large-large-atmospheric-thruster',
    subtypeId: 'LargeBlockLargeAtmosphericThrust',
    displayName: 'Large Atmospheric Thruster (Large Grid)',
    category: 'thruster',
    thrusterType: 'atmospheric',
    gridSize: 'large',
    mass: 32900,
    maxThrust: 6_480_000,
    maxPowerDraw: 16_800_000,
    minPlanetaryInfluence: 0,
    maxPlanetaryInfluence: 1,
    effectivenessAtMinInfluence: 0,
    effectivenessAtMaxInfluence: 1,
    source: 'vanilla',
  },
  {
    id: 'large-large-ion-thruster',
    subtypeId: 'LargeBlockLargeThrust',
    displayName: 'Large Ion Thruster (Large Grid)',
    category: 'thruster',
    thrusterType: 'ion',
    gridSize: 'large',
    mass: 3625,
    maxThrust: 4_320_000,
    maxPowerDraw: 33_600_000,
    minPlanetaryInfluence: 0,
    maxPlanetaryInfluence: 1,
    effectivenessAtMinInfluence: 1,
    effectivenessAtMaxInfluence: 0.3,
    source: 'vanilla',
  },
  {
    id: 'large-large-hydrogen-thruster',
    subtypeId: 'LargeBlockLargeHydrogenThrust',
    displayName: 'Large Hydrogen Thruster (Large Grid)',
    category: 'thruster',
    thrusterType: 'hydrogen',
    gridSize: 'large',
    mass: 6940,
    maxThrust: 7_200_000,
    maxPowerDraw: 0,
    source: 'vanilla',
  },

  // --- Cargo (seed) -------------------------------------------------------
  {
    id: 'large-large-cargo-container',
    subtypeId: 'LargeBlockLargeContainer',
    displayName: 'Large Cargo Container (Large Grid)',
    category: 'cargo',
    gridSize: 'large',
    mass: 3110,
    inventoryVolume: 421_875,
    source: 'vanilla',
  },

  // --- Power (seed) -------------------------------------------------------
  {
    id: 'large-large-reactor',
    subtypeId: 'LargeBlockLargeGenerator',
    displayName: 'Large Reactor (Large Grid)',
    category: 'reactor',
    gridSize: 'large',
    mass: 12_600,
    maxPowerOutput: 300_000_000,
    source: 'vanilla',
  },
  {
    id: 'large-battery',
    subtypeId: 'LargeBlockBatteryBlock',
    displayName: 'Battery (Large Grid)',
    category: 'battery',
    gridSize: 'large',
    mass: 3762,
    maxPowerOutput: 12_000_000,
    maxPowerInput: 12_000_000,
    energyCapacity: 3_000_000, // 3 MWh
    source: 'vanilla',
  },
] as const;

/** Convenience lookup by id. */
export const VANILLA_BLOCKS_BY_ID: Readonly<Record<string, BlockDefinition>> = Object.fromEntries(
  VANILLA_BLOCKS.map((b) => [b.id, b]),
);

/** Convenience lookup by the game's SubtypeId for blueprint matching. */
export const VANILLA_BLOCKS_BY_SUBTYPE: Readonly<Record<string, BlockDefinition>> =
  Object.fromEntries(VANILLA_BLOCKS.map((b) => [b.subtypeId, b]));
