/**
 * Estimator store — the single source of UI truth for the "Estimate build" mode.
 *
 * This is the inverse of the analysis flow: instead of importing a finished
 * blueprint, the user *drives the build themselves* — they declare their
 * essential gear (drills, cargo, cockpit, …), then assign thrusters per
 * direction against a per-direction goal, and the pure engine
 * (`estimateManual` from `@core`) sizes only the support hardware (power blocks
 * and gyros) against that fixed thruster set.
 *
 * Design mirrors {@link useDesignStore}: this store holds only INPUTS (grid
 * size, the fixed-block list, planet, cargo, the per-direction thruster stacks,
 * the per-direction goals, and the power/gyro config as block *ids*). The
 * {@link Estimate} itself is NOT cached here — it is cheap and derived on demand
 * by `useEstimate` from the current inputs, so every change recomputes with no
 * stale state to invalidate. Block ids (not resolved definitions) are stored so
 * the state stays plain/serializable, matching the data layer's "plain
 * serializable data" philosophy.
 *
 * The two stores are intentionally separate and never entangled.
 */
import { create } from 'zustand';
import {
  logger,
  createCorrelationId,
  AuditLogger,
  InMemoryAuditStore,
  designToEstimateSeed,
  type CargoLoadout,
  type ExtraMass,
  type ShipDesign,
  type SkippedSeedBlock,
} from '@core';
import type { GridSize, Direction } from '@data';

const log = logger.child({ module: 'estimator-store' });

/** Append-only audit trail for estimator actions (seeding from a blueprint). */
export const estimatorAuditStore = new InMemoryAuditStore();
const audit = new AuditLogger(estimatorAuditStore, logger);

/** A fixed ("essential") block the user committed to, stored by id + count. */
export interface FixedBlockRef {
  readonly id: string;
  readonly quantity: number;
}

/** One assigned thruster type + count within a single direction, by id. */
export interface ThrusterStackEntry {
  readonly blockId: string;
  readonly count: number;
}

/** Per-direction thruster stacks (empty array = no thrusters on that axis). */
export type ThrusterStacks = Record<Direction, readonly ThrusterStackEntry[]>;

/** Per-direction goal (read as TWR on a planet, g-multiple of accel in space). */
export type DirectionGoals = Record<Direction, number>;

/** Which mass the per-direction goal verdict is checked against. */
export type GoalLoadState = 'empty' | 'loaded';

/** Which kind of power block the estimator should size the count of. */
export type PowerKind = 'battery' | 'producer';

const ALL_DIRECTIONS: readonly Direction[] = [
  'up',
  'down',
  'forward',
  'backward',
  'left',
  'right',
];

export interface EstimatorState {
  /** Grid scale the whole build targets; drives which blocks are selectable. */
  gridSize: GridSize;
  /** The essential gear, by block id + quantity. */
  fixedBlocks: readonly FixedBlockRef[];
  planetId: string;
  cargo: CargoLoadout;
  /** Freeform extra mass (docked ship / bolted-on module + hauled payload). */
  extraMass: ExtraMass;
  /** World inventory-size multiplier (Realistic ×1 / ×3 / ×10). Scales capacity. */
  inventoryMultiplier: number;

  // --- Manual thruster assignment ---
  /** Per-direction assigned thruster types + counts (the build the user drives). */
  thrusterStacks: ThrusterStacks;
  /** Per-direction target (TWR on a planet, g-multiple of accel in space). */
  directionGoals: DirectionGoals;
  /** Whether goal verdicts are checked at empty or loaded mass (default loaded). */
  goalLoadState: GoalLoadState;

  // --- Support config (block choices held as ids) ---
  powerKind: PowerKind;
  powerBlockId: string;
  runtimeTargetHours: number;
  /** Target time to turn the ship 90° from rest, seconds — drives the gyro count. */
  targetTurnTime: number;

  /**
   * The design this build was seeded from, kept as an immutable snapshot so the
   * UI can show an "adjusted vs. source" indicator and offer a one-click reset.
   * `null` for a hand-started build (never seeded from a blueprint).
   */
  sourceDesign: ShipDesign | null;
  /** Source label (filename/example name) of {@link sourceDesign}. */
  sourceName: string | null;
  /** Blocks that couldn't be carried over on the last seed (modded/unrecognized). */
  lastSeedSkipped: readonly SkippedSeedBlock[];

