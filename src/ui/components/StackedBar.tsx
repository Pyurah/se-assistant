/**
 * StackedBar — a single horizontal bar split into proportional colored segments,
 * with an accompanying legend/list. Used for the mass-by-category breakdown.
 *
 * dataviz notes: segments share one continuous track so relative proportions
 * read at a glance; a categorical (not sequential) palette distinguishes
 * categories; the legend carries the exact formatted value and percentage so
 * the chart is not the only source of the numbers. Tiny segments get a minimum
 * width so they stay visible and hoverable.
 */
import { cn } from '../lib/cn';

export interface StackSegment {
  key: string;
  label: string;
  value: number;
  /** Tailwind background color class from the categorical palette. */
  colorClass: string;
}

export interface StackedBarProps {
  segments: readonly StackSegment[];
  /** Formats a raw value for the legend (e.g. formatMass). */
  format: (value: number) => string;
  className?: string;
}

export function StackedBar({ segments, format, className }: StackedBarProps): React.JSX.Element {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const visible = segments.filter((s) => s.value > 0);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-bg" role="img" aria-label="Mass distribution by block category">
        {visible.map((seg) => {
          const pct = total > 0 ? (seg.value / total) * 100 : 0;
          return (
            <div
              key={seg.key}
              className={cn('h-full first:rounded-l-full last:rounded-r-full', seg.colorClass)}
              style={{ width: `${Math.max(1.5, pct)}%` }}
              title={`${seg.label}: ${format(seg.value)}`}
            />
          );
        })}
      </div>
      <ul className="flex flex-col gap-1.5">
        {visible.map((seg) => {
          const pct = total > 0 ? (seg.value / total) * 100 : 0;
          return (
            <li key={seg.key} className="flex items-center gap-2 text-sm">
              <span className={cn('size-2.5 shrink-0 rounded-sm', seg.colorClass)} aria-hidden />
              <span className="flex-1 truncate text-muted">{seg.label}</span>
              <span className="font-mono text-fg">{format(seg.value)}</span>
              <span className="w-12 text-right font-mono text-xs text-subtle">
                {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
