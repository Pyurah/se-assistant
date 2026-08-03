/**
 * TwrBar — a threshold gauge for a single thrust-to-weight ratio.
 *
 * TWR is a ratio where 1.0 is the make-or-break line (below it the ship cannot
 * hold against gravity). The bar is scaled so 1.0 sits at a fixed reference
 * position with a labeled "1.0" line, and the fill is tinted green at/above 1
 * and red below — the pass/fail read is instant. Handles Infinity (0 g) by
 * showing an "n/a — no gravity" state instead of a runaway bar.
 */
import { cn } from '../lib/cn';
import { formatTwr } from '../lib/format';

export interface TwrBarProps {
  label: string;
  twr: number;
  /** Emphasize this axis (the UP/lift direction). */
  emphasis?: boolean;
  className?: string;
}

/**
 * Map a TWR to a 0..100 bar width. The linear region 0..2 maps to 0..75% so the
 * make-or-break 1.0 line sits at a fixed 37.5% mark; values above 2 compress on
 * a log curve so a TWR of 10 reads as "lots of headroom" without dwarfing the
 * bar. Infinity (0 g) clamps to full.
 */
function twrToPct(twr: number): number {
  if (!Number.isFinite(twr)) return 100;
  if (twr <= 0) return 0;
  if (twr <= 2) return (twr / 2) * 75;
  return 75 + Math.min(25, (Math.log2(twr / 2) / Math.log2(8)) * 25);
}

/** Bar position (%) of the TWR = 1.0 lift-off line. */
const ONE_PCT = (1 / 2) * 75; // 37.5%

export function TwrBar({ label, twr, emphasis, className }: TwrBarProps): React.JSX.Element {
  const noGravity = !Number.isFinite(twr);
  const passes = twr >= 1;
  const pct = twrToPct(twr);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            'text-xs font-medium tracking-wide uppercase',
            emphasis ? 'text-fg-bright' : 'text-muted',
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            'font-mono text-sm font-semibold',
            noGravity ? 'text-muted' : passes ? 'text-success' : 'text-danger',
          )}
        >
          {noGravity ? 'n/a' : formatTwr(twr)}
        </span>
      </div>
      <div
        className={cn('relative w-full overflow-hidden rounded-full bg-bg', emphasis ? 'h-3' : 'h-2')}
        role="meter"
        aria-label={`${label} thrust to weight ratio`}
        aria-valuenow={noGravity ? undefined : Math.round(twr * 100) / 100}
        aria-valuemin={0}
        aria-valuetext={noGravity ? 'no gravity, not applicable' : formatTwr(twr)}
      >
        {noGravity ? (
          <div className="h-full w-full bg-border-strong/40" />
        ) : (
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-200 ease-out',
              passes ? 'bg-success' : 'bg-danger',
            )}
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        )}
        {/* The 1.0 lift-off line. */}
        {!noGravity && (
          <div
            className="absolute top-0 bottom-0 w-px bg-fg-bright/60"
            style={{ left: `${ONE_PCT}%` }}
            aria-hidden
          />
        )}
      </div>
      {noGravity && <span className="text-[11px] text-subtle">no gravity — hover not required</span>}
    </div>
  );
}
