/**
 * TwrPanel — the core thrust-to-weight readout.
 *
 * Shows the lift verdict prominently (can it take off empty? loaded?), the
 * six-axis directional TWR with UP emphasized, an empty/loaded toggle, and the
 * signature "lifts empty but not loaded" story when that's the case. Below it,
 * the thruster recommender answers "how many of thruster X to hover the current
 * loaded mass here?". Infinity (0 g) is rendered as "no gravity" throughout.
 */
import { useState } from 'react';
import { DIRECTIONS, recommendThrusters } from '@core';
import { VANILLA_BLOCKS, type Direction, type ThrusterBlock } from '@data';
import { useAnalysis } from '../../app/hooks/use-analysis';
import { formatCount, formatForce, formatTwr } from '../lib/format';
import { Panel } from '../components/Panel';
import { TwrBar } from '../components/TwrBar';
import { SegmentedControl } from '../components/SegmentedControl';
import { Badge } from '../components/Badge';
import { IconRocket, IconCheck, IconWarning } from '../components/icons';
import { cn } from '../lib/cn';

const DIRECTION_LABELS: Record<Direction, string> = {
  up: 'Up (lift)',
  down: 'Down',
  forward: 'Forward',
  backward: 'Backward',
  left: 'Left',
  right: 'Right',
};

type LoadState = 'empty' | 'loaded';

/** Only the thrusters from the dataset, for the recommender picker. */
const THRUSTER_OPTIONS = VANILLA_BLOCKS.filter(
  (b): b is ThrusterBlock => b.category === 'thruster',
);

export function TwrPanel(): React.JSX.Element | null {
  const analysis = useAnalysis();
  const [loadState, setLoadState] = useState<LoadState>('loaded');
  const [thrusterId, setThrusterId] = useState<string>(THRUSTER_OPTIONS[0]?.id ?? '');

  if (!analysis) return null;
  const { lift, emptyDirectional, planet, mass } = analysis;
  const noGravity = planet.surfaceGravity === 0;

  const directional = loadState === 'loaded' ? lift.loadedDirectional : emptyDirectional;
  const upTwr = loadState === 'loaded' ? lift.loadedUpTwr : lift.emptyUpTwr;

  // The signature insight: lifts empty but can't take off full.
  const lifecycleWarning = lift.liftsEmpty && !lift.liftsLoaded && !noGravity;

  const selectedThruster = THRUSTER_OPTIONS.find((t) => t.id === thrusterId);
  const recommendation = selectedThruster
    ? recommendThrusters(selectedThruster, planet, mass.loadedMass)
    : null;

  return (
    <Panel
      title="Thrust-to-weight"
      icon={<IconRocket size={16} />}
      subtitle={`on ${planet.displayName}`}
      actions={
        <SegmentedControl<LoadState>
          name="twr-load"
          ariaLabel="Compare empty or loaded"
          value={loadState}
          options={[
            { value: 'empty', label: 'Empty' },
            { value: 'loaded', label: 'Loaded' },
          ]}
          onChange={setLoadState}
        />
      }
    >
      <div className="flex flex-col gap-5">
        {/* Verdict */}
        {noGravity ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg p-3 text-sm text-muted">
            No gravity here — any upward thrust holds. TWR is not applicable in space.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <LiftVerdict lifts={lift.liftsEmpty} twr={lift.emptyUpTwr} label="Empty" />
            <LiftVerdict lifts={lift.liftsLoaded} twr={lift.loadedUpTwr} label="Fully loaded" />
          </div>
        )}

        {lifecycleWarning && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3"
          >
            <span className="mt-0.5 shrink-0 text-warning">
              <IconWarning size={18} />
            </span>
            <p className="text-sm text-muted">
              This ship lifts off empty at{' '}
              <span className="font-mono font-semibold text-fg">{formatTwr(lift.emptyUpTwr)}</span>{' '}
              but only reaches{' '}
              <span className="font-mono font-semibold text-warning">
                {formatTwr(lift.loadedUpTwr)}
              </span>{' '}
              fully loaded — <span className="font-medium text-fg">it can&apos;t take off with a
              full cargo hold on {planet.displayName}.</span>
            </p>
          </div>
        )}

        {/* Directional bars */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
              Directional TWR — {loadState}
            </span>
            {!noGravity && (
              <span
                className={cn(
                  'font-mono text-xs',
                  upTwr >= 1 ? 'text-success' : 'text-danger',
                )}
              >
                up {formatTwr(upTwr)}
              </span>
            )}
          </div>
          {DIRECTIONS.map((dir) => (
            <TwrBar
              key={dir}
              label={DIRECTION_LABELS[dir]}
              twr={directional[dir]}
              emphasis={dir === 'up'}
            />
          ))}
        </div>

        {/* Thruster recommender */}
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
            Thruster recommender
          </span>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">
              How many of this thruster to hover {formatCount(Math.round(mass.loadedMass))} kg loaded
              on {planet.displayName}?
            </span>
            <select
              value={thrusterId}
              onChange={(e) => setThrusterId(e.target.value)}
              aria-label="Thruster type for the recommender"
              className="h-9 rounded-md border border-border bg-bg px-3 text-sm text-fg transition-colors hover:border-border-strong focus:border-accent"
            >
              {THRUSTER_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}
                </option>
              ))}
            </select>
          </label>

          {recommendation && (
            <div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2.5">
              {recommendation.feasible ? (
                <>
                  <div className="flex flex-col">
                    <span className="text-xs tracking-wide text-subtle uppercase">Needed</span>
                    <span className="font-mono text-lg font-semibold text-fg-bright">
                      {noGravity ? '0' : `${formatCount(recommendation.countNeeded)}×`}
                    </span>
                  </div>
                  <span className="text-right text-xs text-muted">
                    {formatForce(recommendation.effectivePerThruster)} each
                    <br />
                    at this air density
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="danger" icon={<IconWarning size={12} />}>
                    Won&apos;t work here
                  </Badge>
                  <span className="text-xs text-muted">
                    Produces no usable thrust at this atmosphere.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** A compact pass/fail verdict card for one load state. */
function LiftVerdict({
  lifts,
  twr,
  label,
}: {
  lifts: boolean;
  twr: number;
  label: string;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3',
        lifts ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10',
      )}
    >
      <span className={cn('shrink-0', lifts ? 'text-success' : 'text-danger')}>
        {lifts ? <IconCheck size={20} /> : <IconWarning size={20} />}
      </span>
      <div className="flex flex-col">
        <span className="text-[11px] tracking-wide text-subtle uppercase">{label}</span>
        <span className={cn('text-sm font-semibold', lifts ? 'text-success' : 'text-danger')}>
          {lifts ? 'Lifts off' : "Can't lift"} · {formatTwr(twr)}
        </span>
      </div>
    </div>
  );
}
