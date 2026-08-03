/**
 * Button — primary / secondary / ghost variants with a consistent height.
 *
 * Thin wrapper over a native <button> so it stays fully accessible and
 * keyboard-operable. Colors come from tokens; hover uses a subtle brightness /
 * background shift with a 150ms transition and a visible focus ring.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-bright',
  secondary: 'border border-border bg-surface-2 text-fg hover:border-border-strong hover:bg-surface',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-white hover:brightness-110',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  icon,
  className,
  children,
  type,
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClass[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
