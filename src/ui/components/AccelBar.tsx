/**
 * AccelBar — a proportional gauge for a single axis of acceleration in space.
 *
 * Unlike TWR, acceleration has no make-or-break threshold (there is no gravity
 * to overcome in space), so this bar has no "1.0 line". Instead it fills
 * proportional to the strongest axis of the build (`maxAccel`), giving an
 * at-a-glance read of which direction accelerates hardest. The caption reports
 * time and distance to reach the speed cap — the numbers that actually matter
 * in vacuum. A zero-thrust axis renders a muted "no thrust this axis".
 */
import { cn } from '../lib/cn';
import { formatAccel, formatDuration, formatMeters, formatSpeed } from '../lib/format';

export interface AccelBarProps {
  label: string;
  /** Acceleration for this axis, m/s². */
  accel: number;
  /** Strongest axis acceleration in the build, for proportional bar width. */
  maxAccel: number;
  /** Seconds to reach the speed cap from rest (Infinity if unreachable). */
  timeToTopSpeed: number;
  /** Meters travelled reaching the speed cap (Infinity if unreachable). */
  distanceToTopSpeed: number;
  /** The speed cap the time/distance target, m/s. */
  topSpeed: number;
  /**
   * Optional goal acceleration to mark on the bar (m/s²), drawn as an accent line
   * scaled the same way as the fill (relative to `maxAccel`). Omit for no marker;
   * a non-positive goal is ignored.
   */
  goalAccel?: number;
  /** Emphasize this axis (the UP/lift direction). */
  emphasis?: boolean;
  className?: string;
}

export function AccelBar({
  label,
  accel,
  maxAccel,
  timeToTopSpeed,
  distanceToTopSpeed,
  topSpeed,
  goalAccel,
  emphasis,
  className,
}: AccelBarProps): React.JSX.Element {
  const hasThrust = accel > 0;
  const pct = hasThrust && maxAccel > 0 ? (accel / maxAccel) * 100 : 0;
  // Goal marker: positive target scaled to the same axis as the fill. Clamp to
  // the bar so a goal beyond the strongest axis still shows at the far edge.
  const showGoal = goalAccel !== undefined && Number.isFinite(goalAccel) && goalAccel > 0 && maxAccel > 0;
  const goalPct = showGoal ? Math.min(100, (goalAccel / maxAccel) * 100) : 0;

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
            hasThrust ? 'text-fg-bright' : 'text-muted',
          )}
        >
          {hasThrust ? formatAccel(accel) : 'n/a'}
        </span>
      </div>
      <div
        className={cn('relative w-full overflow-hidden rounded-full bg-bg', emphasis ? 'h-3' : 'h-2')}
        role="meter"
        aria-label={`${label} acceleration`}
        aria-valuenow={hasThrust ? Math.round(accel * 100) / 100 : undefined}
        aria-valuemin={0}
        aria-valuetext={hasThrust ? formatAccel(accel) : 'no thrust this axis'}
      >
        {hasThrust ? (
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        ) : (
          <div className="h-full w-full bg-border-strong/40" />
        )}
        {/* Goal marker (accent), when a positive target is set. */}
        {showGoal && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-accent-bright"
            style={{ left: `${goalPct}%` }}
            aria-hidden
          />
        )}
      </div>
      {hasThrust ? (
        <span className="text-[11px] text-subtle">
          reaches {formatSpeed(topSpeed)} in {formatDuration(timeToTopSpeed)} ·{' '}
          {formatMeters(distanceToTopSpeed)}
        </span>
      ) : (
        <span className="text-[11px] text-subtle">no thrust this axis</span>
      )}
    </div>
  );
}
