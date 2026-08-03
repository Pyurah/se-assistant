/**
 * MotionPanel — dampener stopping distance, gyro turn rate, and thrust-center
 * alignment (Motion & Stability, Phase 2 / M6).
 *
 * Three stacked sections mirror the fuel/power panels' rhythm:
 *   1. Stopping distance — the user picks a cruise speed (SE's 100 m/s default,
 *      or 50 m/s, or a free numeric entry) and sees how far and how long the
 *      ship coasts while dampeners brake it, per main travel direction. A
 *      direction with no opposing thrust reads "won't stop".
 *   2. Turn rate — total gyro torque and an ESTIMATED time to a 90° turn, clearly
 *      badged as an estimate (approximate solid-cube inertia). "no gyroscopes"
 *      when there's no torque.
 *   3. Thrust-center alignment — needs block geometry. Surfaces the worst
 *      thrust-to-CoM offset as an actionable insight ("UP thrust is offset 3.2 m
 *      … expect roll") and lists every direction. Without geometry (the
 *      estimator case) it shows a tidy "import a blueprint" note.
 *
 * Reads the shared loaded mass / planet from useAnalysis for header context and
 * recomputes reactively via useMotion when the planet or cargo changes.
 */
import { useState } from 'react';
import type { Direction } from '@data';
import type { AlignmentResult } from '@core';
import { useMotion } from '../../app/hooks/use-motion';
import { useAnalysis } from '../../app/hooks/use-analysis';
import { formatMeters, formatDuration, formatMass, formatForce } from '../lib/format';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';
import { Badge } from '../components/Badge';
import { IconGauge, IconCompass, IconAlert, IconCheck, IconLayers } from '../components/icons';

/** SE's default speed limit and a common cruise, offered as one-tap presets. */
const SPEED_PRESETS: readonly number[] = [100, 50];

/** Main travel directions we report a stopping run for, with human labels. */
const STOP_DIRECTIONS: readonly { direction: Direction; label: string }[] = [
  { direction: 'forward', label: 'Forward' },
  { direction: 'up', label: 'Up (climb)' },
  { direction: 'down', label: 'Down (descend)' },
];

/** Direction → the noun the alignment insight uses ("UP thrust", …). */
const DIRECTION_LABEL: Record<Direction, string> = {
  up: 'UP',
  down: 'DOWN',
  forward: 'FORWARD',
  backward: 'BACKWARD',
  left: 'LEFT',
  right: 'RIGHT',
};

/**
 * Offset (m) above which off-center thrust is worth flagging. Large grids are
 * coarser (2.5 m cells) so a bigger absolute offset is tolerable than on small
 * grids (0.5 m cells).
 */
function offsetThreshold(gridSize: 'large' | 'small'): number {
  return gridSize === 'large' ? 1.5 : 0.5;
}

export function MotionPanel(): React.JSX.Element | null {
  const motion = useMotion();
  const analysis = useAnalysis();
  const [speed, setSpeed] = useState(100);

  if (!motion || !analysis) return null;

  const { turnRate, alignment, hasGeometry, stopping } = motion;
  const { planet, mass } = analysis;
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : 0;

  return (
    <Panel
      title="Motion & stability"
      icon={<IconGauge size={16} />}
      subtitle={`at ${formatMass(mass.loadedMass)} loaded on ${planet.displayName}`}
    >
      <div className="flex flex-col gap-5">
        <StoppingSection
          speed={speed}
          safeSpeed={safeSpeed}
          onSpeedChange={setSpeed}
          stopping={stopping}
        />
        <TurnRateSection turnRate={turnRate} />
        <AlignmentSection
          alignment={alignment}
          hasGeometry={hasGeometry}
          gridSize={motion.design.gridSize}
        />
      </div>
    </Panel>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">{children}</span>
  );
}