  setGridSize: (gridSize: GridSize) => void;
  addBlock: (id: string) => void;
  removeBlock: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  setPlanet: (planetId: string) => void;
  setCargoFill: (fillFraction: number) => void;
  setCargoDensity: (densityKgPerL: number) => void;
  /** Set the always-on additional mass (counts empty AND loaded), kg. */
  setAddedMass: (kg: number) => void;
  /** Set the loaded-only extra payload (counts only loaded), kg. */
  setExtraPayload: (kg: number) => void;
  /** Set the world inventory-size multiplier (×1 / ×3 / ×10); clamped ≥ 0. */
  setInventoryMultiplier: (multiplier: number) => void;
  /** Add one of `blockId` to `dir`'s stack (bumps count if already present). */
  addThruster: (dir: Direction, blockId: string) => void;
  /** Remove `blockId` from `dir`'s stack entirely. */
  removeThruster: (dir: Direction, blockId: string) => void;
  /** Set the count of `blockId` in `dir` (floored; ≤0 removes the entry). */
  setThrusterCount: (dir: Direction, blockId: string, count: number) => void;
  /** Set the per-direction goal (TWR / g-multiple), floored at 0. */
  setDirectionGoal: (dir: Direction, goal: number) => void;
  /** Choose whether goal verdicts read empty or loaded mass. */
  setGoalLoadState: (state: GoalLoadState) => void;
  setPower: (kind: PowerKind, blockId: string) => void;
  setRuntimeTargetHours: (hours: number) => void;
  /** Set the target 90°-turn time (seconds), clamped to a sane [0.25, 60] range. */
  setTargetTurnTime: (seconds: number) => void;
  /**
   * Seed the whole build from an imported design in one atomic update: grid,
   * essentials (real counts), the real per-direction thruster layout, and the
   * power config choice. Snapshots the source for the adjusted/reset affordance.
   * Goals and load-state are UI targets, not part of the ship, so they are NOT
   * seeded. Never mutates the source design.
   */
  seedFromDesign: (design: ShipDesign, sourceName: string) => void;
  /** Re-seed from the stored source snapshot (one-click "back to as-imported"). */
  resetToSource: () => void;
  reset: () => void;
}

/** Sensible per-grid defaults for the config's block choices. */
export interface GridDefaults {
  readonly thrusterId: string;
  readonly batteryId: string;
  readonly gyroId: string;
}

/**
 * Default block choices per grid. Hydrogen thrusters are the safe default (they
 * work in atmosphere AND vacuum), batteries the simplest power source. These
 * ids exist in {@link VANILLA_BLOCKS}; the picker lets the user change them.
 * `thrusterId` is now only the UI's default "add thruster" pick, not an
 * auto-solved model.
 */
export const GRID_DEFAULTS: Record<GridSize, GridDefaults> = {
  large: {
    thrusterId: 'large-small-hydrogen-thruster',
    batteryId: 'large-battery',
    gyroId: 'large-gyroscope',
  },
  small: {
    thrusterId: 'small-small-hydrogen-thruster',
    batteryId: 'small-battery',
    gyroId: 'small-gyroscope',
  },
};

const DEFAULT_CARGO: CargoLoadout = { fillFraction: 0, densityKgPerL: 2.0 };
const DEFAULT_EXTRA_MASS: ExtraMass = { added: 0, payload: 0 };
const DEFAULT_INVENTORY_MULTIPLIER = 1;
const DEFAULT_GRID: GridSize = 'large';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const atLeast = (v: number, min: number): number => (Number.isFinite(v) ? Math.max(min, v) : min);

/** Default target time to turn the ship 90° from rest (seconds). */
const DEFAULT_TARGET_TURN_TIME = 2.5;
/** Bounds on the turn-time target: fast enough to be meaningful, slow enough to be real. */
const TURN_TIME_MIN = 0.25;
const TURN_TIME_MAX = 60;
const clampTurnTime = (v: number): number =>
  Number.isFinite(v)
    ? Math.min(TURN_TIME_MAX, Math.max(TURN_TIME_MIN, v))
    : DEFAULT_TARGET_TURN_TIME;

