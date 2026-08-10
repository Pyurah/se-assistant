/**
 * `useCombat` — derives per-weapon and ship-wide DPS + ammo burn from the
 * current design plus the chosen magazines-per-weapon assumption.
 *
 * Combat depends only on the block list and the loadout assumption (how many
 * magazines are loaded per weapon) — not planet or cargo — so this is a
 * Pattern-B hook: the magazine count is owned by the panel as local UI state and
 * passed in, mirroring how {@link useBuildCost} takes its refinery settings.
 * Returns `null` when no design is loaded.
 */
import { useMemo } from 'react';
import { combatAnalysis, type Combat, type CombatOptions } from '@core';
import { useDesignStore } from '../store/design-store';

export function useCombat(options: CombatOptions): Combat | null {
  const design = useDesignStore((s) => s.design);
  const { magazinesPerWeapon } = options;

  return useMemo(() => {
    if (!design) return null;
    return combatAnalysis(design, options);
    // Depend on the individual setting, not the options object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design, magazinesPerWeapon]);
}
