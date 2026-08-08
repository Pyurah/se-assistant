/**
 * Static configuration for the block-definition generator.
 *
 * This module holds the game-file paths, the maps from the game's own
 * vocabulary (`xsi:type`, `<DLC>` tags) to our schema types, and the unit
 * conversion constants. It is pure data + tiny helpers — no `fs`, so it can be
 * imported by the unit-tested pure parser without touching the disk.
 *
 * Everything here is derived from Space Engineers v1.210.012 b0 definition
 * files. When the game updates, re-verify these maps (a new `xsi:type` or DLC
 * tag surfaces as a diagnostic from the generator, never a silent mis-tag).
 */

import type { BlockCategory, Dlc } from '../../src/data/schema';

/**
 * Default install location of the Steam copy of Space Engineers on Windows.
 * Override with `--game-dir <path>` when the game lives elsewhere.
 */
export const DEFAULT_GAME_DIR =
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\SpaceEngineers';

/** Paths relative to the game's `Content/Data` directory. */
export const CONTENT_DATA_SUBDIR = 'Content/Data';
export const CUBEBLOCKS_SUBDIR = 'CubeBlocks';
export const COMPONENTS_FILE = 'Components.sbc';
export const LOCALIZATION_FILE = 'Localization/MyTexts.resx';

/** Space Engineers build these definition files target. Emitted into the banner. */
export const GAME_BUILD = 'v1.210.012 b0';

/** Megawatts → watts. Power fields in defs are MW. */
export const MW_TO_W = 1_000_000;
/** Megawatt-hours → watt-hours. Battery `MaxStoredPower` is MWh. */
export const MWH_TO_WH = 1_000_000;

/**
 * Map from a definition's `xsi:type` (minus the `MyObjectBuilder_` prefix) to
 * the schema {@link BlockCategory} we generate stat-bearing entries for.
 *
 * ONLY the seven categories whose required schema fields are fully present in
 * the definition files are listed. Every other block type (armor, cargo,
 * cockpit, weapons, tools, doors, …) is generated as a mass-only `'other'`
 * `GenericBlock` — honest about what the definition actually provides. Curated
 * `source: 'vanilla'` entries (which carry hand-verified cargo volume, fuel
 * burn, etc.) override these on subtypeId conflict, so the app keeps its
 * trusted stats where we have them and gains mass-correct coverage everywhere
 * else.
 *
 * Rationale for excluding cargo/cockpit: `CargoBlock.inventoryVolume` is a
 * REQUIRED schema field, but containers have no literal volume field in their
 * definition (the game computes it from block size). Emitting a cargo block
 * without it would be a type error; fabricating one would be a lie. So generated
 * containers are mass-only 'other' and the 6 curated cargo blocks supply volume.
 */
export const XSI_TYPE_TO_CATEGORY: Readonly<Record<string, BlockCategory>> = {
  ThrustDefinition: 'thruster',
  BatteryBlockDefinition: 'battery',
  GyroDefinition: 'gyroscope',
  SolarPanelDefinition: 'solar',
  WindTurbineDefinition: 'wind-turbine',
  ReactorDefinition: 'reactor',
  HydrogenEngineDefinition: 'hydrogen-engine',
};

/**
 * Map from the game's `<DLC>` tag values to our {@link Dlc} union. A block
 * carries at most one `<DLC>` tag; no tag means base game. An unmapped tag is a
 * hard error in the generator (prevents silently mis-tagging a block as base).
 */
export const DLC_TAG_TO_ID: Readonly<Record<string, Dlc>> = {
  DecorativeBlocks: 'decorative-1',
  DecorativeBlocks2: 'decorative-2',
  DecorativeBlocks3: 'decorative-3',
  Economy: 'economy',
  Economy2: 'economy-2',
  Frostbite: 'frostbite',
  SparksOfTheFuture: 'sparks-of-the-future',
  Wasteland: 'wasteland',
  Warfare1: 'warfare-1',
  HeavyIndustry: 'heavy-industry',
  Warfare2: 'warfare-2',
  Automatons: 'automatons',
  Signal: 'signal',
  Contact: 'contact',
  Fieldwork: 'fieldwork',
  CoreSystems: 'core-systems',
  Prosperity: 'prosperity',
  ScrapRace: 'scrap-race',
  ApexSurvival: 'apex-survival',
};