/** An empty per-direction thruster-stacks map. */
export function emptyStacks(): ThrusterStacks {
  return { up: [], down: [], forward: [], backward: [], left: [], right: [] };
}

/**
 * Default per-direction goals: 2.0 up (a fighter wants to clear ground fast),
 * 1.0 everywhere else (hover / not fall) — a sane starting target the user tunes.
 */
export function defaultGoals(): DirectionGoals {
  return { up: 2.0, down: 1.0, forward: 1.0, backward: 1.0, left: 1.0, right: 1.0 };
}

/** Convert a seed's per-direction stacks to the store's shape (id → count). */
function stacksFromSeed(seedStacks: Record<Direction, readonly { blockId: string; count: number }[]>): ThrusterStacks {
  const out = emptyStacks() as Record<Direction, ThrusterStackEntry[]>;
  for (const dir of ALL_DIRECTIONS) {
    out[dir] = seedStacks[dir].map((e) => ({ blockId: e.blockId, count: e.count }));
  }
  return out;
}

export const useEstimatorStore = create<EstimatorState>((set, get) => ({
  gridSize: DEFAULT_GRID,
  fixedBlocks: [],
  planetId: 'earthlike',
  cargo: DEFAULT_CARGO,
  extraMass: DEFAULT_EXTRA_MASS,
  inventoryMultiplier: DEFAULT_INVENTORY_MULTIPLIER,

  thrusterStacks: emptyStacks(),
  directionGoals: defaultGoals(),
  goalLoadState: 'loaded',

  powerKind: 'battery',
  powerBlockId: GRID_DEFAULTS[DEFAULT_GRID].batteryId,
  runtimeTargetHours: 0.5,
  targetTurnTime: DEFAULT_TARGET_TURN_TIME,

  sourceDesign: null,
  sourceName: null,
  lastSeedSkipped: [],

  setGridSize: (gridSize) => {
    const current = get();
    if (current.gridSize === gridSize) return;
    const defaults = GRID_DEFAULTS[gridSize];
    // A grid switch invalidates block choices tied to the old grid. Reset the
    // config picks to this grid's defaults; the fixed-block picker (which
    // filters by grid) will drop mismatched essentials, so clear them too. The
    // thruster stacks hold old-grid ids, so clear them as well; goals and
    // load-state are grid-agnostic UI targets and survive.
    const dropped = current.fixedBlocks.length;
    if (dropped > 0) {
      log.info('grid change cleared essentials for new grid size', {
        from: current.gridSize,
        to: gridSize,
        dropped,
      });
    }
    set({
      gridSize,
      fixedBlocks: [],
      thrusterStacks: emptyStacks(),
      powerKind: 'battery',
      powerBlockId: defaults.batteryId,
    });
  },

  addBlock: (id) => {
    const { fixedBlocks } = get();
    const existing = fixedBlocks.find((b) => b.id === id);
    if (existing) {
      // Adding an already-present block just bumps its count by one.
      set({
        fixedBlocks: fixedBlocks.map((b) =>
          b.id === id ? { id, quantity: b.quantity + 1 } : b,
        ),
      });
      return;
    }
    set({ fixedBlocks: [...fixedBlocks, { id, quantity: 1 }] });
  },

  removeBlock: (id) => {
    set({ fixedBlocks: get().fixedBlocks.filter((b) => b.id !== id) });
  },

  setQuantity: (id, quantity) => {
    const qty = Math.max(0, Math.floor(quantity));
    const { fixedBlocks } = get();
    if (qty <= 0) {
      // Zeroing a quantity removes the block entirely.
      set({ fixedBlocks: fixedBlocks.filter((b) => b.id !== id) });
      return;
    }
    set({
      fixedBlocks: fixedBlocks.map((b) => (b.id === id ? { id, quantity: qty } : b)),
    });
  },

  setPlanet: (planetId) => set({ planetId }),

  setCargoFill: (fillFraction) =>
    set({ cargo: { ...get().cargo, fillFraction: clamp01(fillFraction) } }),

  setCargoDensity: (densityKgPerL) =>
    set({ cargo: { ...get().cargo, densityKgPerL: atLeast(densityKgPerL, 0) } }),

  setAddedMass: (kg) => set({ extraMass: { ...get().extraMass, added: atLeast(kg, 0) } }),

  setExtraPayload: (kg) => set({ extraMass: { ...get().extraMass, payload: atLeast(kg, 0) } }),

  setInventoryMultiplier: (multiplier) => set({ inventoryMultiplier: atLeast(multiplier, 0) }),

  addThruster: (dir, blockId) => {
    const { thrusterStacks } = get();
    const stack = thrusterStacks[dir];
    const existing = stack.find((e) => e.blockId === blockId);
    const nextStack = existing
      ? stack.map((e) => (e.blockId === blockId ? { blockId, count: e.count + 1 } : e))
      : [...stack, { blockId, count: 1 }];
    set({ thrusterStacks: { ...thrusterStacks, [dir]: nextStack } });
  },

  removeThruster: (dir, blockId) => {
    const { thrusterStacks } = get();
    set({
      thrusterStacks: {
        ...thrusterStacks,
        [dir]: thrusterStacks[dir].filter((e) => e.blockId !== blockId),
      },
    });
  },

  setThrusterCount: (dir, blockId, count) => {
    const qty = Math.max(0, Math.floor(count));
    const { thrusterStacks } = get();
    const stack = thrusterStacks[dir];
    if (qty <= 0) {
      set({
        thrusterStacks: {
          ...thrusterStacks,
          [dir]: stack.filter((e) => e.blockId !== blockId),
        },
      });
      return;
    }
    const existing = stack.find((e) => e.blockId === blockId);
    const nextStack = existing
      ? stack.map((e) => (e.blockId === blockId ? { blockId, count: qty } : e))
      : [...stack, { blockId, count: qty }];
    set({ thrusterStacks: { ...thrusterStacks, [dir]: nextStack } });
  },

  setDirectionGoal: (dir, goal) =>
    set({ directionGoals: { ...get().directionGoals, [dir]: atLeast(goal, 0) } }),

  setGoalLoadState: (goalLoadState) => set({ goalLoadState }),

  setPower: (kind, blockId) => set({ powerKind: kind, powerBlockId: blockId }),

  setRuntimeTargetHours: (hours) => set({ runtimeTargetHours: atLeast(hours, 0) }),

  setTargetTurnTime: (seconds) => set({ targetTurnTime: clampTurnTime(seconds) }),

  seedFromDesign: (design, sourceName) => {
    const correlationId = createCorrelationId();
    const seed = designToEstimateSeed(design);
    const defaults = GRID_DEFAULTS[seed.gridSize];

    // One atomic update — never composed from setGridSize/addBlock, which would
    // clear essentials and bump counts one-by-one. The thruster stacks carry the
    // ship's REAL per-direction layout (mixed types preserved). A null dominant
    // power block falls back to the grid default battery. Goals/load-state are UI
    // targets, not part of the imported ship, so they are left untouched.
    set({
      gridSize: seed.gridSize,
      fixedBlocks: seed.fixedBlocks.map((b) => ({ id: b.id, quantity: b.quantity })),
      planetId: seed.planetId,
      cargo: seed.cargo,
      extraMass: seed.extraMass ?? DEFAULT_EXTRA_MASS,
      inventoryMultiplier: seed.inventorySizeMultiplier ?? DEFAULT_INVENTORY_MULTIPLIER,
      thrusterStacks: stacksFromSeed(seed.thrusterStacks),
      powerKind: seed.powerKind,
      powerBlockId: seed.powerBlockId ?? defaults.batteryId,
      sourceDesign: design,
      sourceName,
      lastSeedSkipped: seed.skipped,
    });

    const seededThrusterCount = ALL_DIRECTIONS.reduce(
      (n, d) => n + seed.thrusterStacks[d].length,
      0,
    );
    log.info('estimator seeded from design', {
      correlationId,
      sourceName,
      gridSize: seed.gridSize,
      essentials: seed.fixedBlocks.length,
      thrusterStackEntries: seededThrusterCount,
      powerBlockId: seed.powerBlockId,
      skipped: seed.skipped.length,
    });

    // Best-effort audit trail; a logging failure must never break seeding.
    void audit
      .record({
        action: 'estimate.seed',
        entityType: 'design',
        entityId: design.id,
        after: {
          name: design.name,
          gridSize: seed.gridSize,
          essentials: seed.fixedBlocks.length,
          skipped: seed.skipped.length,
        },
        metadata: { sourceName },
        correlationId,
      })
      .catch(() => {
        /* audit sink swallows its own errors; nothing actionable here */
      });
  },

  resetToSource: () => {
    const { sourceDesign, sourceName } = get();
    if (!sourceDesign) return;
    get().seedFromDesign(sourceDesign, sourceName ?? sourceDesign.name);
  },

  reset: () =>
    set({
      gridSize: DEFAULT_GRID,
      fixedBlocks: [],
      planetId: 'earthlike',
      cargo: DEFAULT_CARGO,
      extraMass: DEFAULT_EXTRA_MASS,
      inventoryMultiplier: DEFAULT_INVENTORY_MULTIPLIER,
      thrusterStacks: emptyStacks(),
      directionGoals: defaultGoals(),
      goalLoadState: 'loaded',
      powerKind: 'battery',
      powerBlockId: GRID_DEFAULTS[DEFAULT_GRID].batteryId,
      runtimeTargetHours: 0.5,
      targetTurnTime: DEFAULT_TARGET_TURN_TIME,
      sourceDesign: null,
      sourceName: null,
      lastSeedSkipped: [],
    }),
}));

