import { logger } from '@core/logger';

const log = logger.child({ module: 'app-shell' });

/**
 * Application shell.
 *
 * This is scaffolding only: it renders a landing state that confirms the
 * infrastructure is wired up (logging, styling, aliases, build). Feature UI —
 * blueprint import, block list, TWR / mass / power panels — is built in
 * roadmap Phase 1 and beyond, and belongs in dedicated components under
 * `src/ui`. Keep this file thin.
 */
export function App(): React.JSX.Element {
  log.debug('app shell mounted');

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col items-start justify-center gap-6 px-6 py-16">
      <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium tracking-wide text-muted uppercase">
        Scaffolding ready
      </span>
      <h1 className="text-4xl font-semibold tracking-tight text-fg">SE Assistant</h1>
      <p className="max-w-xl text-lg text-muted">
        A Space Engineers ship &amp; base planner. Import a blueprint and get instant
        thrust-to-weight, mass, cargo, and power analysis — empty vs fully loaded, on any planet.
      </p>
      <p className="max-w-xl text-sm text-muted">
        The project is scaffolded and verified. Feature work begins with{' '}
        <span className="font-mono text-fg">Phase 1</span> — see{' '}
        <span className="font-mono text-fg">roadmap.md</span>.
      </p>
    </main>
  );
}
