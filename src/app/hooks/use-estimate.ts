/**
 * `useEstimate` — derives the requirement {@link Estimate} from estimator inputs.
 *
 * The estimator store holds only inputs (grid, fixed-block ids, planet, cargo,
 * the per-direction thruster stacks + goals, and the support config as block
 * ids). This hook resolves those ids to full block definitions from the merged
 * `BLOCKS_BY_ID` (curated + generated-from-definitions) so every block a
 * blueprint seed carried over — including generated `source:'definition'` blocks
 * like armor, conveyors, or Sci-Fi thrusters — resolves and contributes its real
 * mass. It assembles the {@link ManualEstimatorInput} and runs the pure engine
 * ({@link estimateManual}), memoized so every panel reads one consistent snapshot
 * and any input change recomputes everything at once.
 *
 * The estimator is **manual**: the user assigns thrusters per direction and the
 * engine sizes only power + gyros. Per-direction goal attainment is evaluated
 * here (via {@link evaluateGoal}) against the mass the user's load-state toggle
 * selects (empty vs loaded), so the panels can show reached/exceeded/short.
 *
 * Returns `null` when the support config is not yet resolvable (e.g. an unknown
 * power/gyro id), so the UI can fall back to an empty/guidance state.
 */
import { useMemo } from 'react';
import {
  estimateManual,
  estimateToDesign,
  directionalTwr,
  directionalThrust,
  evaluateGoal,
  rankThrusterTypes,
  weight,
  logger,
  DIRECTIONS,
  type Estimate,
  type ManualEstimatorConfig,
  type ManualEstimatorInput,
  type ThrusterLayout,
  type FixedBlockSpec,
  type PowerChoice,
  type DirectionalThrust,
  type ThrusterTypeSuggestion,
  type GoalVerdict,
  type ShipDesign,
} from '@core';
import {
  BLOCKS_BY_ID,
  VANILLA_BLOCKS,
  PLANET_PRESETS_BY_ID,
  STANDARD_GRAVITY,
  type BatteryBlock,
  type BlockDefinition,
  type Direction,
  type GyroscopeBlock,
  type PlanetPreset,
  type PowerProducerBlock,
  type ThrusterBlock,
} from '@data';
import {
  useEstimatorStore,
  GRID_DEFAULTS,
  type EstimatorState,
  type GoalLoadState,
} from '../store/estimator-store';

const log = logger.child({ module: 'use-estimate' });

/** Resolve a planet id to its preset, defaulting to Earthlike if unknown. */
export function resolvePlanet(planetId: string): PlanetPreset {
  return PLANET_PRESETS_BY_ID[planetId] ?? PLANET_PRESETS_BY_ID['earthlike']!;
}

/** A resolved fixed block plus a friendly display shape for the tally UI. */
export interface ResolvedFixedBlock {
  readonly id: string;
  readonly quantity: number;
  readonly definition: BlockDefinition;
}

/** A resolved thruster assignment for display — the definition plus its count. */
export interface ResolvedAssignment {
  readonly definition: ThrusterBlock;
  readonly count: number;
}

export interface EstimateResult {
  readonly estimate: Estimate;
  readonly planet: PlanetPreset;
  /**
   * The resolved per-direction thruster layout the user assigned — the stacks
   * (type × count) that drove the estimate, one array per direction (empty when
   * a direction has no thrusters). Unresolved ids are dropped (and logged).
   */
  readonly resolvedLayout: Record<Direction, readonly ResolvedAssignment[]>;
  /** The per-direction goals (TWR on a planet, g-multiple of accel in space). */
  readonly goals: Record<Direction, number>;
  /** Which mass the goal verdicts were checked against (empty vs loaded). */
  readonly goalLoadState: GoalLoadState;
  /**
   * Per-direction goal verdict at the chosen load-state mass — did the assigned
   * thrust reach / exceed / fall short of the direction's goal. Drives the inline
   * gauges and badges in the assignment surface + the TWR panel.
   */
  readonly goalVerdicts: Record<Direction, GoalVerdict>;
  /**
   * Ranked thruster-*type* suggestions per direction, sized against the current
   * build's chosen-load-state mass and that direction's goal — feasible types
   * first, then fewest thrusters, then least added mass. Powers the per-direction
   * "which type here?" chips. An honest snapshot at the current mass, not a
   * re-run of the fixed point per candidate.
   */
  readonly suggestions: Record<Direction, readonly ThrusterTypeSuggestion[]>;
  readonly gyro: GyroscopeBlock;
  readonly powerBlock: BatteryBlock | PowerProducerBlock;
  /**
   * Directional TWR of the build, empty (dry) vs fully loaded, computed by
   * running the trusted TWR engine on a synthesized design. This is the "can I
   * stay airborne tilted fully to one side?" readout.
   */
  readonly directional: { readonly empty: DirectionalThrust; readonly loaded: DirectionalThrust };
  /**
   * The synthesized {@link ShipDesign} the directional TWR was computed from —
   * the same object the Analyze engines consume. Exposed so Estimate-mode panels
   * (life support, combat) can run those trusted engines on the estimated build
   * instead of only on imported blueprints.
   */
  readonly design: ShipDesign;
  /** The resolved essentials (skipping any unknown ids), for the tally. */
  readonly resolvedFixed: readonly ResolvedFixedBlock[];
  /** Total mass of the essentials alone, kg. */
  readonly essentialsMass: number;
  /** Total essential block count. */
  readonly essentialsCount: number;
  /** True when the user has added no essentials AND no thrusters yet (empty state). */
  readonly isEmpty: boolean;
}

