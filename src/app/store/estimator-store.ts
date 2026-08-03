/**
 * Estimator store — the single source of UI truth for the "Estimate build" mode.
 *
 * This is the inverse of the analysis flow: instead of importing a finished
 * blueprint, the user declares their *essential* gear (drills, cargo, cockpit,
 * …) plus a few goals, and the pure engine (`estimateRequirements` from
 * `@core`) sizes the rest — thrusters per direction, power blocks, gyros.
 *
 * Design mirrors {@link useDesignStore}: this store holds only INPUTS (grid
 * size, the fixed-block list, planet, cargo, and the estimator config as block
 * *ids*). The {@link Estimate} itself is NOT cached here — it is cheap and
 * derived on demand by `useEstimate` from the current inputs, so every change
 * recomputes with no stale state to invalidate. Block ids (not resolved
 * definitions) are stored so the state stays plain/serializable, matching the
 * data layer's "plain serializable data" philosophy.
 *
 * The two stores are intentionally separate and never entangled.
 */
import { create } from 'zustand';
import { logger, type CargoLoadout, type Responsiveness } from '@core';
import type { GridSize } from '@data';

const log = logger.child({ module: 'estimator-store' });

/** A fixed ("essential") block the user committed to, stored by id + count. */
export interface FixedBlockRef {
  readonly id: string;
  readonly quantity: number;
}

/** Which kind of power block the estimator should size the count of. */
export type PowerKind = 'battery' | 'producer';

export interface EstimatorState {
  /** Grid scale the whole build targets; drives which blocks are selectable. */
  gridSize: GridSize;
  /** The essential gear, by block id + quantity. */
  fixedBlocks: readonly FixedBlockRef[];
  planetId: string;
  cargo: CargoLoadout;

  // --- Estimator config (block choices held as ids) ---
  targetTwr: number;
  lateralThrustFraction: number;
  thrusterId: string;
  powerKind: PowerKind;
  powerBlockId: string;
  runtimeTargetHours: number;
  responsiveness: Responsiveness;

  setGridSize: (gridSize: GridSize) => void;
  addBlock: (id: string) => void;
  removeBlock: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  setPlanet: (planetId: string) => void;
  setCargoFill: (fillFraction: number) => void;
  setCargoDensity: (densityKgPerL: number) => void;
  setTargetTwr: (targetTwr: number) => void;
  setLateralThrustFraction: (fraction: number) => void;
  setThruster: (id: string) => void;
  setPower: (kind: PowerKind, blockId: string) => void;
  setRuntimeTargetHours: (hours: number) => void;
  setResponsiveness: (responsiveness: Responsiveness) => void;
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
const DEFAULT_GRID: GridSize = 'large';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const atLeast = (v: number, min: number): number => (Number.isFinite(v) ? Math.max(min, v) : min);

export const useEstimatorStore = create<EstimatorState>((set, get) => ({
  gridSize: DEFAULT_GRID,
  fixedBlocks: [],
  planetId: 'earthlike',
  cargo: DEFAULT_CARGO,

  targetTwr: 2.0,
  lateralThrustFraction: 0.5,
  thrusterId: GRID_DEFAULTS[DEFAULT_GRID].thrusterId,
  powerKind: 'battery',
  powerBlockId: GRID_DEFAULTS[DEFAULT_GRID].batteryId,
  runtimeTargetHours: 0.5,
  responsiveness: 'normal',

  setGridSize: (gridSize) => {
    const current = get();
    if (current.gridSize === gridSize) return;
    const defaults = GRID_DEFAULTS[gridSize];
    // A grid switch invalidates block choices tied to the old grid. Reset the
    // config picks to this grid's defaults; the fixed-block picker (which
    // filters by grid) will drop mismatched essentials, so clear them too.
    const dropped = current.fixedBlocks.length;
    if (dropped > 0) {
      log.info('grid change cleared essentials for new grid size', {
        from: current.gridSize,
        to: gridSize,
        dropped,
      });
    }
    // Producer choices don't survive a grid switch cleanly (a producer id is
    // grid-specific); fall back to the battery default to stay valid.
    set({
      gridSize,
      fixedBlocks: [],
      thrusterId: defaults.thrusterId,
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

  setTargetTwr: (targetTwr) => set({ targetTwr: atLeast(targetTwr, 0.1) }),

  setLateralThrustFraction: (fraction) => set({ lateralThrustFraction: clamp01(fraction) }),

  setThruster: (id) => set({ thrusterId: id }),

  setPower: (kind, blockId) => set({ powerKind: kind, powerBlockId: blockId }),

  setRuntimeTargetHours: (hours) => set({ runtimeTargetHours: atLeast(hours, 0) }),

  setResponsiveness: (responsiveness) => set({ responsiveness }),

  reset: () =>
    set({
      gridSize: DEFAULT_GRID,
      fixedBlocks: [],
      planetId: 'earthlike',
      cargo: DEFAULT_CARGO,
      targetTwr: 2.0,
      lateralThrustFraction: 0.5,
      thrusterId: GRID_DEFAULTS[DEFAULT_GRID].thrusterId,
      powerKind: 'battery',
      powerBlockId: GRID_DEFAULTS[DEFAULT_GRID].batteryId,
      runtimeTargetHours: 0.5,
      responsiveness: 'normal',
    }),
}));
