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

/**
 * Space Engineers content packs. `'base'` is the DLC-free base game; every
 * other value is a purchasable DLC. Blocks are tagged with the pack that
 * introduces them so the UI can let players restrict the catalogue to what
 * they actually own (the DLC-selectable requirement). Cosmetic-only packs
 * (skins/armor) still appear here for completeness even though they add no
 * blocks that affect the physics math.
 *
 * Ordered by release. Verify names/coverage against the current game version
 * during the M1 data-audit before treating this list as authoritative.
 */
export type Dlc =
  | 'base'
  | 'deluxe'
  | 'decorative-1'
  | 'style'
  | 'economy'
  | 'decorative-2'
  | 'frostbite'
  | 'sparks-of-the-future'
  | 'wasteland'
  | 'warfare-1'
  | 'heavy-industry'
  | 'warfare-2'
  | 'automatons'
  | 'decorative-3'
  | 'anniversary-10yr'
  | 'signal'
  | 'contact'
  | 'fieldwork'
  | 'core-systems'
  | 'economy-2'
  | 'prosperity'
  | 'scrap-race'
  | 'apex-survival';

/** Display metadata for a content pack, used to build DLC filter UI. */
export interface DlcInfo {
  readonly id: Dlc;
  readonly displayName: string;
  /** False for cosmetic-only packs (skins/armor) that add no functional blocks. */
  readonly addsFunctionalBlocks: boolean;
}

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
  // Functional "payload" blocks the estimator sizes a ship around. Each adds
  // mass and (usually) power draw; some are the reason a ship exists (drills).
  | 'drill'
  | 'welder'
  | 'grinder'
  | 'connector'
  | 'conveyor'
  | 'light'
  | 'beacon'
  | 'antenna'
  | 'sensor'
  | 'control'
  | 'logic'
  | 'gas'
  | 'utility'
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
  /**
   * Content pack that introduces this block. `'base'` = DLC-free base game.
   * Drives the "restrict to owned DLC" filter.
   */
  readonly dlc: Dlc;
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
   * Max hydrogen fuel consumption at full thrust, liters/second. Only set for
   * hydrogen thrusters (electric thrusters omit it). Scales linearly with
   * throttle. Enables Phase 2 fuel-burn / flight-time math.
   */
  readonly maxHydrogenConsumption?: number;
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
  /**
   * Max hydrogen fuel consumption at full output, liters/second. Only set for
   * hydrogen engines. Enables fuel/runtime math for engine-powered ships.
   */
  readonly maxHydrogenConsumption?: number;
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

/**
 * Gyroscope — provides the torque that turns the grid. `maxTorque` (N·m) drives
 * the (approximate) turn-rate / gyro-count estimate, since exact turn rate needs
 * the ship's moment of inertia (unknown before the build).
 */
export interface GyroscopeBlock extends BlockBase {
  readonly category: 'gyroscope';
  /** Max torque output, N·m. */
  readonly maxTorque: number;
  /** Operational electrical draw, W. */
  readonly powerDraw: number;
}

/**
 * A functional "payload"/utility block that adds mass and draws power: drills,
 * welders, grinders, connectors, lights, beacons, antennas, sensors, control &
 * logic blocks, gas systems, etc. `maxPowerDraw` is the peak/operating draw, W
 * (0 for effectively passive blocks like conveyors, tanks, landing gear).
 * `variableDraw` flags blocks whose real draw scales with a setting (beacon /
 * antenna broadcast range, drill active vs idle) — we store the max.
 */
export interface UtilityBlock extends BlockBase {
  readonly category:
    | 'drill'
    | 'welder'
    | 'grinder'
    | 'connector'
    | 'conveyor'
    | 'light'
    | 'beacon'
    | 'antenna'
    | 'sensor'
    | 'control'
    | 'logic'
    | 'gas'
    | 'utility';
  /** Peak/operating electrical draw, W. */
  readonly maxPowerDraw: number;
  /** True when the block's real draw scales with a setting; we store the max. */
  readonly variableDraw?: boolean;
  /**
   * Stored gas capacity in liters — only for gas tanks (hydrogen/oxygen). Feeds
   * total-hydrogen-capacity and flight-time math.
   */
  readonly gasCapacity?: number;
  /**
   * Hydrogen output rate in liters/second — only for O2/H2 generators, which
   * convert ice to gas. Enables sustained-supply estimates.
   */
  readonly hydrogenOutput?: number;
}

/** Blocks that only add mass / draw idle power (structural, misc). */
export interface GenericBlock extends BlockBase {
  readonly category: 'structural' | 'other';
  /** Idle/operational electrical draw, W. */
  readonly powerDraw?: number;
}

export type BlockDefinition =
  | ThrusterBlock
  | CargoBlock
  | PowerProducerBlock
  | BatteryBlock
  | GyroscopeBlock
  | UtilityBlock
  | GenericBlock;

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
