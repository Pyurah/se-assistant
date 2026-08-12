/**
 * MassPanel — dry vs. loaded mass, plus a by-category breakdown.
 *
 * The headline stats show dry mass, payload, and loaded total; the stacked bar
 * + legend break dry mass down by block category using the shared categorical
 * palette so a category reads the same color here as in the block list.
 */
import type { BlockCategory, InventoryConstraint } from '@data';
import { useAnalysis } from '../../app/hooks/use-analysis';
import { formatMass, formatVolume } from '../lib/format';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';
import { StackedBar, type StackSegment } from '../components/StackedBar';
import { IconScale } from '../components/icons';
import { CATEGORY_LABELS, CATEGORY_COLOR, CATEGORY_ORDER } from '../lib/category-meta';

/** Human labels + display order for the inventory-constraint pools. */
const CONSTRAINT_META: readonly { key: InventoryConstraint; label: string }[] = [
  { key: 'any', label: 'General cargo' },
  { key: 'ore', label: 'Ore' },
  { key: 'ice', label: 'Ice' },
  { key: 'uranium', label: 'Uranium' },
  { key: 'component', label: 'Components' },
  { key: 'ammo', label: 'Ammo' },
];

export function MassPanel(): React.JSX.Element | null {
  const analysis = useAnalysis();
  if (!analysis) return null;
  const { mass } = analysis;

  const segments: StackSegment[] = CATEGORY_ORDER.map((cat: BlockCategory) => ({
    key: cat,
    label: CATEGORY_LABELS[cat],
    value: mass.byCategory[cat] ?? 0,
    colorClass: CATEGORY_COLOR[cat],
  })).filter((s) => s.value > 0);

  // Capacity split across inventory pools; a single pool needs no breakdown (the
  // total already says it all), so it's shown only when 2+ pools hold items.
  const capacityPools = CONSTRAINT_META.filter((c) => mass.inventoryByConstraint[c.key] > 0);

  return (
    <Panel title="Mass" icon={<IconScale size={16} />}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Dry mass" value={formatMass(mass.dryMass)} />
          <Stat label="Payload" value={formatMass(mass.cargoMass)} tone="accent" />
          <Stat label="Loaded" value={formatMass(mass.loadedMass)} />
        </div>

        {(mass.addedMass > 0 || mass.extraPayload > 0) && (
          <div className="flex flex-col gap-1.5 text-sm">
            {mass.addedMass > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted">Added mass (empty + loaded)</span>
                <span className="font-mono text-fg">{formatMass(mass.addedMass)}</span>
              </div>
            )}
            {mass.extraPayload > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted">Extra payload (loaded only)</span>
                <span className="font-mono text-fg">{formatMass(mass.extraPayload)}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">
              Cargo capacity{mass.inventoryMultiplier !== 1 ? ` (×${mass.inventoryMultiplier})` : ''}
            </span>
            <span className="font-mono text-fg">{formatVolume(mass.cargoCapacity)}</span>
          </div>
          {capacityPools.length > 1 && (
            <div className="flex flex-col gap-1 pl-3 text-xs">
              {capacityPools.map((c) => (
                <div key={c.key} className="flex items-center justify-between">
                  <span className="text-subtle">{c.label}</span>
                  <span className="font-mono text-muted">
                    {formatVolume(mass.inventoryByConstraint[c.key])}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {segments.length > 0 ? (
          <StackedBar segments={segments} format={formatMass} />
        ) : (
          <p className="text-sm text-subtle">No mass-bearing blocks recognized.</p>
        )}
      </div>
    </Panel>
  );
}
