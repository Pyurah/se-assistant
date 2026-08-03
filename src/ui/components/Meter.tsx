/**
 * Meter — a horizontal progress/capacity bar with an optional threshold marker.
 *
 * Used for the power budget (draw vs. generation) and cargo fill. Follows
 * dataviz best practice: a calm track, a single clear value fill, an optional
 * labeled threshold line, and an accessible `role="meter"` with aria values so
 * the number is available to assistive tech, not just conveyed by color.
 */
import { cn } from '../lib/cn';

export type MeterTone = 'accent' | 'success' | 'warning' | 'danger';

const fillClass: Record<MeterTone, string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export interface MeterProps {
  /** Current value. */
  value: number;
  /** Full-scale maximum (the track represents 0..max). */
  max: number;
  tone?: MeterTone;
  /** Optional threshold marker (e.g. sustained generation) drawn as a line. */
  threshold?: number;
  thresholdLabel?: string;
  /** Accessible name for the meter. */
  label: string;
  /** Human-formatted value text for aria. */
  valueText?: string;
  className?: string;
}

export function Meter({
  value,
  max,
  tone = 'accent',
  threshold,
  thresholdLabel,
  label,
  valueText,
  className,
}: MeterProps): React.JSX.Element {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));
  const thresholdPct =
    threshold !== undefined ? Math.min(100, Math.max(0, (threshold / safeMax) * 100)) : undefined;

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={Number.isFinite(value) ? Math.round(value) : undefined}
      aria-valuemin={0}
      aria-valuemax={Math.round(safeMax)}
      aria-valuetext={valueText}
      className={cn('relative h-3 w-full overflow-hidden rounded-full bg-bg', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-200 ease-out', fillClass[tone])}
        style={{ width: `${pct}%` }}
      />
      {thresholdPct !== undefined && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-fg-bright/70"
          style={{ left: `${thresholdPct}%` }}
          title={thresholdLabel}
          aria-hidden
        />
      )}
    </div>
  );
}
