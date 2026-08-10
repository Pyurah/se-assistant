/**
 * EstimatorTwrPanel — the directional TWR readout for the assigned build.
 *
 * The estimate mode's answer to Analyze's TwrPanel: it runs the *same trusted
 * TWR engine* on a synthesized {@link ShipDesign} (via `estimateToDesign`) and
 * shows the six-axis thrust-to-weight, UP emphasized, with each direction's goal
 * marked on its bar and a reached/exceeded/short verdict. This is the "did I
 * hit my target on every axis?" check — especially useful once the build mixes
 * thruster types per direction (atmospheric lift, ion sides, …).
 *
 * The Empty/Loaded toggle is driven from the store (`goalLoadState`) so it stays
 * in lock-step with the assignment surface's own toggle and the goal verdicts.
 * A per-direction thruster-type caption makes a mixed build legible. Renders
 * nothing until there's a build to size against (the empty state lives in
 * RecommendationsPanel).
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
import { DEFAULT_MAX_SPEED_MPS, type Direction } from '@data';
import { useEstimate, type ResolvedAssignment } from '../../app/hooks/use-estimate';
import { useEstimatorStore } from '../../app/store/estimator-store';
import { formatTwr } from '../lib/format';
import { Panel } from '../components/Panel';
import { Badge, type BadgeVariant } from '../components/Badge';
import { TwrBar } from '../components/TwrBar';
import { AccelBar } from '../components/AccelBar';
import { SegmentedControl } from '../components/SegmentedControl';
import { SpeedCapControl } from '../components/SpeedCapControl';
import { IconRocket } from '../components/icons';
import { cn } from '../lib/cn';
import type { GoalLoadState } from '../../app/store/estimator-store';
import type { GoalVerdict } from '@core';

const DIRECTION_LABELS: Record<Direction, string> = {
  up: 'Up (lift)',
  down: 'Down',
  forward: 'Forward',
  backward: 'Backward',
  left: 'Left',
  right: 'Right',
};

const VERDICT_META: Record<GoalVerdict['status'], { label: string; variant: BadgeVariant }> = {
  exceeded: { label: 'Exceeded', variant: 'success' },
  reached: { label: 'Reached', variant: 'success' },
  short: { label: 'Short', variant: 'warning' },
};

/**
 * A short thruster-type caption for a direction, summarizing the assigned stack.
 * A single type shows its name; a mix lists "n× Model + m× Model". Empty → null.
 */
function directionCaption(assignments: readonly ResolvedAssignment[]): string | null {
  if (assignments.length === 0) return null;
  if (assignments.length === 1) return assignments[0]!.definition.displayName;
  return assignments.map((a) => `${a.count}× ${a.definition.displayName}`).join(' + ');
}

export function EstimatorTwrPanel(): React.JSX.Element | null {
  const result = useEstimate();
  const seededFrom = useEstimatorStore((s) => s.sourceName);
  const loadState = useEstimatorStore((s) => s.goalLoadState);
  const setLoadState = useEstimatorStore((s) => s.setGoalLoadState);
  const [speedCap, setSpeedCap] = useState<number>(DEFAULT_MAX_SPEED_MPS);

  // Only render once there's a build to analyze (mirrors RecommendationsPanel).
  if (!result || result.isEmpty) return null;

  const { design, directional, resolvedLayout, goals, goalVerdicts, planet } = result;
  const noGravity = planet.surfaceGravity === 0;

  const bars: DirectionalThrust = loadState === 'loaded' ? directional.loaded : directional.empty;
  const upTwr = bars.up;

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
        <SegmentedControl<GoalLoadState>
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
              const caption = directionCaption(resolvedLayout[dir]);
              const verdict = goalVerdicts[dir];
              const meta = VERDICT_META[verdict.status];
              return (
                <div key={dir} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <AccelBar
                      label={DIRECTION_LABELS[dir]}
                      accel={accel[dir].acceleration}
                      maxAccel={maxAccel}
                      timeToTopSpeed={accel[dir].timeToTopSpeed}
                      distanceToTopSpeed={accel[dir].distanceToTopSpeed}
                      topSpeed={safeCap}
                      goalAccel={verdict.goalAccel}
                      emphasis={dir === 'up'}
                      className="flex-1"
                    />
                    {goals[dir] > 0 && <Badge variant={meta.variant}>{meta.label}</Badge>}
                  </div>
                  {caption && <span className="text-[11px] text-subtle">{caption}</span>}
                </div>
              );
            })}
          </div>

          {seededFrom && (
            <p className="rounded-lg border border-border bg-bg px-3 py-2 text-[11px] text-subtle">
              Acceleration reflects the imported ship&apos;s mass and your assigned thrusters; power
              and gyros are <span className="font-medium text-muted">re-estimated</span>.
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
              const caption = directionCaption(resolvedLayout[dir]);
              const verdict = goalVerdicts[dir];
              const meta = VERDICT_META[verdict.status];
              return (
                <div key={dir} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <TwrBar
                      label={DIRECTION_LABELS[dir]}
                      twr={bars[dir]}
                      goal={goals[dir]}
                      emphasis={dir === 'up'}
                      className="flex-1"
                    />
                    {goals[dir] > 0 && <Badge variant={meta.variant}>{meta.label}</Badge>}
                  </div>
                  {caption && <span className="text-[11px] text-subtle">{caption}</span>}
                </div>
              );
            })}
          </div>

          <p className="rounded-lg bg-bg px-3 py-2 text-xs text-subtle">
            Can this build hold altitude tilted fully onto one axis? Each bar crosses the 1.0 line
            when that direction alone out-thrusts gravity; the accent mark is your goal.
          </p>

          {seededFrom && (
            <p className="rounded-lg border border-border bg-bg px-3 py-2 text-[11px] text-subtle">
              TWR reflects the imported ship&apos;s mass and your assigned thrusters; power and gyros
              are <span className="font-medium text-muted">re-estimated</span>.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
