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
import { DIRECTIONS, directionalThrust, directionalAcceleration, recommendThrusters } from '@core';
import { DEFAULT_MAX_SPEED_MPS, VANILLA_BLOCKS, type Direction, type ThrusterBlock } from '@data';
import { useAnalysis } from '../../app/hooks/use-analysis';
import { formatCount, formatForce, formatTwr } from '../lib/format';
import { Panel } from '../components/Panel';
import { TwrBar } from '../components/TwrBar';
import { AccelBar } from '../components/AccelBar';
import { SegmentedControl } from '../components/SegmentedControl';
import { SpeedCapControl } from '../components/SpeedCapControl';
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
  const [speedCap, setSpeedCap] = useState<number>(DEFAULT_MAX_SPEED_MPS);

  if (!analysis) return null;
  const { design, lift, emptyDirectional, planet, mass } = analysis;
  const noGravity = planet.surfaceGravity === 0;

  const directional = loadState === 'loaded' ? lift.loadedDirectional : emptyDirectional;
  const upTwr = loadState === 'loaded' ? lift.loadedUpTwr : lift.emptyUpTwr;

  // Space branch: TWR is meaningless with no gravity, so we report acceleration
  // (thrust/mass, exact in vacuum) and time/distance to reach the speed cap.
  const safeCap = Number.isFinite(speedCap) && speedCap > 0 ? speedCap : 0;
  const vacuumThrust = directionalThrust(design, 0);
  const accelMass = loadState === 'loaded' ? mass.loadedMass : mass.dryMass;
  const accel = directionalAcceleration(vacuumThrust, accelMass, safeCap);
  const maxAccel = Math.max(...DIRECTIONS.map((d) => accel[d].acceleration));

  // The signature insight: lifts empty but can't take off full.
  const lifecycleWarning = lift.liftsEmpty && !lift.liftsLoaded && !noGravity;

  const selectedThruster = THRUSTER_OPTIONS.find((t) => t.id === thrusterId);
  const recommendation = selectedThruster
    ? recommendThrusters(selectedThruster, planet, mass.loadedMass)
    : null;

  return (
    <Panel
      title={noGravity ? 'Directional acceleration' : 'Thrust-to-weight'}
      icon={<IconRocket size={16} />}
      subtitle={noGravity ? `in vacuum · ${planet.displayName}` : `on ${planet.displayName}`}
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
      {noGravity ? (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted">
            No gravity to fight in space — what matters is how hard you accelerate and how long it
            takes to reach top speed. Acceleration is exact here (thrust ÷ mass, no drag).
          </p>

          {/* Speed cap: preset chips + free entry (default is the vanilla 100 m/s). */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
              Top speed target
            </span>
            <SpeedCapControl speed={speedCap} onSpeedChange={setSpeedCap} />
          </div>

          {/* Directional acceleration bars */}
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
              Directional acceleration — {loadState}
            </span>
            {DIRECTIONS.map((dir) => (
              <AccelBar
                key={dir}
                label={DIRECTION_LABELS[dir]}
                accel={accel[dir].acceleration}
                maxAccel={maxAccel}
                timeToTopSpeed={accel[dir].timeToTopSpeed}
                distanceToTopSpeed={accel[dir].distanceToTopSpeed}
                topSpeed={safeCap}
                emphasis={dir === 'forward'}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Verdict */}
          <div className="grid grid-cols-2 gap-3">
            <LiftVerdict lifts={lift.liftsEmpty} twr={lift.emptyUpTwr} label="Empty" />
            <LiftVerdict lifts={lift.liftsLoaded} twr={lift.loadedUpTwr} label="Fully loaded" />
          </div>

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
              <span
                className={cn(
                  'font-mono text-xs',
                  upTwr >= 1 ? 'text-success' : 'text-danger',
                )}
              >
                up {formatTwr(upTwr)}
              </span>
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
                How many of this thruster to hover {formatCount(Math.round(mass.loadedMass))} kg
                loaded on {planet.displayName}?
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
                        {`${formatCount(recommendation.countNeeded)}×`}
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
      )}
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
