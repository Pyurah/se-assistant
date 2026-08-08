/**
 * `useBuildCost` — derives the build-cost bill of materials from the current
 * design plus the chosen manufacturing settings.
 *
 * Build cost depends only on the block list and the refinery/assembler
 * settings — not planet or cargo — so this is a separate memoized hook from
 * {@link useAnalysis}. Settings are passed in (owned by the panel as local UI
 * state) so changing a refinery preset recomputes ore totals without touching
 * the design store. Returns `null` when no design is loaded.
 */
import { useMemo } from 'react';
import { buildCost, type BuildCost, type BuildCostOptions } from '@core';
import { useDesignStore } from '../store/design-store';

export function useBuildCost(options: BuildCostOptions): BuildCost | null {
  const design = useDesignStore((s) => s.design);
  const { refinery, assembler, assemblerEfficiency } = options;

  return useMemo(() => {
    if (!design) return null;
    return buildCost(design, options);
    // Depend on the individual settings, not the options object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design, refinery, assembler, assemblerEfficiency]);
}
