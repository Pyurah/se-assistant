/**
 * EstimatorConfigPanel — the goals & hardware choices that drive the estimate.
 *
 * Everything here is an INPUT the engine sizes against: the environment, the
 * target TWR, the thruster model to count, the power source (battery or a
 * producer), the maneuverability target, and the cargo loadout that defines the
 * "loaded" mass. Thrusters are grouped by type with an inline note that
 * atmospheric dies in vacuum and ion is weak in air — the estimate's own
 * warnings confirm an infeasible pick, but this steers the user first.
 *
 * All controls are labeled and keyboard-operable; changes flow to the estimator
 * store and recompute the recommendation live.
 */
import { useMemo } from 'react';
import {
  PLANET_PRESETS,
  VANILLA_BLOCKS,
  type BatteryBlock,
  type Direction,
  type PowerProducerBlock,
  type ThrusterBlock,
  type ThrusterType,
} from '@data';
import type { Responsiveness, ThrusterTypeSuggestion } from '@core';
import { useEstimatorStore, type PowerKind } from '../../app/store/estimator-store';
import { resolvePlanet, useEstimate } from '../../app/hooks/use-estimate';
import { formatGravity, formatPercent, formatForce, formatRuntime, formatCount } from '../lib/format';
import { Panel } from '../components/Panel';
import { Badge } from '../components/Badge';
import { SegmentedControl } from '../components/SegmentedControl';
import { IconGauge, IconGlobe, IconBolt, IconCompass, IconBox } from '../components/icons';
import { cn } from '../lib/cn';

const THRUSTER_TYPE_LABELS: Record<ThrusterType, string> = {
  hydrogen: 'Hydrogen — works everywhere',
  ion: 'Ion — best in vacuum, weak in air',
  atmospheric: 'Atmospheric — needs air, dead in space',
};

const THRUSTER_TYPE_ORDER: readonly ThrusterType[] = ['hydrogen', 'ion', 'atmospheric'];

/** Compact type label for the per-direction ranking chips. */
const THRUSTER_TYPE_SHORT: Record<ThrusterType, string> = {
  hydrogen: 'Hydrogen',
  ion: 'Ion',
  atmospheric: 'Atmospheric',
};

/** Per-direction rows for the "customize by direction" disclosure (UP first). */
const DIRECTION_ROWS: readonly { dir: Direction; label: string }[] = [
  { dir: 'up', label: 'Up (lift)' },
  { dir: 'down', label: 'Down' },
  { dir: 'forward', label: 'Forward' },
  { dir: 'backward', label: 'Backward' },
  { dir: 'left', label: 'Left' },
  { dir: 'right', label: 'Right' },
];

const RESPONSIVENESS_OPTIONS = [
  { value: 'sluggish' as const, label: 'Sluggish' },
  { value: 'normal' as const, label: 'Normal' },
  { value: 'nimble' as const, label: 'Nimble' },
];

const DENSITY_PRESETS: readonly { label: string; density: number }[] = [
  { label: 'Ice', density: 0.92 },
  { label: 'Components', density: 1.5 },
  { label: 'Ingots', density: 2.0 },
  { label: 'Ore', density: 2.7 },
  { label: 'Uranium', density: 7.6 },
];

const fieldLabel = 'text-[11px] font-medium tracking-wide text-subtle uppercase';
const selectClass =
  'h-9 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg transition-colors hover:border-border-strong focus:border-accent';

