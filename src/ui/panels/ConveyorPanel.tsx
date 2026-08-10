/**
 * ConveyorPanel — large-port conveyor audit for an imported ship.
 *
 * Space Engineers has no published conveyor throughput, so this panel does NOT
 * fabricate an items/sec rate. Instead it answers the checkable question: does
 * the grid carry large-port conveyor lines to feed the blocks that require them
 * (refineries, assemblers, connectors, large cargo, large drills, O2/H2
 * generators)? A ship built with only small tubes silently starves those
 * blocks. Three states: no large-port blocks → tidy "nothing to check" note;
 * large-port blocks but no large line → a danger warning (the actionable case);
 * both present → a confirmation with the honest presence-not-connectivity
 * caveat. The specific blocks that need routing are always listed.
 */
import { useConveyor } from '../../app/hooks/use-conveyor';
import type { LargePortReason } from '@data';
import { formatCount } from '../lib/format';
import { Panel } from '../components/Panel';
import { IconLayers, IconAlert, IconCheck } from '../components/icons';

const REASON_LABEL: Record<LargePortReason, string> = {
  production: 'Production',
  'bulk-storage': 'Bulk storage',
  docking: 'Docking',
  mining: 'Mining',
  gas: 'Gas system',
};

export function ConveyorPanel(): React.JSX.Element | null {
  const audit = useConveyor();
  if (!audit) return null;

  const { largePortBlocks, largePortBlockCount, largePortConveyorCount, unfeedable, caveat } = audit;

  // Empty state: nothing on the grid needs a large conveyor port.
  if (largePortBlocks.length === 0) {
    return (
      <Panel title="Conveyor audit" icon={<IconLayers size={16} />} subtitle="large-port reachability">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-bg p-3 text-sm">
          <span className="mt-0.5 shrink-0 text-success">
            <IconCheck size={18} />
          </span>
          <div>
            <p className="font-medium text-fg">No large-port blocks</p>
            <p className="text-muted">
              Nothing on this grid (no refinery, assembler, connector, large cargo, large drill, or
              O2/H2 generator) requires a large conveyor line — small tubes feed everything here.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Conveyor audit"
      icon={<IconLayers size={16} />}
      subtitle={`${formatCount(largePortBlockCount)} block${largePortBlockCount === 1 ? '' : 's'} need large ports`}
    >
      <div className="flex flex-col gap-4">
        {unfeedable ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-danger/50 bg-danger/10 p-3"
          >
            <span className="mt-0.5 shrink-0 text-danger">
              <IconAlert size={18} />
            </span>
            <div className="text-sm">
              <p className="font-semibold text-danger">No large-port conveyor line</p>
              <p className="text-muted">
                {formatCount(largePortBlockCount)} block
                {largePortBlockCount === 1 ? '' : 's'} need a large conveyor port, but the grid
                carries no large-port conveyor pieces (Conveyor Tube, Conveyor, or a large hub).
                Those blocks can&apos;t be fed — add a large line.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-success/40 bg-success/10 p-3">
            <span className="mt-0.5 shrink-0 text-success">
              <IconCheck size={18} />
            </span>
            <div className="text-sm">
              <p className="font-semibold text-success">Large conveyor line present</p>
              <p className="text-muted">
                The grid carries {formatCount(largePortConveyorCount)} large-port conveyor piece
                {largePortConveyorCount === 1 ? '' : 's'} to feed its{' '}
                {formatCount(largePortBlockCount)} large-port block
                {largePortBlockCount === 1 ? '' : 's'}.
              </p>
            </div>
          </div>
        )}

        {/* The blocks that need a large-port run — so the user knows what to route. */}
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
          {largePortBlocks.map((b) => (
            <li key={b.subtypeId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-fg">{b.displayName}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-subtle">
                  {REASON_LABEL[b.reason]}
                </span>
                <span className="font-mono text-muted">×{formatCount(b.quantity)}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-subtle">{caveat}</p>
      </div>
    </Panel>
  );
}
