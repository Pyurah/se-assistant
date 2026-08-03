/**
 * `useMotion` — derives the motion & stability picture from the current store.
 *
 * A sibling to {@link useAnalysis} / {@link useFuel}: the store holds only inputs
 * (design, planet, cargo), and this hook runs the pure motion engine over them
 * and memoizes the speed-independent results — turn-rate estimate, thrust-center
 * alignment, center of mass, and whether the design carries block geometry.
 * Memoized on `[design, planetId]` so a planet or cargo change (both fold into
 * `design`) recomputes live, consistent with the other panels.
 *
 * Stopping distance depends on a user-chosen speed, so it is exposed as a small
 * `stopping(direction, speed)` helper the panel calls for the current speed
 * rather than being baked into the memo. Returns `null` when no design is loaded.
 */
import { useMemo } from 'react';
import {
  turnRateEstimate,
  thrustCenterAlignment,
  centerOfMass,
  hasGeometry,
  stoppingDistance,
  DIRECTIONS,
  type ShipDesign,
  type Vec3,
  type TurnRateEstimate,
  type AlignmentResult,
  type StoppingResult,
} from '@core';
import { type PlanetPreset, type Direction } from '@data';
import { useDesignStore } from '../store/design-store';
import { resolvePlanet } from './use-analysis';

export interface Motion {
  design: ShipDesign;
  planet: PlanetPreset;
  /** Gyro turn-rate estimate (always available via the mass-based fallback). */
  turnRate: TurnRateEstimate;
  /** Per-direction thrust-center vs. CoM alignment, or null without geometry. */
  alignment: AlignmentResult[] | null;
  /** Mass-weighted center of mass (grid cells), or null without geometry. */
  centerOfMass: Vec3 | null;
  /** True when the design carries per-block positions (imported blueprints). */
  hasGeometry: boolean;
  /** Stopping distance/time in a travel direction at a given speed (m/s). */
  stopping: (direction: Direction, speed: number) => StoppingResult;
}

export function useMotion(): Motion | null {
  const design = useDesignStore((s) => s.design);
  const planetId = useDesignStore((s) => s.planetId);

  return useMemo(() => {
    if (!design) return null;
    const planet = resolvePlanet(planetId);
    // Touch DIRECTIONS so the shared ordering constant is the single source of
    // truth for any consumer iterating directional results.
    void DIRECTIONS;
    return {
      design,
      planet,
      turnRate: turnRateEstimate(design),
      alignment: thrustCenterAlignment(design),
      centerOfMass: centerOfMass(design),
      hasGeometry: hasGeometry(design),
      stopping: (direction: Direction, speed: number): StoppingResult =>
        stoppingDistance(design, planet, direction, speed),
    };
  }, [design, planetId]);
}