function StoppingSection({
  speed,
  safeSpeed,
  onSpeedChange,
  stopping,
}: {
  speed: number;
  safeSpeed: number;
  onSpeedChange: (v: number) => void;
  stopping: (direction: Direction, speed: number) => { distance: number; time: number };
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Dampener stopping distance</SectionLabel>

      {/* Speed control: preset chips + a labeled free entry. */}
      <div className="flex flex-wrap items-center gap-2">
        {SPEED_PRESETS.map((preset) => {
          const active = speed === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onSpeedChange(preset)}
              aria-pressed={active}
              className={
                active
                  ? 'rounded-md border border-accent bg-accent px-2.5 py-1 text-xs font-medium text-white transition-colors duration-150'
                  : 'rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:border-border-strong hover:text-fg'
              }
            >
              {preset} m/s
            </button>
          );
        })}
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Speed</span>
          <input
            type="number"
            min={0}
            step={5}
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            aria-label="Cruise speed in meters per second"
            className="h-8 w-20 rounded-md border border-border bg-bg px-2 font-mono text-sm text-fg transition-colors hover:border-border-strong focus:border-accent focus:outline-none"
          />
          <span className="font-mono text-xs text-subtle">m/s</span>
        </label>
      </div>

      {/* Per-direction stopping run. */}
      <div className="flex flex-col gap-1.5">
        {STOP_DIRECTIONS.map(({ direction, label }) => {
          const result = stopping(direction, safeSpeed);
          const wontStop = !Number.isFinite(result.distance);
          return (
            <div
              key={direction}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            >
              <span className="text-muted">{label}</span>
              {wontStop ? (
                <span className="flex items-center gap-1.5 font-medium text-warning">
                  <IconAlert size={14} />
                  no braking thrust — won&apos;t stop
                </span>
              ) : (
                <span className="flex items-baseline gap-2">
                  <span className="font-mono font-semibold text-fg-bright">
                    {formatMeters(result.distance)}
                  </span>
                  <span className="font-mono text-xs text-subtle">
                    {formatDuration(result.time)}
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-subtle">
        Thrust-only braking from {safeSpeed > 0 ? `${safeSpeed} m/s` : 'a stop'} — ignores per-axis
        gravity, so it&apos;s accurate in space and in level flight.
      </p>
    </div>
  );
}

function TurnRateSection({
  turnRate,
}: {
  turnRate: {
    totalTorque: number;
    angularAcceleration: number;
    timeToQuarterTurn: number;
  };
}): React.JSX.Element {
  const noGyros = turnRate.totalTorque <= 0 || !Number.isFinite(turnRate.timeToQuarterTurn);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <SectionLabel>Turn rate · 90° turn</SectionLabel>
        <Badge variant="warning" icon={<IconCompass size={11} />}>
          estimate
        </Badge>
      </div>

      {noGyros ? (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <span className="text-warning">
            <IconAlert size={18} />
          </span>
          <span className="text-muted">No gyroscopes — this ship can&apos;t turn under its own control.</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Stat
            label="Time to 90°"
            value={formatDuration(turnRate.timeToQuarterTurn)}
            tone="accent"
            hint="from rest"
          />
          <Stat label="Gyro torque" value={`${formatForce(turnRate.totalTorque)}·m`} hint="total" />
          <Stat
            label="Angular accel"
            value={`${turnRate.angularAcceleration.toLocaleString('en-US', { maximumFractionDigits: turnRate.angularAcceleration >= 1 ? 2 : 4 })} rad/s²`}
          />
        </div>
      )}
      <p className="text-xs text-subtle">
        Estimate only — uses an approximate solid-cube moment of inertia; the true turn rate depends
        on how mass is distributed across the ship.
      </p>
    </div>
  );
}

function AlignmentSection({
  alignment,
  hasGeometry,
  gridSize,
}: {
  alignment: AlignmentResult[] | null;
  hasGeometry: boolean;
  gridSize: 'large' | 'small';
}): React.JSX.Element {
  // No geometry → the estimator case: nothing to align, tidy note.
  if (!hasGeometry || alignment === null || alignment.length === 0) {
    return (
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <SectionLabel>Center of mass & thrust alignment</SectionLabel>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-bg p-3 text-sm">
          <span className="mt-0.5 shrink-0 text-info">
            <IconLayers size={18} />
          </span>
          <div>
            <p className="font-medium text-fg">Needs block positions</p>
            <p className="text-muted">
              Center-of-mass and thrust alignment need block positions — available when you import a
              blueprint.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const threshold = offsetThreshold(gridSize);
  // Worst offender drives the headline insight.
  const worst = alignment.reduce((a, b) => (b.offsetMagnitude > a.offsetMagnitude ? b : a));
  const worstFlagged = worst.offsetMagnitude > threshold;

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <SectionLabel>Center of mass & thrust alignment</SectionLabel>

      {worstFlagged ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm"
        >
          <span className="mt-0.5 shrink-0 text-warning">
            <IconAlert size={18} />
          </span>
          <div>
            <p className="font-semibold text-warning">Off-center thrust may cause spin</p>
            <p className="text-muted">
              Your {DIRECTION_LABEL[worst.direction]} thrust is offset{' '}
              <span className="font-mono font-semibold text-fg">
                {formatMeters(worst.offsetMagnitude)}
              </span>{' '}
              from the center of mass — expect rotation when thrusting that way.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
          <span className="text-success">
            <IconCheck size={18} />
          </span>
          <span className="text-muted">
            Thrust is well-aligned with the center of mass — worst offset only{' '}
            <span className="font-mono text-fg">{formatMeters(worst.offsetMagnitude)}</span>.
          </span>
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {alignment.map((a) => {
          const flagged = a.offsetMagnitude > threshold;
          return (
            <li
              key={a.direction}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            >
              <span className="text-muted">{DIRECTION_LABEL[a.direction]}</span>
              <span className="flex items-center gap-2">
                <span
                  className={
                    flagged
                      ? 'font-mono font-semibold text-warning'
                      : 'font-mono font-semibold text-fg-bright'
                  }
                >
                  {formatMeters(a.offsetMagnitude)}
                </span>
                <Badge variant={flagged ? 'warning' : 'success'}>
                  {flagged ? 'off-center' : 'well-aligned'}
                </Badge>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
