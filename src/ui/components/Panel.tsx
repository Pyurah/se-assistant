/**
 * Panel — the standard elevated content container.
 *
 * A titled card with an optional icon, subtitle, and header actions slot. Every
 * analysis section is a Panel so spacing, radius, and header rhythm stay
 * identical across the dashboard.
 */
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface PanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Panel({
  title,
  subtitle,
  icon,
  actions,
  className,
  bodyClassName,
  children,
}: PanelProps): React.JSX.Element {
  return (
    <section className={cn('panel flex flex-col overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="flex shrink-0 text-muted">{icon}</span>}
            <div className="min-w-0">
              {title && (
                <h2 className="truncate text-sm font-semibold text-fg-bright">{title}</h2>
              )}
              {subtitle && <p className="truncate text-xs text-subtle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('flex-1 p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
