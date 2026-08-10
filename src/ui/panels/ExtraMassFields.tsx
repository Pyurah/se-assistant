/**
 * ExtraMassFields — the two freeform extra-mass inputs, presentational only.
 *
 * A ship's real mass isn't just its blocks and cargo. Two things routinely add
 * weight the block list can't capture:
 *
 *  - **Added mass** — always there whether the hold is full or empty: a docked
 *    ship, a bolted-on module, a welded-on subgrid. It counts in BOTH the empty
 *    and loaded states, so it joins *dry* mass.
 *  - **Extra payload** — a detachable load you're hauling that only counts when
 *    "loaded", exactly like cargo: an externally-clamped container, a rover on a
 *    pad. It counts only in the loaded state, alongside cargo.
 *
 * This component is deliberately dumb: it renders the two labelled kg inputs and
 * calls back on change. Both the Analyze store (`design-store`) and the Estimate
 * store (`estimator-store`) hold an identical `{ added, payload }` shape with
 * matching `setAddedMass` / `setExtraPayload` setters, so the two dashboards wire
 * this same component to their own store. Values are clamped ≥ 0 in the stores.
 */
import type { ExtraMass } from '@core';
import { formatMass } from '../lib/format';

const fieldRow = 'flex items-center justify-between gap-3';
const numberInput =
  'h-8 w-28 rounded-md border border-border bg-bg px-2 font-mono text-sm text-fg transition-colors hover:border-border-strong focus:border-accent';

export function ExtraMassFields({
  extraMass,
  onAddedChange,
  onPayloadChange,
}: {
  extraMass: ExtraMass;
  onAddedChange: (kg: number) => void;
  onPayloadChange: (kg: number) => void;
}): React.JSX.Element {
  const total = extraMass.added + extraMass.payload;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className={fieldRow}>
          <label htmlFor="extra-added" className="text-xs font-medium text-fg">
            Added mass
          </label>
          <span className="flex items-center gap-1.5">
            <input
              id="extra-added"
              type="number"
              min={0}
              step={100}
              value={extraMass.added}
              onChange={(e) => onAddedChange(Number(e.target.value))}
              aria-label="Always-on added mass in kilograms"
              className={numberInput}
            />
            <span className="font-mono text-xs text-subtle">kg</span>
          </span>
        </div>
        <p className="text-xs text-subtle">
          Docked ship or bolted-on module — counts empty <em>and</em> loaded.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className={fieldRow}>
          <label htmlFor="extra-payload" className="text-xs font-medium text-fg">
            Extra payload
          </label>
          <span className="flex items-center gap-1.5">
            <input
              id="extra-payload"
              type="number"
              min={0}
              step={100}
              value={extraMass.payload}
              onChange={(e) => onPayloadChange(Number(e.target.value))}
              aria-label="Loaded-only extra payload in kilograms"
              className={numberInput}
            />
            <span className="font-mono text-xs text-subtle">kg</span>
          </span>
        </div>
        <p className="text-xs text-subtle">
          A detachable load you're hauling — counts only when loaded, like cargo.
        </p>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2">
          <span className="text-xs tracking-wide text-subtle uppercase">Extra mass total</span>
          <span className="font-mono text-sm font-semibold text-fg-bright">{formatMass(total)}</span>
        </div>
      )}
    </div>
  );
}
