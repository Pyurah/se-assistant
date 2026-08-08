/**
 * SeedFromBlueprint — the Estimate-mode surface for starting from a real ship.
 *
 * Owns the three seed-related affordances in one place so EssentialsBuilder and
 * the estimator config stay focused on hand-editing:
 *   - When the build was NOT seeded from a blueprint: a compact dropzone /
 *     picker ("start from a blueprint") that parses a `.sbc` and seeds the build.
 *   - When it WAS seeded: a status strip — "Matches _{source}_" or "Adjusted —
 *     no longer matches _{source}_" (via {@link isAdjustedFromSource}) with a
 *     one-click **Reset to source**.
 *   - Seed diagnostics: any blocks that couldn't be carried over (modded /
 *     unrecognized) are listed as chips, mirroring the analyze-mode diagnostics.
 *
 * Seeding never mutates the source design — the estimator snapshots it and hands
 * back a fresh mutable build (see the estimator store's `seedFromDesign`).
 */
import { useCallback, useRef, useState } from 'react';
import { useEstimatorStore, isAdjustedFromSource } from '../../app/store/estimator-store';
import { readBlueprintFile } from '../lib/blueprint-import';
import { Button } from '../components/Button';
import { IconUpload, IconRefresh, IconCheck, IconWarning, IconAlert } from '../components/icons';
import { cn } from '../lib/cn';

export function SeedFromBlueprint(): React.JSX.Element {
  const seedFromDesign = useEstimatorStore((s) => s.seedFromDesign);
  const resetToSource = useEstimatorStore((s) => s.resetToSource);
  const sourceName = useEstimatorStore((s) => s.sourceName);
  const skipped = useEstimatorStore((s) => s.lastSeedSkipped);
  const planetId = useEstimatorStore((s) => s.planetId);
  const adjusted = useEstimatorStore(isAdjustedFromSource);
  const hasSource = sourceName !== null;

  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const readAndSeed = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      const outcome = await readBlueprintFile(file, planetId);
      setBusy(false);
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      seedFromDesign(outcome.result.design, outcome.fileName);
    },
    [planetId, seedFromDesign],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void readAndSeed(file);
    },
    [readAndSeed],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void readAndSeed(file);
      e.target.value = '';
    },
    [readAndSeed],
  );

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".sbc,.xml,text/xml,application/xml"
      onChange={onPick}
      className="sr-only"
      aria-label="Choose a blueprint file to seed the build"
    />
  );

  // --- Seeded state: source status + reset, plus any skipped diagnostics. ---
  if (hasSource) {
    return (
      <div className="flex flex-col gap-2">
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-lg border px-3 py-2.5',
            adjusted ? 'border-warning/40 bg-warning/5' : 'border-success/40 bg-success/5',
          )}
        >
          <span className={cn('shrink-0', adjusted ? 'text-warning' : 'text-success')}>
            {adjusted ? <IconWarning size={16} /> : <IconCheck size={16} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-fg">
              {adjusted ? 'Adjusted — no longer matches' : 'Matches'}{' '}
              <span className="font-medium text-fg-bright">{sourceName}</span>
            </p>
            <p className="truncate text-[11px] text-subtle">
              Seeded from a blueprint · counts re-estimated from the imported ship
            </p>
          </div>
          {adjusted && (
            <Button
              variant="ghost"
              icon={<IconRefresh size={14} />}
              onClick={resetToSource}
              className="shrink-0 text-subtle hover:text-fg"
            >
              Reset to source
            </Button>
          )}
        </div>

        {skipped.length > 0 && (
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-bg p-3">
            <div className="flex items-center gap-1.5 text-xs text-warning">
              <IconWarning size={13} />
              <span className="font-medium">
                {skipped.length} block type{skipped.length === 1 ? '' : 's'} not carried over
                (modded / unrecognized)
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {skipped.map((s) => (
                <span
                  key={s.id}
                  title={`${s.name} — ${s.reason}`}
                  className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted"
                >
                  {s.quantity}× {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Allow re-seeding from a different blueprint without leaving Estimate. */}
        {hiddenInput}
        <Button
          variant="ghost"
          icon={<IconUpload size={14} />}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="self-start text-subtle hover:text-fg"
        >
          {busy ? 'Reading…' : 'Seed from a different blueprint'}
        </Button>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  // --- Unseeded state: a compact dropzone to start from a blueprint. ---
  return (
    <div className="flex flex-col gap-2">
      {hiddenInput}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-busy={busy}
        aria-label="Drop a blueprint file here or click to choose one to seed the build"
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left transition-colors duration-150',
          dragging
            ? 'border-accent bg-accent/10'
            : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2',
        )}
      >
        <span className="shrink-0 text-muted">
          {busy ? (
            <span className="block size-4 animate-spin rounded-full border-2 border-border border-t-accent" />
          ) : (
            <IconUpload size={16} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-fg">
            {busy ? 'Reading blueprint…' : 'Start from a blueprint'}
          </span>
          <span className="block truncate text-[11px] text-subtle">
            Drop a <span className="font-mono">.sbc</span> to pre-fill essentials & config — counts get
            re-estimated.
          </span>
        </span>
      </button>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/50 bg-danger/10 p-2.5 text-xs"
        >
          <span className="mt-0.5 shrink-0 text-danger">
            <IconAlert size={14} />
          </span>
          <span className="text-muted">{error}</span>
        </div>
      )}
    </div>
  );
}
