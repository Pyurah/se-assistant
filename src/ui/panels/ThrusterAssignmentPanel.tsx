/**
 * ThrusterAssignmentPanel — the manual thruster-assignment workbench (canvas).
 *
 * This is the heart of the manual estimator: for each of the six directions the
 * user sets a goal (TWR on a planet, a g-multiple of acceleration in space) and
 * assigns thrusters — mixing types freely (e.g. atmospheric lift + ion sides) —
 * until an inline gauge + verdict shows they've reached, exceeded, or fallen
 * short of that goal. The engine sizes only power + gyros against the resulting
 * fixed thruster set (in {@link BuildParametersPanel}); it never picks thrusters
 * for the user here.
 *
 * A load-state toggle (empty vs loaded, default loaded = worst case) decides
 * which mass the verdicts use, and it drives the same store slice the TWR panel
 * reads, so the two always agree. The six directions render as a responsive card
 * grid so each card gets room to breathe. All controls are labeled and
 * keyboard-operable.
 */
import { useMemo } from 'react';
import {
  VANILLA_BLOCKS,
  type Direction,
  type ThrusterBlock,
  type ThrusterType,
} from '@data';
import type { GoalVerdict } from '@core';
import {
  useEstimatorStore,
  type GoalLoadState,
} from '../../app/store/estimator-store';
import { useEstimate, resolvePlanet, type ResolvedAssignment } from '../../app/hooks/use-estimate';
import { formatAccel, formatForce } from '../lib/format';
import { Panel } from '../components/Panel';
import { Badge, type BadgeVariant } from '../components/Badge';
import { SegmentedControl } from '../components/SegmentedControl';
import { Stepper } from '../components/Stepper';
import { Button } from '../components/Button';
import { TwrBar } from '../components/TwrBar';
import { IconGauge, IconTrash } from '../components/icons';
import { cn } from '../lib/cn';

const THRUSTER_TYPE_LABELS: Record<ThrusterType, string> = {
  hydrogen: 'Hydrogen — works everywhere',
  ion: 'Ion — best in vacuum, weak in air',
  atmospheric: 'Atmospheric — needs air, dead in space',
};

const THRUSTER_TYPE_ORDER: readonly ThrusterType[] = ['hydrogen', 'ion', 'atmospheric'];

/** Per-direction rows for the assignment surface (UP first — the lift axis). */
const DIRECTION_ROWS: readonly { dir: Direction; label: string; emphasis?: boolean }[] = [
  { dir: 'up', label: 'Up (lift)', emphasis: true },
  { dir: 'down', label: 'Down' },
  { dir: 'forward', label: 'Forward' },
  { dir: 'backward', label: 'Backward' },
  { dir: 'left', label: 'Left' },
  { dir: 'right', label: 'Right' },
];

const VERDICT_META: Record<GoalVerdict['status'], { label: string; variant: BadgeVariant }> = {
  exceeded: { label: 'Exceeded', variant: 'success' },
  reached: { label: 'Reached', variant: 'success' },
  short: { label: 'Short', variant: 'warning' },
};

const fieldLabel = 'text-[11px] font-medium tracking-wide text-subtle uppercase';
const selectClass =
  'h-9 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg transition-colors hover:border-border-strong focus:border-accent';