export function EstimatorConfigPanel(): React.JSX.Element {
  const gridSize = useEstimatorStore((s) => s.gridSize);
  const planetId = useEstimatorStore((s) => s.planetId);
  const targetTwr = useEstimatorStore((s) => s.targetTwr);
  const lateralThrustFraction = useEstimatorStore((s) => s.lateralThrustFraction);
  const thrusterId = useEstimatorStore((s) => s.thrusterId);
  const thrusterOverrides = useEstimatorStore((s) => s.thrusterOverrides);
  const powerKind = useEstimatorStore((s) => s.powerKind);
  const powerBlockId = useEstimatorStore((s) => s.powerBlockId);
  const runtimeTargetHours = useEstimatorStore((s) => s.runtimeTargetHours);
  const responsiveness = useEstimatorStore((s) => s.responsiveness);
  const cargo = useEstimatorStore((s) => s.cargo);

  const setPlanet = useEstimatorStore((s) => s.setPlanet);
  const setTargetTwr = useEstimatorStore((s) => s.setTargetTwr);
  const setLateralThrustFraction = useEstimatorStore((s) => s.setLateralThrustFraction);
  const setThruster = useEstimatorStore((s) => s.setThruster);
  const setDirectionalThruster = useEstimatorStore((s) => s.setDirectionalThruster);
  const setPower = useEstimatorStore((s) => s.setPower);
  const setRuntimeTargetHours = useEstimatorStore((s) => s.setRuntimeTargetHours);
  const setResponsiveness = useEstimatorStore((s) => s.setResponsiveness);
  const setCargoFill = useEstimatorStore((s) => s.setCargoFill);
  const setCargoDensity = useEstimatorStore((s) => s.setCargoDensity);

  const planet = resolvePlanet(planetId);

  // The live estimate powers the per-direction ranked type suggestions. Guard
  // null (unresolvable config) — the chips simply don't render in that case.
  const result = useEstimate();
  const suggestions = result?.suggestions ?? null;

  // Thrusters for this grid, grouped by type (hydrogen / ion / atmospheric).
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

  // Power producers for this grid (batteries handled separately).
  const producers = useMemo(
    () =>
      VANILLA_BLOCKS.filter(
        (b): b is PowerProducerBlock =>
          b.gridSize === gridSize &&
          (b.category === 'reactor' ||
            b.category === 'solar' ||
            b.category === 'hydrogen-engine' ||
            b.category === 'wind-turbine'),
      ),
    [gridSize],
  );
  const batteries = useMemo(
    () => VANILLA_BLOCKS.filter((b): b is BatteryBlock => b.gridSize === gridSize && b.category === 'battery'),
    [gridSize],
  );

  const selectedThruster = VANILLA_BLOCKS.find((b) => b.id === thrusterId);
  const selectedType =
    selectedThruster?.category === 'thruster' ? selectedThruster.thrusterType : undefined;

  // How many directions are pinned to a non-default thruster (drives the summary).
  const overrideCount = DIRECTION_ROWS.reduce(
    (n, { dir }) => n + (thrusterOverrides[dir] !== undefined ? 1 : 0),
    0,
  );

  const fillPct = Math.round(cargo.fillFraction * 100);

  const onPowerKindChange = (kind: PowerKind): void => {
    if (kind === powerKind) return;
    if (kind === 'battery') {
      setPower('battery', batteries[0]?.id ?? powerBlockId);
    } else {
      setPower('producer', producers[0]?.id ?? powerBlockId);
    }
  };

  return (
    <Panel title="Build goals" subtitle="What the estimate is sized for" icon={<IconGauge size={16} />}>
      <div className="flex flex-col gap-6">
        {/* Environment */}
        <section className="flex flex-col gap-2">
          <label htmlFor="est-planet" className={fieldLabel}>
            <span className="mr-1 inline-flex align-middle text-subtle">
              <IconGlobe size={13} />
            </span>
            Environment
          </label>
          <select
            id="est-planet"
            value={planetId}
            onChange={(e) => setPlanet(e.target.value)}
            className={selectClass}
          >
            {PLANET_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 text-xs text-subtle">
            <span className="font-mono">{formatGravity(planet.surfaceGravity)}</span>
            {planet.hasAtmosphere ? (
              <Badge variant="info">Air {formatPercent(planet.atmosphereDensity)}</Badge>
            ) : (
              <Badge variant="neutral">Vacuum</Badge>
            )}
          </div>
        </section>

        {/* Target TWR */}
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="est-twr" className={fieldLabel}>
              Target up-TWR
            </label>
            <span className="font-mono text-sm font-semibold text-fg-bright">
              {targetTwr.toFixed(1)}×
            </span>
          </div>
          <input
            id="est-twr"
            type="range"
            min={0.5}
            max={6}
            step={0.1}
            value={targetTwr}
            onChange={(e) => setTargetTwr(Number(e.target.value))}
            aria-valuetext={`${targetTwr.toFixed(1)} times hover thrust`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-bg accent-accent"
          />
          <div className="flex justify-between text-xs text-subtle">
            <span>Just hovers (1×)</span>
            <span>Agile (6×)</span>
          </div>
        </section>

        {/* Lateral thrust fraction */}
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="est-lateral" className={fieldLabel}>
              Lateral thrust
            </label>
            <span className="font-mono text-sm font-semibold text-fg-bright">
              {formatPercent(lateralThrustFraction)}
            </span>
          </div>
          <input
            id="est-lateral"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={lateralThrustFraction}
            onChange={(e) => setLateralThrustFraction(Number(e.target.value))}
            aria-valuetext={`${formatPercent(lateralThrustFraction)} of up-thrust in each other direction`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-bg accent-accent"
          />
          <p className="text-xs text-subtle">
            Thrust in each non-up direction, as a fraction of up-thrust.
          </p>
        </section>

        {/* Thruster model */}
        <section className="flex flex-col gap-2">
          <label htmlFor="est-thruster" className={fieldLabel}>
            <span className="mr-1 inline-flex align-middle text-subtle">
              <IconBolt size={13} />
            </span>
            Thruster model
          </label>
          <select
            id="est-thruster"
            value={thrusterId}
            onChange={(e) => setThruster(e.target.value)}
            className={selectClass}
          >
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
          {selectedType === 'atmospheric' && !planet.hasAtmosphere && (
            <Badge variant="warning">Atmospheric thrusters produce no thrust in vacuum</Badge>
          )}
          {selectedType === 'ion' && planet.hasAtmosphere && planet.atmosphereDensity >= 1 && (
            <Badge variant="warning">Ion thrusters are weak in dense atmosphere</Badge>
          )}

          {/* Per-direction override disclosure — mix thruster types by axis. */}
          <details className="group mt-1 rounded-md border border-border bg-bg/50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-fg">
              <span className="inline-flex items-center gap-1.5">
                Customize by direction
                {overrideCount > 0 && (
                  <Badge variant="info">
                    {overrideCount} custom
                  </Badge>
                )}
              </span>
              <span className="text-subtle transition-transform group-open:rotate-90" aria-hidden>
                ›
              </span>
            </summary>
            <div className="flex flex-col gap-2.5 border-t border-border px-3 py-3">
              <p className="text-xs text-subtle">
                Each direction uses the default above unless you pin a type here — e.g. atmospheric
                lift with ion sides. Counts are sized against the current build&apos;s loaded mass.
              </p>
              {DIRECTION_ROWS.map(({ dir, label }) => {
                const overrideId = thrusterOverrides[dir];
                const selectId = `est-thruster-${dir}`;
                const ranked = suggestions?.[dir] ?? [];
                return (
                  <div key={dir} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={selectId}
                        className="w-20 shrink-0 text-xs font-medium text-muted"
                      >
                        {label}
                      </label>
                      <select
                        id={selectId}
                        value={overrideId ?? ''}
                        onChange={(e) =>
                          setDirectionalThruster(dir, e.target.value === '' ? null : e.target.value)
                        }
                        className={cn(selectClass, 'h-8 flex-1 text-xs')}
                      >
                        <option value="">Same as default</option>
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
                    {ranked.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-[calc(5rem+0.5rem)]">
                        {ranked.map((s, i) => (
                          <SuggestionChip
                            key={s.thrusterType}
                            suggestion={s}
                            rank={i}
                            active={overrideId === s.blockId}
                            onPick={() => setDirectionalThruster(dir, s.blockId)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        </section>

        {/* Power source */}
        <section className="flex flex-col gap-2">
          <span className={fieldLabel}>Power source</span>
          <SegmentedControl<PowerKind>
            name="estimator-power-kind"
            ariaLabel="Power source kind"
            value={powerKind}
            options={[
              { value: 'battery', label: 'Battery' },
              { value: 'producer', label: 'Generator' },
            ]}
            onChange={onPowerKindChange}
          />
          <select
            aria-label="Power block model"
            value={powerBlockId}
            onChange={(e) => setPower(powerKind, e.target.value)}
            className={selectClass}
          >
            {(powerKind === 'battery' ? batteries : producers).map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
          {powerKind === 'battery' ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="est-runtime" className={fieldLabel}>
                  Battery runtime target
                </label>
                <span className="font-mono text-sm font-semibold text-fg-bright">
                  {formatRuntime(runtimeTargetHours)}
                </span>
              </div>
              <input
                id="est-runtime"
                type="range"
                min={0}
                max={4}
                step={0.25}
                value={runtimeTargetHours}
                onChange={(e) => setRuntimeTargetHours(Number(e.target.value))}
                aria-valuetext={`sustain peak draw for ${formatRuntime(runtimeTargetHours)}`}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-bg accent-accent"
              />
              <p className="text-xs text-subtle">How long batteries must sustain peak draw.</p>
            </div>
          ) : (
            <p className="text-xs text-subtle">
              Generators are sized to cover peak draw (no runtime target needed).
            </p>
          )}
        </section>

        {/* Maneuverability */}
        <section className="flex flex-col gap-2">
          <span className={fieldLabel}>
            <span className="mr-1 inline-flex align-middle text-subtle">
              <IconCompass size={13} />
            </span>
            Maneuverability
          </span>
          <SegmentedControl<Responsiveness>
            name="estimator-responsiveness"
            ariaLabel="Maneuverability target"
            value={responsiveness}
            options={RESPONSIVENESS_OPTIONS}
            onChange={setResponsiveness}
            className="w-full justify-between"
          />
          <p className="text-xs text-subtle">Drives the (estimated) gyro count.</p>
        </section>

        {/* Cargo loadout */}
        <section className="flex flex-col gap-3 border-t border-border pt-4">
          <span className={fieldLabel}>
            <span className="mr-1 inline-flex align-middle text-subtle">
              <IconBox size={13} />
            </span>
            Cargo loadout
          </span>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <label htmlFor="est-fill" className="text-xs text-muted">
                Fill level
              </label>
              <span className="font-mono text-sm font-semibold text-fg-bright">
                {formatPercent(cargo.fillFraction)}
              </span>
            </div>
            <input
              id="est-fill"
              type="range"
              min={0}
              max={100}
              step={1}
              value={fillPct}
              onChange={(e) => setCargoFill(Number(e.target.value) / 100)}
              aria-valuetext={`${fillPct} percent full`}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-bg accent-accent"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted">Cargo density</span>
            <div className="flex flex-wrap gap-1.5">
              {DENSITY_PRESETS.map((preset) => {
                const active = Math.abs(cargo.densityKgPerL - preset.density) < 1e-6;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setCargoDensity(preset.density)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-150',
                      active
                        ? 'border-accent bg-accent text-white'
                        : 'border-border bg-surface-2 text-muted hover:border-border-strong hover:text-fg',
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Custom</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={cargo.densityKgPerL}
                onChange={(e) => setCargoDensity(Number(e.target.value))}
                aria-label="Cargo density in kilograms per liter"
                className="h-8 w-24 rounded-md border border-border bg-bg px-2 font-mono text-sm text-fg transition-colors hover:border-border-strong focus:border-accent"
              />
              <span className="font-mono text-xs text-subtle">kg/L</span>
            </label>
          </div>
        </section>
      </div>
    </Panel>
  );
}

/**
 * One ranked thruster-*type* suggestion for a direction. Shows the type, the
 * count it would take (or "—" when the type is dead here), and a short
 * trade-off note. Clicking pins that type's least-added-mass variant; the
 * pinned chip highlights. The engine already sorted them, so `rank` 0 is the
 * best feasible option and gets a ✓.
 */
function SuggestionChip({
  suggestion,
  rank,
  active,
  onPick,
}: {
  suggestion: ThrusterTypeSuggestion;
  rank: number;
  active: boolean;
  onPick: () => void;
}): React.JSX.Element {
  const { thrusterType, feasible, countNeeded, note, needsFuel } = suggestion;
  const isTop = rank === 0 && feasible;
  const countLabel = !feasible ? '—' : countNeeded === 0 ? '0' : `×${formatCount(countNeeded)}`;

  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      disabled={!feasible}
      title={`${THRUSTER_TYPE_SHORT[thrusterType]} — ${note}`}
      className={cn(
        'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-150',
        active
          ? 'border-accent bg-accent text-white'
          : feasible
            ? 'border-border bg-surface-2 text-muted hover:border-border-strong hover:text-fg'
            : 'cursor-not-allowed border-border/60 bg-surface-2/50 text-subtle',
      )}
    >
      {isTop && !active && <span className="text-success" aria-hidden>✓</span>}
      <span>{THRUSTER_TYPE_SHORT[thrusterType]}</span>
      <span className={cn('font-mono', active ? 'text-white' : 'text-fg-bright')}>{countLabel}</span>
      {needsFuel && feasible && (
        <span className={cn('text-[10px]', active ? 'text-white/80' : 'text-subtle')}>fuel</span>
      )}
      {!feasible && <span className="text-[10px]">n/a here</span>}
    </button>
  );
}
