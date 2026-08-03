/**
 * Core block & planet data schema for Space Engineers stat calculations.
 *
 * Design intent
 * -------------
 * This schema is the single source of truth for block statistics. It is
 * deliberately shaped so a future `.sbc` *definition-file* parser (the game's
 * `CubeBlocks.sbc`, `Thrust.sbc`, etc.) can regenerate or extend this data
 * without changing the schema. Field names mirror the game's own concepts
 * (grid size, block subtype, thrust by environment) so the mapping stays
 * mechanical.
 *
 * Everything here is plain, serializable data (no functions, no classes) so it
 * can be authored as TS constants now and swapped for generated JSON later.
 *
 * Units are explicit and SI unless noted:
 *   mass            kilograms (kg)
 *   power           watts (W)          — generation and draw both positive
 *   thrust          newtons (N)
 *   volume          liters (L)
 *   gravity         meters/second^2 (m/s^2)
 *   energy capacity watt-hours (Wh)
 */

/** Space Engineers has two grid scales; most blocks exist per grid size. */
export type GridSize = 'small' | 'large';

/** Where a block's stats came from — drives the vanilla-vs-modded toggle. */
export type StatSource =
  /** Hand-curated from the vanilla game. Trusted. */
  | 'vanilla'
  /** Generated from a parsed game definition (.sbc) file. Trusted. */
  | 'definition'
  /** Read from an imported blueprint's block list (may be modded). */
  | 'blueprint'
  /** Typed in by the user (e.g. a modded block with unknown stats). */
  | 'user';

export type BlockCategory =
  | 'thruster'
  | 'cargo'
  | 'reactor'
  | 'battery'
  | 'solar'
  | 'hydrogen-engine'
  | 'wind-turbine'
  | 'gyroscope'
  | 'cockpit'
  | 'structural'
  | 'other';

/**
 * Which physics environment a thruster operates in. Thrust output scales
 * differently per type with atmospheric air density (0..1):
 *   atmospheric — scales UP with air density (useless in space)
 *   ion         — scales DOWN with air density (best in space)
 *   hydrogen    — constant everywhere
 */
export type ThrusterType = 'atmospheric' | 'ion' | 'hydrogen';

/** The six local movement axes; thrust is directional. */
export type Direction = 'up' | 'down' | 'forward' | 'backward' | 'left' | 'right';

/** Fields shared by every block definition. */
export interface BlockBase {
  /** Stable machine id, e.g. `large-large-atmospheric-thruster`. */
  readonly id: string;
  /** The game's SubtypeId when known, used to match blueprint entries. */
  readonly subtypeId: string;
  /** Human-facing name, e.g. "Large Atmospheric Thruster". */
  readonly displayName: string;
  readonly category: BlockCategory;
  readonly gridSize: GridSize;
  /** Empty (dry) mass of the block itself, kg. */
  readonly mass: number;
  /** Where these numbers came from. */
  readonly source: StatSource;
  /** Grid cells occupied — informational, useful for build-cost math later. */
  readonly cellCount?: number;
}

export interface ThrusterBlock extends BlockBase {
  readonly category: 'thruster';
  readonly thrusterType: ThrusterType;
  /** Max thrust at full effectiveness, N. */
  readonly maxThrust: number;
  /** Peak electrical draw at full thrust, W. Fuel thrusters may be 0. */
  readonly maxPowerDraw: number;
  /**
   * Atmospheric effectiveness envelope, air density 0..1.
   * For atmospheric thrusters: effectiveness ramps between these bounds.
   * For ion: effectiveness is inverted across these bounds.
   * Hydrogen ignores these.
   */
  readonly minPlanetaryInfluence?: number;
  readonly maxPlanetaryInfluence?: number;
  readonly effectivenessAtMinInfluence?: number;
  readonly effectivenessAtMaxInfluence?: number;
}

export interface CargoBlock extends BlockBase {
  readonly category: 'cargo' | 'cockpit';
  /** Inventory capacity, liters. */
  readonly inventoryVolume: number;
}

export interface PowerProducerBlock extends BlockBase {
  readonly category: 'reactor' | 'solar' | 'hydrogen-engine' | 'wind-turbine';
  /** Max sustained electrical output, W. */
  readonly maxPowerOutput: number;
}

export interface BatteryBlock extends BlockBase {
  readonly category: 'battery';
  /** Max discharge (output) rate, W. */
  readonly maxPowerOutput: number;
  /** Max recharge (input) rate, W. */
  readonly maxPowerInput: number;
  /** Stored energy capacity, watt-hours. */
  readonly energyCapacity: number;
}

/** Blocks that only add mass / draw idle power (gyros, structural, misc). */
export interface GenericBlock extends BlockBase {
  readonly category: 'gyroscope' | 'structural' | 'other';
  /** Idle/operational electrical draw, W. */
  readonly powerDraw?: number;
}

export type BlockDefinition =
  ThrusterBlock | CargoBlock | PowerProducerBlock | BatteryBlock | GenericBlock;

/** A planet/moon preset for gravity and atmosphere. */
export interface PlanetPreset {
  readonly id: string;
  readonly displayName: string;
  /** Surface gravity, m/s^2. Space = 0. */
  readonly surfaceGravity: number;
  /** Sea-level air density 0..1 (0 = no atmosphere / space). */
  readonly atmosphereDensity: number;
  readonly hasAtmosphere: boolean;
}