export function ThrusterAssignmentPanel(): React.JSX.Element {
  const gridSize = useEstimatorStore((s) => s.gridSize);
  const planetId = useEstimatorStore((s) => s.planetId);
  const directionGoals = useEstimatorStore((s) => s.directionGoals);
  const goalLoadState = useEstimatorStore((s) => s.goalLoadState);

  const setDirectionGoal = useEstimatorStore((s) => s.setDirectionGoal);
  const setGoalLoadState = useEstimatorStore((s) => s.setGoalLoadState);
  const addThruster = useEstimatorStore((s) => s.addThruster);
  const removeThruster = useEstimatorStore((s) => s.removeThruster);
  const setThrusterCount = useEstimatorStore((s) => s.setThrusterCount);

  const planet = resolvePlanet(planetId);
  const noGravity = planet.surfaceGravity === 0;

  // The live estimate powers the per-direction goal verdicts + resolved stacks.
  const result = useEstimate();

  // Thrusters for this grid, grouped by type (hydrogen / ion / atmospheric) —
  // feeds the "add thruster type" grouped picker in every direction.
  const thrusterGroups = useMemo(() => {
    const byType = new Map<ThrusterType, ThrusterBlock[]>();
    for (const block of VANILLA_BLOCKS) {
      if (block.category !== 'thruster' || block.gridSize !== gridSize) continue;
      const list = byType.get(block.thrusterType) ?? [];
      list.push(block);
      byType.set(block.thrusterType, list);
    }
    return THRUSTER_TYPE_ORDER.map((type) => ({ type, blocks: byType.get(type) ?? [] })).filter(
      (g) => g.blocks.length > 0,
    );
  }, [gridSize]);

  return (
    <Panel
      title="Thruster assignment"
      subtitle="Set a goal per direction, then assign thrusters to hit it"
      icon={<IconGauge size={16} />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className={fieldLabel}>Goals by direction</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] tracking-wide text-subtle uppercase">Check at</span>
            <SegmentedControl<GoalLoadState>
              name="est-goal-load"
              ariaLabel="Check goals at empty or loaded mass"
              value={goalLoadState}
              options={[
                { value: 'empty', label: 'Empty' },
                { value: 'loaded', label: 'Loaded' },
              ]}
              onChange={setGoalLoadState}
            />
          </div>
        </div>
        <p className="text-xs text-subtle">
          {noGravity
            ? 'In space each goal is a target acceleration as a multiple of g (1 g = 9.81 m/s²). There is no gravity to fight — assign thrusters until each axis accelerates as hard as you want.'
            : 'On a planet each goal is a target thrust-to-weight ratio. UP must clear 1.0× just to hover; assign thrusters until each axis reaches its goal.'}
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DIRECTION_ROWS.map(({ dir, label, emphasis }) => (
            <DirectionAssignment
              key={dir}
              dir={dir}
              label={label}
              emphasis={emphasis ?? false}
              goal={directionGoals[dir]}
              noGravity={noGravity}
              verdict={result?.goalVerdicts[dir] ?? null}
              assignments={result?.resolvedLayout[dir] ?? []}
              thrusterGroups={thrusterGroups}
              onGoalChange={(g) => setDirectionGoal(dir, g)}
              onAdd={(id) => addThruster(dir, id)}
              onCount={(id, n) => setThrusterCount(dir, id, n)}
              onRemove={(id) => removeThruster(dir, id)}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
}

/** Grouped thruster picker options (by type), shared across the six directions. */
interface ThrusterGroup {
  readonly type: ThrusterType;
  readonly blocks: readonly ThrusterBlock[];
}

/**
 * One direction's assignment card, laid out as stacked tiers so nothing
 * collides in a narrow grid cell:
 *   1. identity — direction label + verdict badge
 *   2. the live gauge (TWR on a planet, accel-vs-goal in space), full width
 *   3. the goal input with a clear label
 *   4. the stack of assigned thruster types (count stepper + remove)
 *   5. the "add thruster type" grouped picker
 * UP is emphasized as the lift axis.
 */
function DirectionAssignment({
  dir,
  label,
  emphasis,
  goal,
  noGravity,
  verdict,
  assignments,
  thrusterGroups,
  onGoalChange,
  onAdd,
  onCount,
  onRemove,
}: {
  dir: Direction;
  label: string;
  emphasis: boolean;
  goal: number;
  noGravity: boolean;
  verdict: GoalVerdict | null;
  assignments: readonly ResolvedAssignment[];
  thrusterGroups: readonly ThrusterGroup[];
  onGoalChange: (goal: number) => void;
  onAdd: (blockId: string) => void;
  onCount: (blockId: string, count: number) => void;
  onRemove: (blockId: string) => void;
}): React.JSX.Element {
  const goalId = `est-goal-${dir}`;
  const addId = `est-add-thruster-${dir}`;
  const meta = verdict ? VERDICT_META[verdict.status] : null;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4',
        emphasis ? 'border-accent/50 bg-accent/5' : 'border-border bg-bg/50',
      )}
    >
      {/* Tier 1 — identity: direction label + verdict badge. */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'text-xs font-semibold tracking-wide uppercase',
            emphasis ? 'text-accent-bright' : 'text-muted',
          )}
        >
          {label}
        </span>
        {meta && <Badge variant={meta.variant}>{meta.label}</Badge>}
      </div>

      {/* Tier 2 — live gauge: TWR (planet) or accel-vs-goal (space), full width. */}
      {verdict && <GoalGauge label={label} goal={goal} verdict={verdict} noGravity={noGravity} />}

      {/* Tier 3 — goal input with a clear label. */}
      <div className="flex items-center gap-2">
        <label htmlFor={goalId} className="text-[11px] tracking-wide text-subtle uppercase">
          {noGravity ? 'Target ×g' : 'Target TWR'}
        </label>
        <input
          id={goalId}
          type="number"
          min={0}
          step={0.1}
          value={goal}
          onChange={(e) => onGoalChange(Number(e.target.value))}
          aria-label={`${label} goal ${noGravity ? 'in g' : 'thrust to weight ratio'}`}
          className="h-8 w-20 rounded-md border border-border bg-bg px-2 font-mono text-sm text-fg transition-colors hover:border-border-strong focus:border-accent"
        />
      </div>

      {/* Tier 4 — assigned thruster stack. */}
      {assignments.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {assignments.map(({ definition, count }) => (
            <li
              key={definition.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-2 py-1.5"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium text-fg" title={definition.displayName}>
                  {definition.displayName}
                </span>
                <span className="font-mono text-[11px] text-subtle">
                  {formatForce(definition.maxThrust)} each
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Stepper
                  value={count}
                  min={0}
                  onChange={(n) => onCount(definition.id, n)}
                  ariaLabel={`${definition.displayName} count for ${label}`}
                />
                <Button
                  variant="ghost"
                  aria-label={`Remove ${definition.displayName} from ${label}`}
                  onClick={() => onRemove(definition.id)}
                  className="size-7 !p-0 text-subtle hover:text-danger"
                >
                  <IconTrash size={14} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Tier 5 — add a thruster type to this direction. */}
      <select
        id={addId}
        value=""
        onChange={(e) => {
          if (e.target.value) onAdd(e.target.value);
        }}
        aria-label={`Add a thruster type to ${label}`}
        className={cn(selectClass, 'h-8 text-xs')}
      >
        <option value="">+ Add thruster type…</option>
        {thrusterGroups.map(({ type, blocks }) => (
          <optgroup key={type} label={THRUSTER_TYPE_LABELS[type]}>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName} · {formatForce(b.maxThrust)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

/**
 * The inline goal gauge for one direction. On a planet it reuses {@link TwrBar}
 * (achieved TWR with a goal marker). In space TWR is undefined, so it shows a
 * proportional accel bar comparing the achieved acceleration to the goal, with
 * both the achieved and target m/s² spelled out.
 */
function GoalGauge({
  label,
  goal,
  verdict,
  noGravity,
}: {
  label: string;
  goal: number;
  verdict: GoalVerdict;
  noGravity: boolean;
}): React.JSX.Element {
  if (!noGravity) {
    return <TwrBar label="TWR" twr={verdict.metric} goal={goal} />;
  }

  // Space: proportional accel bar (metric is accel-in-g), goal marker at `goal`.
  const scale = Math.max(verdict.metric, goal, 1e-6);
  const fillPct = Math.max(2, (verdict.metric / scale) * 100);
  const goalPct = Math.min(100, (goal / scale) * 100);
  const showGoal = goal > 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="tracking-wide text-subtle uppercase">Achieved accel</span>
        <span className="font-mono text-muted">
          {verdict.metric.toFixed(2)}×g · {formatAccel(verdict.accel)}
        </span>
      </div>
      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-bg"
        role="meter"
        aria-label={`${label} acceleration vs goal`}
        aria-valuenow={Math.round(verdict.metric * 100) / 100}
        aria-valuemin={0}
        aria-valuetext={`${verdict.metric.toFixed(2)} g of ${goal.toFixed(2)} g goal`}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
          style={{ width: `${fillPct}%` }}
        />
        {showGoal && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-accent-bright"
            style={{ left: `${goalPct}%` }}
            aria-hidden
          />
        )}
      </div>
      {showGoal && (
        <span className="text-[11px] text-subtle">
          goal {goal.toFixed(2)}×g · {formatAccel(verdict.goalAccel)}
        </span>
      )}
    </div>
  );
}
