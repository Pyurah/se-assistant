/**
 * RecommendationsPanel — the estimator's build summary.
 *
 * The manual estimator lets the user assign thrusters per direction; this panel
 * summarizes the resulting build: per-direction total thruster counts (UP
 * emphasized) with a per-type breakdown when a direction mixes models, the
 * auto-sized power block count with supply-vs-draw, the (clearly labeled
 * ESTIMATE) gyro count, resulting dry/loaded mass and achieved loaded up-TWR,
 * and any engine warnings surfaced prominently. Handles three states: empty (no
 * thrusters/essentials yet → guidance), the live summary, and the warning case.
 *
 * A closing note reminds the user this is a planning estimate — import the real
 * blueprint afterward to verify against actual geometry.
 */
import type { Direction } from '@data';
import { useEstimate, type ResolvedAssignment } from '../../app/hooks/use-estimate';
import { useEstimatorStore } from '../../app/store/estimator-store';
import { formatCount, formatMass, formatPower, formatTurnTime, formatTwr } from '../lib/format';
import { Panel } from '../components/Panel';
import { Badge } from '../components/Badge';
import { Stat } from '../components/Stat';
import { Meter } from '../components/Meter';
import { IconSparkles, IconAlert, IconRocket } from '../components/icons';
import { cn } from '../lib/cn';

/**
 * A short per-type breakdown for a direction, shown only when the direction
 * mixes more than one thruster model (the uniform case stays uncluttered).
 */
function breakdownCaption(assignments: readonly ResolvedAssignment[]): string | null {
  if (assignments.length < 2) return null;
  return assignments.map((a) => `${a.count}× ${a.definition.displayName}`).join(' + ');
}

/** Directions in a readout order with UP first (the lift axis). */
const DIRECTION_ROWS: readonly { dir: Direction; label: string; emphasis?: boolean }[] = [
  { dir: 'up', label: 'Up (lift)', emphasis: true },
  { dir: 'down', label: 'Down' },
  { dir: 'forward', label: 'Forward' },
  { dir: 'backward', label: 'Backward' },
  { dir: 'left', label: 'Left' },
  { dir: 'right', label: 'Right' },
];

