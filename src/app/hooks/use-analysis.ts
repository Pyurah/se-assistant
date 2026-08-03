/**
 * `useAnalysis` — derives all engine output from the current store state.
 *
 * The store holds only inputs (design, planet, cargo). This hook runs the pure
 * calc engine over them and memoizes the result, so every panel reads one
 * consistent snapshot and a planet/cargo change recomputes everything at once.
 * Returns `null` when no design is loaded.
 */
import { useMemo } from 'react';
import {
  massSummary,
  powerSummary,
  liftAnalysis,
  directionalTwr,
  DIRECTIONS,
  type ShipDesign,
  type MassSummary,
  type PowerSummary,
  type LiftAnalysis,
} from '@core';
import { PLANET_PRESETS_BY_ID, type PlanetPreset, type Direction } from '@data';
import { useDesignStore } from '../store/design-store';

export interface Analysis {
  design: ShipDesign;
  planet: PlanetPreset;
  mass: MassSummary;
  power: PowerSummary;
  lift: LiftAnalysis;
  /** Directional TWR at dry (empty) mass — pairs with lift.loadedDirectional. */
  emptyDirectional: Record<Direction, number>;
}

/** Resolve a planet id to its preset, defaulting to Earthlike if unknown. */
export function resolvePlanet(planetId: string): PlanetPreset {
  return PLANET_PRESETS_BY_ID[planetId] ?? PLANET_PRESETS_BY_ID['earthlike']!;
}

export function useAnalysis(): Analysis | null {
  const design = useDesignStore((s) => s.design);
  const planetId = useDesignStore((s) => s.planetId);

  return useMemo(() => {
    if (!design) return null;
    const planet = resolvePlanet(planetId);
    const mass = massSummary(design);
    const lift = liftAnalysis(design, planet);
    const emptyDirectional = directionalTwr(design, planet, mass.dryMass);
    // Touch DIRECTIONS so the ordering constant is the single source of truth
    // for any consumer iterating these records.
    void DIRECTIONS;
    return {
      design,
      planet,
      mass,
      power: powerSummary(design),
      lift,
      emptyDirectional,
    };
  }, [design, planetId]);
}
