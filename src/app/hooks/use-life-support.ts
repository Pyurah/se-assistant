/**
 * `useLifeSupport` — derives the life-support picture from the current design
 * plus the chosen crew size.
 *
 * Life support depends only on the block list (generators, oxygen tanks) and the
 * crew size — not planet or cargo — so this is a Pattern-B hook: the crew size
 * is owned by the panel as local UI state and passed in, mirroring how
 * {@link useBuildCost} takes its refinery settings. Returns `null` when no
 * design is loaded.
 */
import { useMemo } from 'react';
import { lifeSupport, type LifeSupport, type LifeSupportOptions } from '@core';
import { useDesignStore } from '../store/design-store';

export function useLifeSupport(options: LifeSupportOptions): LifeSupport | null {
  const design = useDesignStore((s) => s.design);
  const { crewSize } = options;

  return useMemo(() => {
    if (!design) return null;
    return lifeSupport(design, options);
    // Depend on the individual crew-size field, not the options object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design, crewSize]);
}
