/**
 * ImportScreen — the first-run empty state and import surface.
 *
 * Drag-and-drop a `.sbc`, use the file picker, or load the bundled example so
 * the app is explorable without a file. Handles the three async states inline:
 *   idle    — the drop zone + example affordance
 *   loading — a brief skeleton/spinner while the file is read + parsed
 *   error   — a friendly, recoverable message (retry / pick another / example)
 *
 * The drop zone is a real, focusable button with aria state so it is keyboard-
 * and screen-reader operable, not a mouse-only affordance.
 */
import { useCallback, useRef, useState } from 'react';
import { logger } from '@core';
import { useDesignStore } from '../../app/store/design-store';
import { EXAMPLE_BLUEPRINT_XML, EXAMPLE_BLUEPRINT_NAME } from '../lib/example-blueprint';
import { cn } from '../lib/cn';
import { Button } from '../components/Button';
import { IconUpload, IconRocket, IconAlert } from '../components/icons';

const log = logger.child({ module: 'import-screen' });

export function ImportScreen(): React.JSX.Element {
  const importBlueprint = useDesignStore((s) => s.importBlueprint);
  const status = useDesignStore((s) => s.status);
  const error = useDesignStore((s) => s.error);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readAndImport = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        await importBlueprint(text, file.name);
      } catch {
        // A file-read failure (rare) still lands in the store's error state via
        // importBlueprint if it reaches parse; a pre-parse read error is logged.
        log.error('failed to read dropped file', {
          fileName: file.name,
          ai: {
            actionable: true,
            suggestion: 'Ask the user to re-select the file; it may have been moved or locked.',
            severity_reason: 'Cannot import a file whose bytes are unreadable.',
          },
        });
        await importBlueprint('', file.name); // routes to a friendly error state
      }
    },
    [importBlueprint],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void readAndImport(file);
    },
    [readAndImport],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void readAndImport(file);
      // Reset so re-picking the same file fires change again.
      e.target.value = '';
    },
    [readAndImport],
  );

  const loading = status === 'loading';

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 px-6 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-surface text-accent-bright">
          <IconRocket size={24} />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-fg-bright">Analyze a ship</h1>
        <p className="max-w-md text-sm text-muted">
          Drop an exported Space Engineers blueprint (<span className="font-mono">.sbc</span>) to see
          its thrust-to-weight, mass, cargo, and power — empty vs. fully loaded, on any planet.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".sbc,.xml,text/xml,application/xml"
        onChange={onPick}
        className="sr-only"
        aria-label="Choose a blueprint file"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-busy={loading}
        aria-label="Drop a blueprint file here or click to choose one"
        className={cn(
          'flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors duration-150',
          dragging
            ? 'border-accent bg-accent/10'
            : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2',
        )}
      >
        {loading ? (
          <>
            <span className="size-6 animate-spin rounded-full border-2 border-border border-t-accent" />
            <span className="text-sm text-muted">Reading blueprint…</span>
          </>
        ) : (
          <>
            <span className="text-muted">
              <IconUpload size={28} />
            </span>
            <span className="text-sm font-medium text-fg">
              Drop <span className="font-mono">.sbc</span> here, or click to browse
            </span>
            <span className="text-xs text-subtle">Your file never leaves the browser.</span>
          </>
        )}
      </button>

      {status === 'error' && error && (
        <div
          role="alert"
          className="flex w-full items-start gap-3 rounded-lg border border-danger/50 bg-danger/10 p-3 text-sm"
        >
          <span className="mt-0.5 shrink-0 text-danger">
            <IconAlert size={18} />
          </span>
          <div className="flex-1">
            <p className="font-medium text-fg-bright">Couldn&apos;t import that file</p>
            <p className="text-muted">{error}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-subtle">
        <span className="h-px w-8 bg-border" />
        or
        <span className="h-px w-8 bg-border" />
      </div>

      <Button
        variant="secondary"
        icon={<IconRocket size={16} />}
        disabled={loading}
        onClick={() => void importBlueprint(EXAMPLE_BLUEPRINT_XML, EXAMPLE_BLUEPRINT_NAME)}
      >
        Load example ship
      </Button>
    </div>
  );
}