/** Narrow a definition to a thruster, or null. */
function asThruster(def: BlockDefinition | undefined): ThrusterBlock | null {
  return def?.category === 'thruster' ? def : null;
}
/** Narrow a definition to a gyroscope, or null. */
function asGyro(def: BlockDefinition | undefined): GyroscopeBlock | null {
  return def?.category === 'gyroscope' ? def : null;
}
/** Narrow a definition to a battery, or null. */
function asBattery(def: BlockDefinition | undefined): BatteryBlock | null {
  return def?.category === 'battery' ? def : null;
}
/** Narrow a definition to a power producer, or null. */
function asProducer(def: BlockDefinition | undefined): PowerProducerBlock | null {
  if (!def) return null;
  return def.category === 'reactor' ||
    def.category === 'solar' ||
    def.category === 'hydrogen-engine' ||
    def.category === 'wind-turbine'
    ? def
    : null;
}

/** Build the resolved essentials list, dropping (and logging) unknown ids. */
function resolveFixed(fixedBlocks: EstimatorState['fixedBlocks']): ResolvedFixedBlock[] {
  const resolved: ResolvedFixedBlock[] = [];
  for (const ref of fixedBlocks) {
    const definition = BLOCKS_BY_ID[ref.id];
    if (!definition) {
      log.warn('essential block id did not resolve; skipping', {
        id: ref.id,
        ai: {
          actionable: false,
          suggestion: 'A stale/unknown block id was in the essentials list; it is ignored.',
          severity_reason: 'A single unresolved essential should not break the whole estimate.',
        },
      });
      continue;
    }
    resolved.push({ id: ref.id, quantity: ref.quantity, definition });
  }
  return resolved;
}

/**
 * Resolve the store's per-direction thruster stacks (ids + counts) into a
 * {@link ThrusterLayout} of resolved definitions. Entries whose id doesn't
 * resolve to a real thruster of any kind are dropped (and logged) so one stale id
 * never nulls the estimate.
 */
function resolveLayout(
  stacks: EstimatorState['thrusterStacks'],
): Record<Direction, ResolvedAssignment[]> {
  const out = {} as Record<Direction, ResolvedAssignment[]>;
  for (const dir of DIRECTIONS) {
    const resolved: ResolvedAssignment[] = [];
    for (const entry of stacks[dir]) {
      const thruster = asThruster(BLOCKS_BY_ID[entry.blockId]);
      if (!thruster) {
        log.warn('assigned thruster id did not resolve; dropping from layout', {
          id: entry.blockId,
          dir,
          ai: {
            actionable: false,
            suggestion: 'A stale/unknown thruster id was assigned; it is ignored.',
            severity_reason: 'A single unresolved thruster should not break the estimate.',
          },
        });
        continue;
      }
      if (entry.count > 0) resolved.push({ definition: thruster, count: entry.count });
    }
    out[dir] = resolved;
  }
  return out;
}

