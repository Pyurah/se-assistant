/**
 * Shared cargo-capacity readouts used by both the Analyze {@link CargoControl}
 * and the Estimate {@link BuildParametersPanel}:
 *
 * - {@link WorldMultiplierControl} — the world inventory-size setting
 *   (Realistic ×1 / ×3 / ×10), mirroring the Build-cost panel's
 *   "Assembler efficiency (world)" knob. Scales every block's cargo hold.
 * - {@link CapacityBreakdown} — the per-constraint capacity split (General cargo
 *   / Ore / Ice / …), shown only when more than one inventory pool is present.
 * - {@link ItemCapacityLine} — "can carry ≈ N × <item>", the hauler readout.
 *
 * All three are presentational: capacity liters and item counts are computed by
 * the pure engine (`cargoCapacity` / `inventoryBreakdown` / `itemCapacity`)
 * upstream and passed in, keeping this component free of engine/store coupling.
 */
import type { InventoryConstraint } from '@data';
import { formatCount, formatVolume } from '../lib/format';
import { SegmentedControl } from '../components/SegmentedControl';

const MULTIPLIER_OPTIONS = [
  { value: '1', label: '×1' },
  { value: '3', label: '×3' },
  { value: '10', label: '×10' },
] as const;

/** Human labels + display order for the inventory-constraint pools. */
const CONSTRAINT_META: readonly { key: InventoryConstraint; label: string }[] = [
  { key: 'any', label: 'General cargo' },
  { key: 'ore', label: 'Ore' },
  { key: 'ice', label: 'Ice' },
  { key: 'uranium', label: 'Uranium' },
  { key: 'component', label: 'Components' },
  { key: 'ammo', label: 'Ammo' },
];

/** Snap a numeric multiplier to the nearest segmented-control option value. */
function multiplierValue(multiplier: number): '1' | '3' | '10' {
  if (multiplier >= 10) return '10';
  if (multiplier >= 3) return '3';
  return '1';
}

export interface WorldMultiplierControlProps {
  /** Unique radiogroup name (the two tabs render separate instances). */
  name: string;
  multiplier: number;
  onChange: (multiplier: number) => void;
}

export function WorldMultiplierControl({
  name,
  multiplier,
  onChange,
}: WorldMultiplierControlProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="text-[11px] font-medium tracking-wide text-subtle uppercase"
          title="World survival setting (Realistic ×1 / ×3 / ×10) — scales every block's cargo hold."
        >
          Inventory size (world)
        </span>
        <SegmentedControl
          name={name}
          ariaLabel="World inventory size multiplier"
          value={multiplierValue(multiplier)}
          options={MULTIPLIER_OPTIONS}
          onChange={(v) => onChange(Number(v))}
        />
      </div>
      <p className="text-[11px] text-subtle">
        World survival setting (Realistic ×1 / ×3 / ×10) — scales every block's cargo hold.
      </p>
    </div>
  );
}

export interface CapacityBreakdownProps {
  byConstraint: Record<InventoryConstraint, number>;
}

export function CapacityBreakdown({
  byConstraint,
}: CapacityBreakdownProps): React.JSX.Element | null {
  const pools = CONSTRAINT_META.filter((c) => byConstraint[c.key] > 0);
  // A single pool (or none) needs no split — the total already says everything.
  if (pools.length <= 1) return null;
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-bg px-3 py-2 text-xs">
      {pools.map((c) => (
        <div key={c.key} className="flex items-center justify-between">
          <span className="text-subtle">{c.label}</span>
          <span className="font-mono text-muted">{formatVolume(byConstraint[c.key])}</span>
        </div>
      ))}
    </div>
  );
}

export interface ItemCapacityLineProps {
  count: number;
  itemName: string;
}

export function ItemCapacityLine({
  count,
  itemName,
}: ItemCapacityLineProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2">
      <span className="text-xs tracking-wide text-subtle uppercase">Can carry ≈</span>
      <span className="font-mono text-sm font-semibold text-fg-bright">
        {formatCount(count)} × {itemName}
      </span>
    </div>
  );
}