/** Compare two thruster stacks as id→count multisets (order-independent). */
function stacksEqual(
  a: readonly ThrusterStackEntry[],
  b: readonly { blockId: string; count: number }[],
): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((e) => [e.blockId, e.count]));
  for (const e of a) {
    if (byId.get(e.blockId) !== e.count) return false;
  }
  return true;
}

/**
 * Whether the current build has diverged from the design it was seeded from.
 *
 * Derived (not stored) so it is always correct: re-derives the seed the source
 * *would* produce and compares the parts the seed controls — grid, the essentials
 * multiset, the per-direction thruster stacks, the power config choice, planet,
 * and cargo. The per-direction **goals** and the **load-state** toggle are
 * intentionally excluded: they are UI targets the user picks, not part of the
 * imported ship, so tuning a goal never flips "adjusted". When there is no
 * source snapshot, a build can't be "adjusted from" anything → false.
 */
export function isAdjustedFromSource(state: EstimatorState): boolean {
  const { sourceDesign } = state;
  if (!sourceDesign) return false;
  const seed = designToEstimateSeed(sourceDesign);
  const defaults = GRID_DEFAULTS[seed.gridSize];

  if (state.gridSize !== seed.gridSize) return true;
  if (state.planetId !== seed.planetId) return true;
  if (state.cargo.fillFraction !== seed.cargo.fillFraction) return true;
  if (state.cargo.densityKgPerL !== seed.cargo.densityKgPerL) return true;
  // Extra mass is a seeded ship property (like cargo): changing it is an
  // adjustment. A source with no extra mass seeds the zero default.
  const seedExtra = seed.extraMass ?? DEFAULT_EXTRA_MASS;
  if (state.extraMass.added !== seedExtra.added) return true;
  if (state.extraMass.payload !== seedExtra.payload) return true;
  // World inventory multiplier is likewise a seeded ship property; changing it
  // (×1 → ×3, etc.) counts as an adjustment. A source at the default seeds ×1.
  const seedMultiplier = seed.inventorySizeMultiplier ?? DEFAULT_INVENTORY_MULTIPLIER;
  if (state.inventoryMultiplier !== seedMultiplier) return true;

  // Per-direction thruster stacks must match as id→count multisets.
  for (const dir of ALL_DIRECTIONS) {
    if (!stacksEqual(state.thrusterStacks[dir], seed.thrusterStacks[dir])) return true;
  }

  const seededPowerId = seed.powerBlockId ?? defaults.batteryId;
  if (state.powerKind !== seed.powerKind || state.powerBlockId !== seededPowerId) return true;

  // Essentials multiset (id → quantity) must match exactly.
  if (state.fixedBlocks.length !== seed.fixedBlocks.length) return true;
  const seededById = new Map(seed.fixedBlocks.map((b) => [b.id, b.quantity]));
  for (const b of state.fixedBlocks) {
    if (seededById.get(b.id) !== b.quantity) return true;
  }
  return false;
}
