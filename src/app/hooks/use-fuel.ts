/**
 * `useFuel` — derives the fuel/flight-time summary from the current store state.
 *
 * A sibling to {@link useAnalysis}: the store holds only inputs (design, planet,
 * cargo), and this hook runs the pure fuel engine over them and memoizes the
 * result. `fuelSummary` reads the design's own `planetId` and computes at its
 * loaded mass, so a planet or cargo change recomputes the fuel picture live,
 * consistent with the other panels. Also surfaces the O2/H2 generator output so
 * the panel can reason about whether generation can sustain a hover burn.
 * Returns `null` when no design is loaded.
 */
import { useMemo } from 'react';
import { fuelSummary, hydrogenGeneration, type FuelSummary } from '@core';
import { useDesignStore } from '../store/design-store';

export interface Fuel {
  summary: FuelSummary;
  /** Sustained H2 output from all O2/H2 generators, L/s (0 if none). */
  hydrogenGeneration: number;
}

export function useFuel(): Fuel | null {
  const design = useDesignStore((s) => s.design);
  const planetId = useDesignStore((s) => s.planetId);

  return useMemo(() => {
    if (!design) return null;
    // planetId is read to invalidate the memo when the planet changes; the
    // engine reads it off design.planetId (kept in sync by the store).
    void planetId;
    return {
      summary: fuelSummary(design),
      hydrogenGeneration: hydrogenGeneration(design),
    };
  }, [design, planetId]);
}
