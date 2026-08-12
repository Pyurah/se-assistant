/**
 * BuildParametersPanel — the estimator's context inputs (rail).
 *
 * These are the sections that define the *mass and power context* the
 * per-direction goals are checked against: the power source, the maneuverability
 * target, the cargo loadout, and any freeform extra mass. Environment (gravity +
 * air) is chosen in the scenario bar above. They live in the estimator's control
 * rail, separate from the thruster-assignment workbench (which owns the goals and
 * the six-direction stacks). All controls are labeled and keyboard-operable and
 * read the same {@link useEstimatorStore} slices they always have.
 */
import { useMemo, useState } from 'react';
import {
  VANILLA_BLOCKS,
  CARGO_ITEMS,
  CARGO_ITEMS_BY_ID,
  type BatteryBlock,
  type CargoItem,
  type PowerProducerBlock,
} from '@data';
import { itemCapacity } from '@core';
import {
  useEstimatorStore,
  type PowerKind,
} from '../../app/store/estimator-store';
import { useEstimate } from '../../app/hooks/use-estimate';
import {
  formatPercent,
  formatRuntime,
  formatCount,
  formatTurnTime,
} from '../lib/format';
import { Panel } from '../components/Panel';
import { SegmentedControl } from '../components/SegmentedControl';
import { IconLayers, IconBolt, IconCompass, IconBox, IconScale } from '../components/icons';
import { cn } from '../lib/cn';
import { ExtraMassFields } from './ExtraMassFields';
import { WorldMultiplierControl, ItemCapacityLine } from './InventoryCapacity';

const DENSITY_PRESETS: readonly { label: string; density: number }[] = [
  { label: 'Ice', density: 0.92 },
  { label: 'Components', density: 1.5 },
  { label: 'Ingots', density: 2.0 },
  { label: 'Ore', density: 2.7 },
  { label: 'Uranium', density: 7.6 },
];

/** Human labels + order for the carry-item picker groups. */
const ITEM_GROUP_ORDER: readonly { category: CargoItem['category']; label: string }[] = [
  { category: 'component', label: 'Components' },
  { category: 'ingot', label: 'Ingots' },
  { category: 'ore', label: 'Ores' },
];

/** Default carry-item: Steel Plate (the archetypal hauler cargo), else the first. */
const DEFAULT_CARRY_ITEM_ID = CARGO_ITEMS_BY_ID['comp-steel-plate']
  ? 'comp-steel-plate'
  : (CARGO_ITEMS[0]?.id ?? '');

const fieldLabel = 'text-[11px] font-medium tracking-wide text-subtle uppercase';
const selectClass =
  'h-9 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg transition-colors hover:border-border-strong focus:border-accent';

export function BuildParametersPanel(): React.JSX.Element {
  const gridSize = useEstimatorStore((s) => s.gridSize);
  const powerKind = useEstimatorStore((s) => s.powerKind);
  const powerBlockId = useEstimatorStore((s) => s.powerBlockId);
  const runtimeTargetHours = useEstimatorStore((s) => s.runtimeTargetHours);
  const targetTurnTime = useEstimatorStore((s) => s.targetTurnTime);
  const cargo = useEstimatorStore((s) => s.cargo);
  const extraMass = useEstimatorStore((s) => s.extraMass);
  const inventoryMultiplier = useEstimatorStore((s) => s.inventoryMultiplier);

  const setPower = useEstimatorStore((s) => s.setPower);
  const setRuntimeTargetHours = useEstimatorStore((s) => s.setRuntimeTargetHours);
  const setTargetTurnTime = useEstimatorStore((s) => s.setTargetTurnTime);
  const setCargoFill = useEstimatorStore((s) => s.setCargoFill);
  const setCargoDensity = useEstimatorStore((s) => s.setCargoDensity);
  const setAddedMass = useEstimatorStore((s) => s.setAddedMass);
  const setExtraPayload = useEstimatorStore((s) => s.setExtraPayload);
  const setInventoryMultiplier = useEstimatorStore((s) => s.setInventoryMultiplier);

  // Which item the "can carry ≈ N" readout counts — a display-only choice (no
  // store state; it doesn't change the build, only how capacity is expressed).
  const [carryItemId, setCarryItemId] = useState<string>(DEFAULT_CARRY_ITEM_ID);

  // The live estimate reports the achieved turn time next to the target.
  const result = useEstimate();

  // How many of the chosen item the synthesized build can hold — item-aware,
  // honoring per-inventory type restrictions. Runs on the estimate's design so it
  // sees the same fixed-block inventories + world multiplier the mass math does.
  const carryItem = CARGO_ITEMS_BY_ID[carryItemId];
  const canCarry = result && carryItem ? itemCapacity(result.design, carryItem) : 0;

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
    <Panel
      title="Build parameters"
      subtitle="The mass & power context your goals are checked against"
      icon={<IconLayers size={16} />}
    >
      <div className="flex flex-col gap-6">
        {/* Power source */}
        <section className="flex flex-col gap-2">
          <span className={fieldLabel}>
            <span className="mr-1 inline-flex align-middle text-subtle">
              <IconBolt size={13} />
            </span>
            Power source
          </span>
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
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <label htmlFor="est-turn-time" className={fieldLabel}>
            <span className="mr-1 inline-flex align-middle text-subtle">
              <IconCompass size={13} />
            </span>
            Maneuverability
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Turn 90° within</span>
            <input
              id="est-turn-time"
              type="number"
              min={0.25}
              max={60}
              step={0.25}
              value={targetTurnTime}
              onChange={(e) => setTargetTurnTime(Number(e.target.value))}
              aria-label="Target time to turn 90 degrees from rest, in seconds"
              className="h-8 w-20 rounded-md border border-border bg-bg px-2 font-mono text-sm text-fg transition-colors hover:border-border-strong focus:border-accent"
            />
            <span className="font-mono text-xs text-subtle">s</span>
          </div>
          <p className="text-xs text-subtle">
            {result
              ? `Sizes gyros to hit this — ${formatCount(result.estimate.gyroCount)} ${
                  result.estimate.gyroCount === 1 ? 'gyro' : 'gyros'
                } reaches ≈ ${formatTurnTime(result.estimate.achievedTurnTime)}.`
              : 'Sizes the gyro count to turn the ship 90° from rest within this time.'}
          </p>
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

          <WorldMultiplierControl
            name="estimator-inventory-multiplier"
            multiplier={inventoryMultiplier}
            onChange={setInventoryMultiplier}
          />

          <div className="flex flex-col gap-2">
            <label htmlFor="est-carry-item" className="text-xs text-muted">
              Carry item
            </label>
            <select
              id="est-carry-item"
              value={carryItemId}
              onChange={(e) => setCarryItemId(e.target.value)}
              className={selectClass}
            >
              {ITEM_GROUP_ORDER.map(({ category, label }) => (
                <optgroup key={category} label={label}>
                  {CARGO_ITEMS.filter((i) => i.category === category).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {carryItem && <ItemCapacityLine count={canCarry} itemName={carryItem.displayName} />}
          </div>
        </section>

        {/* Extra mass — freeform weight beyond the blocks & cargo */}
        <section className="flex flex-col gap-3 border-t border-border pt-4">
          <span className={fieldLabel}>
            <span className="mr-1 inline-flex align-middle text-subtle">
              <IconScale size={13} />
            </span>
            Extra mass
          </span>
          <ExtraMassFields
            extraMass={extraMass}
            onAddedChange={setAddedMass}
            onPayloadChange={setExtraPayload}
          />
        </section>
      </div>
    </Panel>
  );
}