export function RecommendationsPanel(): React.JSX.Element {
  const result = useEstimate();
  const targetTurnTime = useEstimatorStore((s) => s.targetTurnTime);

  // Guard: the hook returns null only if core blocks fail to resolve.
  if (!result) {
    return (
      <Panel title="Recommended build" icon={<IconSparkles size={16} />}>
        <p className="py-8 text-center text-sm text-subtle">
          Couldn&apos;t assemble an estimate. Check the selected thruster and power blocks.
        </p>
      </Panel>
    );
  }

  const { estimate, powerBlock, gyro, resolvedLayout, isEmpty } = result;

  // Empty state — no thrusters or essentials declared yet.
  if (isEmpty) {
    return (
      <Panel title="Recommended build" icon={<IconSparkles size={16} />}>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-surface-2 text-accent-bright">
            <IconRocket size={24} />
          </span>
          <p className="max-w-sm text-sm text-muted">
            Add your essential gear and assign thrusters per direction on the left — the estimator
            sizes the power and gyros to fly the build you design.
          </p>
        </div>
      </Panel>
    );
  }

  const twrInfinite = !Number.isFinite(estimate.achievedUpTwr);
  const twrTone = twrInfinite
    ? 'default'
    : estimate.achievedUpTwr >= 1
      ? 'success'
      : 'danger';

  const supplyCoversDraw = estimate.powerSupply >= estimate.peakDraw;
  const powerScale = Math.max(estimate.peakDraw, estimate.powerSupply, 1);
  const powerLabel = powerBlock.displayName;

  return (
    <Panel
      title="Recommended build"
      subtitle="Your thrusters, our power & gyros"
      icon={<IconSparkles size={16} />}
      actions={<Badge variant="neutral">{formatCount(estimate.totalThrusters)} thrusters</Badge>}
    >
      <div className="flex flex-col gap-6">
        {/* Warnings — surfaced first and prominently. */}
        {estimate.warnings.length > 0 && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3"
          >
            {estimate.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 shrink-0 text-warning">
                  <IconAlert size={16} />
                </span>
                <span className="text-muted">{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Thrusters — per direction, UP emphasized, with a mix breakdown. */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
              Thrusters
            </h3>
            <span className="text-xs text-subtle">
              <span className="font-mono text-fg-bright">{formatCount(estimate.totalThrusters)}</span>{' '}
              total, your assignment
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DIRECTION_ROWS.map(({ dir, label, emphasis }) => {
              const breakdown = breakdownCaption(resolvedLayout[dir]);
              return (
                <li
                  key={dir}
                  className={cn(
                    'flex flex-col gap-0.5 rounded-lg border px-3 py-2',
                    emphasis ? 'border-accent/50 bg-accent/10' : 'border-border bg-bg',
                  )}
                >
                  <span
                    className={cn(
                      'text-[11px] tracking-wide uppercase',
                      emphasis ? 'text-accent-bright' : 'text-subtle',
                    )}
                  >
                    {label}
                  </span>
                  <span
                    className={cn(
                      'font-mono font-semibold',
                      emphasis ? 'text-lg text-fg-bright' : 'text-base text-fg',
                    )}
                  >
                    {formatCount(estimate.thrusters[dir])}
                  </span>
                  {breakdown && <span className="text-[11px] leading-tight text-subtle">{breakdown}</span>}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Power — count + supply vs draw meter. */}
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-semibold tracking-wide text-subtle uppercase">Power</h3>
            <span className="text-xs text-subtle">
              <span className="font-mono text-fg-bright">{formatCount(estimate.powerCount)}</span>×{' '}
              {powerLabel}
            </span>
          </div>
          <Meter
            value={estimate.peakDraw}
            max={powerScale}
            tone={supplyCoversDraw ? 'success' : 'danger'}
            threshold={estimate.powerSupply}
            thresholdLabel="Recommended supply"
            label="Peak draw vs. recommended supply"
            valueText={`${formatPower(estimate.peakDraw)} draw of ${formatPower(estimate.powerSupply)} supply`}
          />
          <div className="flex justify-between text-xs text-subtle">
            <span>
              Peak draw <span className="font-mono text-muted">{formatPower(estimate.peakDraw)}</span>
            </span>
            <span>
              Supply <span className="font-mono text-muted">{formatPower(estimate.powerSupply)}</span>
            </span>
          </div>
        </section>

        {/* Gyros — clearly badged as an estimate. */}
        <section className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
                Gyroscopes
              </h3>
              <Badge variant="warning">estimate</Badge>
            </div>
            <p className="text-xs text-subtle">{gyro.displayName}</p>
            <p className="text-xs text-subtle">
              Turns 90° in ≈{' '}
              <span className="font-mono text-muted">{formatTurnTime(estimate.achievedTurnTime)}</span>{' '}
              (target ≤ {formatTurnTime(targetTurnTime)})
            </p>
          </div>
          <span
            className="font-mono text-lg font-semibold text-fg-bright"
            title="Estimate — the gyro count is solved to turn the ship 90° from rest within the target time, approximating the ship as a solid cube. True turn rate depends on the ship's real geometry (moment of inertia), unknown before the build."
          >
            {formatCount(estimate.gyroCount)}
          </span>
        </section>

        {/* Resulting mass & achieved TWR. */}
        <section className="grid grid-cols-3 gap-4 border-t border-border pt-4">
          <Stat label="Dry mass" value={formatMass(estimate.dryMass)} />
          <Stat label="Loaded mass" value={formatMass(estimate.loadedMass)} />
          <Stat
            label="Loaded up-TWR"
            value={twrInfinite ? 'n/a' : formatTwr(estimate.achievedUpTwr)}
            tone={twrTone}
            hint={twrInfinite ? 'no gravity here' : undefined}
          />
        </section>

        {/* Planning-tool disclaimer. */}
        <p className="rounded-lg bg-bg px-3 py-2 text-xs text-subtle">
          This is a planning estimate to guide your build. Once you&apos;ve built and exported the
          ship, import the real blueprint in Analyze mode to verify against actual geometry.
        </p>
      </div>
    </Panel>
  );
}
