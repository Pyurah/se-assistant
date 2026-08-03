/**
 * MassPanel — dry vs. loaded mass, plus a by-category breakdown.
 *
 * The headline stats show dry mass, payload, and loaded total; the stacked bar
 * + legend break dry mass down by block category using the shared categorical
 * palette so a category reads the same color here as in the block list.
 */
import type { BlockCategory } from '@data';
import { useAnalysis } from '../../app/hooks/use-analysis';
import { formatMass, formatVolume } from '../lib/format';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';
import { StackedBar, type StackSegment } from '../components/StackedBar';
import { IconScale } from '../components/icons';
import { CATEGORY_LABELS, CATEGORY_COLOR, CATEGORY_ORDER } from '../lib/category-meta';

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

  return (
    <Panel title="Mass" icon={<IconScale size={16} />}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Dry mass" value={formatMass(mass.dryMass)} />
          <Stat label="Payload" value={formatMass(mass.cargoMass)} tone="accent" />
          <Stat label="Loaded" value={formatMass(mass.loadedMass)} />
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted">Cargo capacity</span>
          <span className="font-mono text-fg">{formatVolume(mass.cargoCapacity)}</span>
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