export function useEstimate(): EstimateResult | null {
  const gridSize = useEstimatorStore((s) => s.gridSize);
  const fixedBlocks = useEstimatorStore((s) => s.fixedBlocks);
  const planetId = useEstimatorStore((s) => s.planetId);
  const cargo = useEstimatorStore((s) => s.cargo);
  const thrusterStacks = useEstimatorStore((s) => s.thrusterStacks);
  const directionGoals = useEstimatorStore((s) => s.directionGoals);
  const goalLoadState = useEstimatorStore((s) => s.goalLoadState);
  const powerKind = useEstimatorStore((s) => s.powerKind);
  const powerBlockId = useEstimatorStore((s) => s.powerBlockId);
  const runtimeTargetHours = useEstimatorStore((s) => s.runtimeTargetHours);
  const responsiveness = useEstimatorStore((s) => s.responsiveness);

  return useMemo(() => {
    const defaults = GRID_DEFAULTS[gridSize];

    // Resolve the support config's block choices, falling back to grid defaults
    // so an unknown/stale id never produces a null estimate. The merged dataset
    // resolves both curated defaults and generated block ids a blueprint seed may
    // have chosen as the dominant power block.
    const gyro =
      asGyro(BLOCKS_BY_ID[defaults.gyroId]) ?? asGyro(BLOCKS_BY_ID['large-gyroscope']);
    let power: PowerChoice | null = null;
    let powerBlock: BatteryBlock | PowerProducerBlock | null = null;
    if (powerKind === 'battery') {
      const battery =
        asBattery(BLOCKS_BY_ID[powerBlockId]) ?? asBattery(BLOCKS_BY_ID[defaults.batteryId]);
      if (battery) {
        power = { kind: 'battery', block: battery };
        powerBlock = battery;
      }
    } else {
      const producer = asProducer(BLOCKS_BY_ID[powerBlockId]);
      if (producer) {
        power = { kind: 'producer', block: producer };
        powerBlock = producer;
      }
    }
    // If a producer id failed to resolve, fall back to the grid's battery so the
    // panel still renders a coherent estimate rather than nothing.
    if (!power || !powerBlock) {
      const battery = asBattery(BLOCKS_BY_ID[defaults.batteryId]);
      if (battery) {
        power = { kind: 'battery', block: battery };
        powerBlock = battery;
      }
    }

    if (!gyro || !power || !powerBlock) {
      log.error('could not resolve core estimator support blocks', {
        powerBlockId,
        gridSize,
        ai: {
          actionable: true,
          suggestion: 'Verify GRID_DEFAULTS ids exist in VANILLA_BLOCKS.',
          severity_reason: 'Without a power/gyro block there is nothing to size support against.',
        },
      });
      return null;
    }

    const resolvedFixed = resolveFixed(fixedBlocks);
    const essentialsMass = resolvedFixed.reduce(
      (sum, b) => sum + b.definition.mass * b.quantity,
      0,
    );
    const essentialsCount = resolvedFixed.reduce((sum, b) => sum + b.quantity, 0);

    const fixedSpecs: FixedBlockSpec[] = resolvedFixed.map((b) => ({
      definition: b.definition,
      quantity: b.quantity,
    }));

    // Resolve the user's per-direction thruster stacks into the engine layout.
    const resolvedLayout = resolveLayout(thrusterStacks);
    const layout = {} as ThrusterLayout;
    for (const dir of DIRECTIONS) {
      layout[dir] = resolvedLayout[dir].map((a) => ({ definition: a.definition, count: a.count }));
    }

    const config: ManualEstimatorConfig = {
      thrusterLayout: layout,
      power,
      runtimeTargetHours,
      gyro,
      responsiveness,
    };

    const planet = resolvePlanet(planetId);
    const input: ManualEstimatorInput = {
      fixedBlocks: fixedSpecs,
      planet,
      cargo,
      gridSize,
      config,
    };
    const estimate = estimateManual(input);

    // Run the trusted TWR engine on a synthesized design so the Estimate view
    // shows the same directional TWR bars as Analyze — empty and fully loaded.
    const design = estimateToDesign(input, estimate, planetId);
    const directional = {
      empty: directionalTwr(design, planet, estimate.dryMass),
      loaded: directionalTwr(design, planet, estimate.loadedMass),
    };

    // Per-direction goal verdicts at the chosen load-state mass. Thrust is the
    // real environment-adjusted directional thrust of the synthesized build
    // (mixed types already summed by directionalThrust); evaluateGoal handles the
    // planet-vs-space reinterpretation of the goal number.
    const goalMass = goalLoadState === 'empty' ? estimate.dryMass : estimate.loadedMass;
    const thrustAtEnv = directionalThrust(design, planet.atmosphereDensity);
    const goalVerdicts = {} as Record<Direction, GoalVerdict>;
    for (const dir of DIRECTIONS) {
      goalVerdicts[dir] = evaluateGoal({
        goal: directionGoals[dir],
        thrust: thrustAtEnv[dir],
        mass: goalMass,
        gravity: planet.surfaceGravity,
      });
    }

    // Rank the thruster *types* per direction against the chosen-load-state mass,
    // using each direction's goal as the required-thrust target (up = goal ×
    // weight on a planet, or goal × g₀ × mass in space; same for every axis since
    // each has its own goal). The candidate set is every thruster of the current
    // grid — the ranker reduces each type to its least-added-mass variant.
    const candidates = VANILLA_BLOCKS.filter(
      (b): b is ThrusterBlock => b.category === 'thruster' && b.gridSize === gridSize,
    );
    const g = planet.surfaceGravity;
    const suggestions = {} as Record<Direction, readonly ThrusterTypeSuggestion[]>;
    for (const dir of DIRECTIONS) {
      const goal = directionGoals[dir];
      const need = g > 0 ? goal * weight(goalMass, g) : goal * STANDARD_GRAVITY * goalMass;
      suggestions[dir] = rankThrusterTypes(candidates, planet, need);
    }

    return {
      estimate,
      planet,
      resolvedLayout,
      goals: directionGoals,
      goalLoadState,
      goalVerdicts,
      suggestions,
      gyro,
      powerBlock,
      directional,
      design,
      resolvedFixed,
      essentialsMass,
      essentialsCount,
      isEmpty: resolvedFixed.length === 0 && DIRECTIONS.every((d) => resolvedLayout[d].length === 0),
    };
  }, [
    gridSize,
    fixedBlocks,
    planetId,
    cargo,
    thrusterStacks,
    directionGoals,
    goalLoadState,
    powerKind,
    powerBlockId,
    runtimeTargetHours,
    responsiveness,
  ]);
}
