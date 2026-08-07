/**
 * `useEstimate` — derives the requirement {@link Estimate} from estimator inputs.
 *
 * The estimator store holds only inputs (grid, fixed-block ids, planet, cargo,
 * config as block ids). This hook resolves those ids to full block definitions
 * from `VANILLA_BLOCKS_BY_ID`, assembles the {@link EstimatorInput}, and runs
 * the pure engine — memoized so every panel reads one consistent snapshot and
 * any input change recomputes everything at once.
 *
 * Returns `null` when the config is not yet resolvable (e.g. an unknown block
 * id), so the UI can fall back to an empty/guidance state instead of crashing.
 */
import { useMemo } from 'react';
import {
  estimateRequirements,
  estimateToDesign,
  directionalTwr,
  uniformThrusters,
  logger,
  DIRECTIONS,
  type Estimate,
  type EstimatorConfig,
  type EstimatorInput,
  type FixedBlockSpec,
  type PowerChoice,
  type DirectionalThrust,
} from '@core';
import {
  VANILLA_BLOCKS_BY_ID,
  PLANET_PRESETS_BY_ID,
  type BatteryBlock,
  type BlockDefinition,
  type Direction,
  type GyroscopeBlock,
  type PlanetPreset,
  type PowerProducerBlock,
  type ThrusterBlock,
} from '@data';
import { useEstimatorStore, GRID_DEFAULTS, type EstimatorState } from '../store/estimator-store';

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

export interface EstimateResult {
  readonly estimate: Estimate;
  readonly planet: PlanetPreset;
  /**
   * The resolved thruster type per direction. When no per-direction overrides
   * are set these are all the same (base) thruster; overrides pin individual
   * directions to a different type (e.g. atmospheric vertical, ion sides).
   */
  readonly thrusters: Record<Direction, ThrusterBlock>;
  /** The base (default) thruster — the type used for any un-overridden direction. */
  readonly thruster: ThrusterBlock;
  readonly gyro: GyroscopeBlock;
  readonly powerBlock: BatteryBlock | PowerProducerBlock;
  /**
   * Directional TWR of the recommended build, empty (dry) vs fully loaded,
   * computed by running the trusted TWR engine on a synthesized design. This is
   * the "can I stay airborne tilted fully to one side?" readout.
   */
  readonly directional: { readonly empty: DirectionalThrust; readonly loaded: DirectionalThrust };
  /** The resolved essentials (skipping any unknown ids), for the tally. */
  readonly resolvedFixed: readonly ResolvedFixedBlock[];
  /** Total mass of the essentials alone, kg. */
  readonly essentialsMass: number;
  /** Total essential block count. */
  readonly essentialsCount: number;
  /** True when the user has added no essentials yet (empty state). */
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
    const definition = VANILLA_BLOCKS_BY_ID[ref.id];
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

export function useEstimate(): EstimateResult | null {
  const gridSize = useEstimatorStore((s) => s.gridSize);
  const fixedBlocks = useEstimatorStore((s) => s.fixedBlocks);
  const planetId = useEstimatorStore((s) => s.planetId);
  const cargo = useEstimatorStore((s) => s.cargo);
  const targetTwr = useEstimatorStore((s) => s.targetTwr);
  const lateralThrustFraction = useEstimatorStore((s) => s.lateralThrustFraction);
  const thrusterId = useEstimatorStore((s) => s.thrusterId);
  const thrusterOverrides = useEstimatorStore((s) => s.thrusterOverrides);
  const powerKind = useEstimatorStore((s) => s.powerKind);
  const powerBlockId = useEstimatorStore((s) => s.powerBlockId);
  const runtimeTargetHours = useEstimatorStore((s) => s.runtimeTargetHours);
  const responsiveness = useEstimatorStore((s) => s.responsiveness);

  return useMemo(() => {
    const defaults = GRID_DEFAULTS[gridSize];

    // Resolve the config's block choices, falling back to grid defaults so an
    // unknown/stale id never produces a null estimate the user can't recover from.
    const thruster =
      asThruster(VANILLA_BLOCKS_BY_ID[thrusterId]) ??
      asThruster(VANILLA_BLOCKS_BY_ID[defaults.thrusterId]);
    const gyro =
      asGyro(VANILLA_BLOCKS_BY_ID[defaults.gyroId]) ??
      asGyro(VANILLA_BLOCKS_BY_ID['large-gyroscope']);
    let power: PowerChoice | null = null;
    let powerBlock: BatteryBlock | PowerProducerBlock | null = null;
    if (powerKind === 'battery') {
      const battery = asBattery(VANILLA_BLOCKS_BY_ID[powerBlockId]) ?? asBattery(VANILLA_BLOCKS_BY_ID[defaults.batteryId]);
      if (battery) {
        power = { kind: 'battery', block: battery };
        powerBlock = battery;
      }
    } else {
      const producer = asProducer(VANILLA_BLOCKS_BY_ID[powerBlockId]);
      if (producer) {
        power = { kind: 'producer', block: producer };
        powerBlock = producer;
      }
    }
    // If a producer id failed to resolve, fall back to the grid's battery so the
    // panel still renders a coherent estimate rather than nothing.
    if (!power || !powerBlock) {
      const battery = asBattery(VANILLA_BLOCKS_BY_ID[defaults.batteryId]);
      if (battery) {
        power = { kind: 'battery', block: battery };
        powerBlock = battery;
      }
    }

    if (!thruster || !gyro || !power || !powerBlock) {
      log.error('could not resolve core estimator blocks', {
        thrusterId,
        powerBlockId,
        gridSize,
        ai: {
          actionable: true,
          suggestion: 'Verify GRID_DEFAULTS ids exist in VANILLA_BLOCKS.',
          severity_reason: 'Without a thruster/power/gyro block there is nothing to size.',
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

    // Per-direction thruster types: each direction falls back to the base
    // thruster unless the user pinned an override (which must still resolve to a
    // real thruster of the current grid — otherwise the base is used).
    const thrusters: Record<Direction, ThrusterBlock> = uniformThrusters(thruster);
    for (const dir of DIRECTIONS) {
      const overrideId = thrusterOverrides[dir];
      if (overrideId === undefined) continue;
      const override = asThruster(VANILLA_BLOCKS_BY_ID[overrideId]);
      if (override) thrusters[dir] = override;
    }

    const config: EstimatorConfig = {
      targetTwr,
      lateralThrustFraction,
      thrusters,
      power,
      runtimeTargetHours,
      gyro,
      responsiveness,
    };

    const planet = resolvePlanet(planetId);
    const input: EstimatorInput = { fixedBlocks: fixedSpecs, planet, cargo, config };
    const estimate = estimateRequirements(input);

    // Run the trusted TWR engine on a synthesized design so the Estimate view
    // shows the same directional TWR bars as Analyze — empty and fully loaded.
    const design = estimateToDesign(input, estimate, planetId);
    const directional = {
      empty: directionalTwr(design, planet, estimate.dryMass),
      loaded: directionalTwr(design, planet, estimate.loadedMass),
    };

    return {
      estimate,
      planet,
      thrusters,
      thruster,
      gyro,
      powerBlock,
      directional,
      resolvedFixed,
      essentialsMass,
      essentialsCount,
      isEmpty: resolvedFixed.length === 0,
    };
  }, [
    gridSize,
    fixedBlocks,
    planetId,
    cargo,
    targetTwr,
    lateralThrustFraction,
    thrusterId,
    thrusterOverrides,
    powerKind,
    powerBlockId,
    runtimeTargetHours,
    responsiveness,
  ]);
}
