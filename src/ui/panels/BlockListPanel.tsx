/**
 * BlockListPanel — the parsed block manifest plus blueprint diagnostics.
 *
 * Blocks are grouped by category (shared ordering + color dots), each row shows
 * quantity and a stat-source badge. Blueprint/unrecognized (modded) blocks are
 * highlighted because their mass is unknown (0) and they don't contribute to
 * the math — the user should know the analysis is missing them. The
 * BlueprintReport surfaces recognition rate, unrecognized subtypes, unoriented
 * thrusters, and mixed-grid notices.
 */
import { useMemo } from 'react';
import type { BlockCategory, StatSource } from '@data';
import type { BlueprintReport, DesignBlock } from '@core';
import { useDesignStore } from '../../app/store/design-store';
import { useAnalysis } from '../../app/hooks/use-analysis';
import { Panel } from '../components/Panel';
import { Badge, type BadgeVariant } from '../components/Badge';
import { IconList, IconWarning } from '../components/icons';
import { CATEGORY_LABELS, CATEGORY_COLOR, CATEGORY_ORDER } from '../lib/category-meta';
import { formatMass } from '../lib/format';
import { cn } from '../lib/cn';

const SOURCE_BADGE: Record<StatSource, { variant: BadgeVariant; label: string }> = {
  vanilla: { variant: 'vanilla', label: 'Vanilla' },
  definition: { variant: 'vanilla', label: 'Definition' },
  blueprint: { variant: 'blueprint', label: 'Modded' },
  user: { variant: 'user', label: 'Custom' },
};

export function BlockListPanel(): React.JSX.Element | null {
  const analysis = useAnalysis();
  const report = useDesignStore((s) => s.report);
  const design = analysis?.design ?? null;

  const grouped = useMemo(() => {
    if (!design) return [];
    const byCat = new Map<BlockCategory, DesignBlock[]>();
    for (const b of design.blocks) {
      const cat = b.definition.category;
      const list = byCat.get(cat) ?? [];
      list.push(b);
      byCat.set(cat, list);
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((cat) => ({
      category: cat,
      blocks: (byCat.get(cat) ?? []).slice().sort((a, b) => b.quantity - a.quantity),
    }));
  }, [design]);

  if (!design) return null;

  const totalBlocks = design.blocks.reduce((s, b) => s + b.quantity, 0);

  return (
    <Panel
      title="Blocks"
      icon={<IconList size={16} />}
      subtitle={`${totalBlocks} blocks · ${design.gridSize} grid`}
    >
      <div className="flex flex-col gap-4">
        {report && <BlueprintDiagnostics report={report} />}

        <div className="flex flex-col gap-4">
          {grouped.map(({ category, blocks }) => (
            <div key={category} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className={cn('size-2 rounded-sm', CATEGORY_COLOR[category])} aria-hidden />
                <h3 className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
                  {CATEGORY_LABELS[category]}
                </h3>
              </div>
              <ul className="flex flex-col">
                {blocks.map((block) => {
                  const badge = SOURCE_BADGE[block.definition.source];
                  const modded = block.definition.source === 'blueprint';
                  return (
                    <li
                      key={`${block.definition.id}|${block.thrustDirection ?? ''}`}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-2',
                        modded && 'bg-warning/5',
                      )}
                    >
                      <span className="font-mono text-xs text-muted tabular-nums">
                        {block.quantity}×
                      </span>
                      <span className="flex-1 truncate text-fg">{block.definition.displayName}</span>
                      {block.thrustDirection && (
                        <span className="font-mono text-[11px] text-subtle">
                          {block.thrustDirection}
                        </span>
                      )}
                      <span className="w-16 shrink-0 text-right font-mono text-xs text-muted">
                        {modded ? '—' : formatMass(block.definition.mass * block.quantity)}
                      </span>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/** The diagnostics summary from parsing: recognition rate + caveats. */
function BlueprintDiagnostics({ report }: { report: BlueprintReport }): React.JSX.Element {
  const allMatched = report.matchedBlocks === report.totalBlocks;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Blocks recognized</span>
        <span className={cn('font-mono font-semibold', allMatched ? 'text-success' : 'text-warning')}>
          {report.matchedBlocks} / {report.totalBlocks}
        </span>
      </div>

      {report.unrecognizedSubtypes.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          <div className="flex items-center gap-1.5 text-xs text-warning">
            <IconWarning size={13} />
            <span className="font-medium">
              {report.unrecognizedSubtypes.length} unrecognized (modded) subtype
              {report.unrecognizedSubtypes.length === 1 ? '' : 's'} — mass 0, excluded from math
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {report.unrecognizedSubtypes.map((s) => (
              <span
                key={s}
                className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {(report.unorientedThrusters > 0 || report.mixedGridSizes || report.gridCount > 1) && (
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
          {report.unorientedThrusters > 0 && (
            <Badge variant="warning">
              {report.unorientedThrusters} unoriented thruster
              {report.unorientedThrusters === 1 ? '' : 's'}
            </Badge>
          )}
          {report.gridCount > 1 && <Badge variant="neutral">{report.gridCount} grids merged</Badge>}
          {report.mixedGridSizes && <Badge variant="warning">Mixed grid sizes</Badge>}
        </div>
      )}
    </div>
  );
}
