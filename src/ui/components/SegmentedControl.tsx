/**
 * SegmentedControl — an accessible single-select toggle group.
 *
 * A radiogroup of pill options with a sliding accent on the active option.
 * Fully keyboard-operable (arrow keys via native radios) and each option has a
 * visible focus ring. Used for the empty/loaded TWR toggle.
 */
import { cn } from '../lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  name: string;
  /** Accessible group label. */
  ariaLabel: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  name,
  ariaLabel,
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-1 rounded-lg border border-border bg-bg p-1', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cn(
              'cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 select-none',
              active ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={active}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}
