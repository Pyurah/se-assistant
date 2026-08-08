/**
 * Manufacturing throughput & optimal fleet ratios.
 *
 * The {@link buildCost} engine reports how long a full ship takes to refine and
 * assemble on ONE machine each (`refineTimeSeconds` / `assembleTimeSeconds`).
 * This module answers the builder's follow-up questions with those two figures:
 *
 *   Forward  — "I have N refineries and M assemblers; how long will it take, and
 *              which stage is the bottleneck?"
 *   Inverse  — "What refinery : assembler ratio keeps neither stage idle?"
 *
 * MODEL — bottleneck-bound steady state. Refining and assembling PIPELINE: ore
 * refines into ingots while earlier components are already being assembled, so
 * the two stages run concurrently and the SLOWER stage governs the wall clock:
 *
 *   refineStage   = refineTimeSeconds   / refineryCount
 *   assembleStage = assembleTimeSeconds / assemblerCount
 *   wallClock     = max(refineStage, assembleStage)
 *
 * This deliberately ignores pipeline fill/drain (the first ingots must exist
 * before the first component assembles, and the last components trail the last
 * refine) — negligible against a whole-ship batch and documented as a modeling
 * choice in `docs/data-audit.md`, not silently assumed.
 *
 * The balanced ratio falls straight out of the two serial totals: to keep both
 * stages equally busy you want `refineryCount : assemblerCount` ≈
 * `refineTimeSeconds : assembleTimeSeconds`.
 *
 * PURE — no React, no DOM. Consumes only a {@link BuildCost}.
 */

import type { BuildCost } from './build-cost';
import { totalOreMass } from './build-cost';

/** Which stage governs the wall clock (or neither, when balanced). */
export type Bottleneck = 'refinery' | 'assembler' | 'balanced';

/** Fleet sizes to evaluate; each defaults to a single machine. */
export interface ThroughputOptions {
  /** Number of refineries running in parallel. Clamped to an integer ≥ 1. */
  readonly refineryCount?: number;
  /** Number of assemblers running in parallel. Clamped to an integer ≥ 1. */
  readonly assemblerCount?: number;
}

/** Throughput analysis for a build under a given refinery/assembler fleet. */
export interface ManufacturingThroughput {
  /** The clamped refinery count actually used. */
  readonly refineryCount: number;
  /** The clamped assembler count actually used. */
  readonly assemblerCount: number;
  /** Refine wall-clock for the fleet: refineTime ÷ refineryCount (seconds). */
  readonly refineStageSeconds: number;
  /** Assemble wall-clock for the fleet: assembleTime ÷ assemblerCount (seconds). */
  readonly assembleStageSeconds: number;
  /** Steady-state build time: the slower of the two stages (seconds). */
  readonly wallClockSeconds: number;
  /** Which stage is the bottleneck (or `'balanced'` when equal). */
  readonly bottleneck: Bottleneck;
  /** Refinery busy fraction 0..1 (the bottleneck stage is 1). */
  readonly refineryUtilization: number;
  /** Assembler busy fraction 0..1 (the bottleneck stage is 1). */
  readonly assemblerUtilization: number;
  /**
   * Balanced fleet ratio = refineries per assembler = refineTime ÷ assembleTime.
   * `Infinity` when there is nothing to assemble (no known components).
   */
  readonly balancedRatio: number;
  /** Integer refineries that would balance the current assembler count. */
  readonly suggestedRefineries: number;
  /** Integer assemblers that would balance the current refinery count. */
  readonly suggestedAssemblers: number;
  /** Raw ore refined per hour across the refinery fleet (kg/h). */
  readonly orePerHour: number;
  /** Components assembled per hour across the assembler fleet (units/h). */
  readonly componentsPerHour: number;
}

/** Stage times within this fraction of each other are treated as balanced. */
const BALANCE_EPSILON = 0.02; // 2%

/** Clamp a possibly-undefined fleet count to a whole machine ≥ 1. */
function clampCount(count: number | undefined): number {
  if (count === undefined || !Number.isFinite(count)) return 1;
  return Math.max(1, Math.floor(count));
}

/** Total number of components to assemble across the whole build. */
function totalComponentCount(cost: BuildCost): number {
  return Object.values(cost.components).reduce((sum, n) => sum + (n ?? 0), 0);
}

/**
 * Compute throughput and optimal-ratio figures for a build under a chosen
 * refinery/assembler fleet. Fleet counts default to one machine each and are
 * clamped to whole machines ≥ 1.
 */
export function manufacturingThroughput(
  cost: BuildCost,
  options: ThroughputOptions = {},
): ManufacturingThroughput {
  const refineryCount = clampCount(options.refineryCount);
  const assemblerCount = clampCount(options.assemblerCount);

  const refineStageSeconds = cost.refineTimeSeconds / refineryCount;
  const assembleStageSeconds = cost.assembleTimeSeconds / assemblerCount;
  const wallClockSeconds = Math.max(refineStageSeconds, assembleStageSeconds);

  // Bottleneck: the slower stage, unless the two are within epsilon → balanced.
  let bottleneck: Bottleneck;
  const larger = Math.max(refineStageSeconds, assembleStageSeconds);
  const smaller = Math.min(refineStageSeconds, assembleStageSeconds);
  if (larger === 0 || (larger - smaller) / larger <= BALANCE_EPSILON) {
    bottleneck = 'balanced';
  } else {
    bottleneck = refineStageSeconds > assembleStageSeconds ? 'refinery' : 'assembler';
  }

  // Utilization: each stage's busy fraction against the wall clock.
  const refineryUtilization = wallClockSeconds > 0 ? refineStageSeconds / wallClockSeconds : 0;
  const assemblerUtilization = wallClockSeconds > 0 ? assembleStageSeconds / wallClockSeconds : 0;

  // Balanced ratio (refineries per assembler) from the two serial totals.
  const balancedRatio =
    cost.assembleTimeSeconds > 0
      ? cost.refineTimeSeconds / cost.assembleTimeSeconds
      : Infinity;

  // Integer fleet that would balance against the other stat's current count.
  const suggestedRefineries = Number.isFinite(balancedRatio)
    ? Math.max(1, Math.ceil(assemblerCount * balancedRatio))
    : Math.max(1, refineryCount);
  const suggestedAssemblers =
    balancedRatio > 0 && Number.isFinite(balancedRatio)
      ? Math.max(1, Math.ceil(refineryCount / balancedRatio))
      : 1;

  // Per-hour rates across each fleet, guarding division by a zero-length stage.
  const orePerHour =
    refineStageSeconds > 0 ? (totalOreMass(cost) / refineStageSeconds) * 3600 : 0;
  const componentsPerHour =
    assembleStageSeconds > 0 ? (totalComponentCount(cost) / assembleStageSeconds) * 3600 : 0;

  return {
    refineryCount,
    assemblerCount,
    refineStageSeconds,
    assembleStageSeconds,
    wallClockSeconds,
    bottleneck,
    refineryUtilization,
    assemblerUtilization,
    balancedRatio,
    suggestedRefineries,
    suggestedAssemblers,
    orePerHour,
    componentsPerHour,
  };
}
