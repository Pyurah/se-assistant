/**
 * Badge — small status/label chip.
 *
 * Colored variants always render white text (design-system rule). Neutral and
 * the stat-source variants (vanilla/blueprint/user) use tinted backgrounds with
 * colored text for a quieter, informational look. Styling lives in the `.badge`
 * component layer in index.css so the palette stays centralized.
 */
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type BadgeVariant =
  | 'neutral'
  | 'vanilla'
  | 'blueprint'
  | 'user'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export interface BadgeProps {
  variant?: BadgeVariant;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Badge({
  variant = 'neutral',
  icon,
  className,
  children,
}: BadgeProps): React.JSX.Element {
  return (
    <span className={cn('badge', `badge--${variant}`, className)}>
      {icon}
      {children}
    </span>
  );
}
