/**
 * `useConveyor` — derives the conveyor port & reachability audit from the
 * current design.
 *
 * The audit depends only on the block list (which large-port blocks are present
 * and whether large-port conveyor pieces exist), not planet or cargo — a
 * store-only Pattern-A hook, sibling to {@link useAnalysis}. Returns `null` when
 * no design is loaded.
 */
import { useMemo } from 'react';
import { conveyorAudit, type ConveyorAudit } from '@core';
import { useDesignStore } from '../store/design-store';

export function useConveyor(): ConveyorAudit | null {
  const design = useDesignStore((s) => s.design);

  return useMemo(() => {
    if (!design) return null;
    return conveyorAudit(design);
  }, [design]);
}
