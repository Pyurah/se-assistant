/**
 * Stepper — a compact controlled integer stepper (−/＋ around a value).
 *
 * A labeled minus/plus pair flanking a monospace count, clamped to `[min, max]`
 * with the bounding button disabled at each end. Extracted from the inline
 * quantity steppers so the manufacturing fleet controls (and future callers)
 * share one keyboard- and screen-reader-operable implementation.
 */
import { Button } from './Button';
import { IconMinus, IconPlus } from './icons';
import { cn } from '../lib/cn';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Lower bound (inclusive). Defaults to 1. */
  min?: number;
  /** Upper bound (inclusive). Unbounded when omitted. */
  max?: number;
  /** Accessible label describing what is being counted. */
  ariaLabel: string;
  className?: string;
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max,
  ariaLabel,
  className,
}: StepperProps): React.JSX.Element {
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;

  const clamp = (n: number): number => {
    const lower = Math.max(min, n);
    return max !== undefined ? Math.min(max, lower) : lower;
  };

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <Button
        variant="ghost"
        aria-label={`Decrease ${ariaLabel}`}
        disabled={atMin}
        onClick={() => onChange(clamp(value - 1))}
        className="size-7 !p-0"
      >
        <IconMinus size={14} />
      </Button>
      <span
        aria-label={ariaLabel}
        role="status"
        className="w-8 text-center font-mono text-sm tabular-nums text-fg-bright"
      >
        {value}
      </span>
      <Button
        variant="ghost"
        aria-label={`Increase ${ariaLabel}`}
        disabled={atMax}
        onClick={() => onChange(clamp(value + 1))}
        className="size-7 !p-0"
      >
        <IconPlus size={14} />
      </Button>
    </div>
  );
}
