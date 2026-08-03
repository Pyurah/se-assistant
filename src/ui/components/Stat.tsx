/**
 * Stat — a labeled value with an optional hint and emphasis tone.
 *
 * The workhorse readout for the dashboard: a small uppercase label over a large
 * monospace value. `tone` tints the value for pass/fail/warn semantics.
 */
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type StatTone = 'default' | 'success' | 'warning' | 'danger' | 'accent';

const toneClass: Record<StatTone, string> = {
  default: 'text-fg-bright',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  accent: 'text-accent-bright',
};

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  className?: string;
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
  className,
}: StatProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">{label}</span>
      <span className={cn('font-mono text-lg leading-none font-semibold', toneClass[tone])}>
        {value}
      </span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}
