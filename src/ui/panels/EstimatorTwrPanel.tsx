/**
 * EstimatorTwrPanel — the directional TWR readout for the recommended build.
 *
 * The estimate mode's answer to Analyze's TwrPanel: it runs the *same trusted
 * TWR engine* on a synthesized {@link ShipDesign} (via `estimateToDesign`) and
 * shows the six-axis thrust-to-weight, UP emphasized. This is the "can I stay
 * airborne if I tilt fully to one side?" check — especially useful once the
 * build mixes thruster types per direction (atmospheric lift, ion sides, …).
 *
 * An Empty/Loaded toggle mirrors TwrPanel; a per-direction thruster-type caption
 * makes a mixed build legible. Renders nothing until there are essentials to
 * size against (the empty state lives in RecommendationsPanel).
 */
import { useState } from 'react';
import {
  DIRECTIONS,
  directionalThrust,
  directionalAcceleration,
  dryMass,
  loadedMass,
  type DirectionalThrust,
} from '@core';
import { DEFAULT_MAX_SPEED_MPS, type Direction, type ThrusterBlock } from '@data';
import { useEstimate } from '../../app/hooks/use-estimate';
import { useEstimatorStore } from '../../app/store/estimator-store';
import { formatTwr } from '../lib/format';
import { Panel } from '../components/Panel';
import { TwrBar } from '../components/TwrBar';
import { AccelBar } from '../components/AccelBar';
import { SegmentedControl } from '../components/SegmentedControl';
import { SpeedCapControl } from '../components/SpeedCapControl';
import { IconRocket } from '../components/icons';
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

/**
 * A short thruster-type caption for a direction — only shown when the build
 * actually mixes types, so the uniform (default) case stays uncluttered.
 */
function directionCaption(
  dir: Direction,
  thrusters: Record<Direction, ThrusterBlock>,
  mixed: boolean,
): string | null {
  if (!mixed) return null;
  return thrusters[dir].displayName;
}

export function EstimatorTwrPanel(): React.JSX.Element | null {
  const result = useEstimate();
  const seededFrom = useEstimatorStore((s) => s.sourceName);
  const [loadState, setLoadState] = useState<LoadState>('loaded');
  const [speedCap, setSpeedCap] = useState<number>(DEFAULT_MAX_SPEED_MPS);

  // Only render once there's a build to analyze (mirrors RecommendationsPanel).
  if (!result || result.isEmpty) return null;

  const { design, directional, thrusters, planet } = result;
  const noGravity = planet.surfaceGravity === 0;

  const bars: DirectionalThrust = loadState === 'loaded' ? directional.loaded : directional.empty;
  const upTwr = bars.up;

  // Is more than one thruster type in play across the six directions?
  const mixed = DIRECTIONS.some((d) => thrusters[d].id !== thrusters.up.id);

  // Space branch: acceleration (thrust/mass, exact in vacuum) + time/distance to
  // the speed cap, computed on the same synthesized design the TWR came from.
  const safeCap = Number.isFinite(speedCap) && speedCap > 0 ? speedCap : 0;
  const vacuumThrust = directionalThrust(design, 0);
  const accelMass = loadState === 'loaded' ? loadedMass(design) : dryMass(design);
  const accel = directionalAcceleration(vacuumThrust, accelMass, safeCap);
  const maxAccel = Math.max(...DIRECTIONS.map((d) => accel[d].acceleration));

  return (
    <Panel
      title={noGravity ? 'Directional acceleration' : 'Directional TWR'}
      subtitle={noGravity ? `in vacuum · ${planet.displayName}` : `on ${planet.displayName}`}
      icon={<IconRocket size={16} />}
      actions={
        <SegmentedControl<LoadState>
          name="est-twr-load"
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
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            No gravity to fight in space — what matters is how hard this build accelerates and how
            long it takes to reach top speed. Acceleration is exact here (thrust ÷ mass, no drag).
          </p>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
              Top speed target
            </span>
            <SpeedCapControl speed={speedCap} onSpeedChange={setSpeedCap} />
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
              Directional acceleration — {loadState}
            </span>
            {DIRECTIONS.map((dir) => {
              const caption = directionCaption(dir, thrusters, mixed);
              return (
                <div key={dir} className="flex flex-col gap-0.5">
                  <AccelBar
                    label={DIRECTION_LABELS[dir]}
                    accel={accel[dir].acceleration}
                    maxAccel={maxAccel}
                    timeToTopSpeed={accel[dir].timeToTopSpeed}
                    distanceToTopSpeed={accel[dir].distanceToTopSpeed}
                    topSpeed={safeCap}
                    emphasis={dir === 'forward'}
                  />
                  {caption && <span className="text-[11px] text-subtle">{caption}</span>}
                </div>
              );
            })}
          </div>

          {seededFrom && (
            <p className="rounded-lg border border-border bg-bg px-3 py-2 text-[11px] text-subtle">
              Acceleration reflects the imported ship&apos;s mass; thruster{' '}
              <span className="font-medium text-muted">counts are re-estimated</span>, not its
              original layout.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
              Thrust-to-weight — {loadState}
            </span>
            <span className={cn('font-mono text-xs', upTwr >= 1 ? 'text-success' : 'text-danger')}>
              up {formatTwr(upTwr)}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {DIRECTIONS.map((dir) => {
              const caption = directionCaption(dir, thrusters, mixed);
              return (
                <div key={dir} className="flex flex-col gap-0.5">
                  <TwrBar label={DIRECTION_LABELS[dir]} twr={bars[dir]} emphasis={dir === 'up'} />
                  {caption && <span className="text-[11px] text-subtle">{caption}</span>}
                </div>
              );
            })}
          </div>

          <p className="rounded-lg bg-bg px-3 py-2 text-xs text-subtle">
            Can this build hold altitude tilted fully onto one axis? Each bar crosses the 1.0 line
            when that direction alone out-thrusts gravity.
          </p>

          {seededFrom && (
            <p className="rounded-lg border border-border bg-bg px-3 py-2 text-[11px] text-subtle">
              TWR reflects the imported ship&apos;s mass; thruster{' '}
              <span className="font-medium text-muted">counts are re-estimated</span>, not its
              original layout.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
