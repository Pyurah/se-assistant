/**
 * CargoControl — the fill-fraction slider and cargo-content picker.
 *
 * These inputs define the "loaded" state everything else compares against. In
 * the game, cargo capacity is a *volume* (the container's liters) and each item
 * shows a mass (kg) and a volume (L). The mass a full hold adds is therefore
 * `capacity_L × fill × density`, where `density = mass / volume`. Rather than
 * make the user compute kg/L by hand (the old, confusing "custom density"
 * field), this control lets them either pick a game item (Gold Ingot, Iron Ore,
 * Steel Plate, …) — whose exact mass/volume come from the dataset — or type a
 * Mass and Volume directly, and it derives the density the engine needs.
 *
 * The store's source of truth stays `densityKgPerL`; this component is the only
 * place that knows about items, keeping the engine and store unchanged.
 */
import { useMemo, useState } from 'react';
import { CARGO_ITEMS, CARGO_ITEMS_BY_ID, itemDensity, type CargoItem } from '@data';
import { itemCapacity } from '@core';
import { useDesignStore } from '../../app/store/design-store';
import { useAnalysis } from '../../app/hooks/use-analysis';
import { formatMass, formatPercent, formatVolume } from '../lib/format';
import { Panel } from '../components/Panel';
import { IconBox } from '../components/icons';
import {
  WorldMultiplierControl,
  CapacityBreakdown,
  ItemCapacityLine,
} from './InventoryCapacity';

/** Human labels + order for the item groups in the picker. */
const GROUP_ORDER: readonly { category: CargoItem['category']; label: string }[] = [
  { category: 'ingot', label: 'Ingots' },
  { category: 'ore', label: 'Ores' },
  { category: 'component', label: 'Components' },
];

const CUSTOM = 'custom';

/** Find the dataset item whose density matches the store's current density. */
function matchItemByDensity(density: number): CargoItem | undefined {
  return CARGO_ITEMS.find((item) => Math.abs(itemDensity(item) - density) < 1e-4);
}

export function CargoControl(): React.JSX.Element {
  const design = useDesignStore((s) => s.design);
  const cargo = useDesignStore((s) => s.cargo);
  const setCargoFill = useDesignStore((s) => s.setCargoFill);
  const setCargoDensity = useDesignStore((s) => s.setCargoDensity);
  const inventoryMultiplier = useDesignStore((s) => s.inventoryMultiplier);
  const setInventoryMultiplier = useDesignStore((s) => s.setInventoryMultiplier);
  const analysis = useAnalysis();

  // Selection is local UI state; the store only holds the derived density. On
  // first render, reverse-match the density to a known item so the right preset
  // shows as active (falls back to custom for a hand-entered density).
  const initialItem = useMemo(() => matchItemByDensity(cargo.densityKgPerL), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [selectedId, setSelectedId] = useState<string>(initialItem?.id ?? CUSTOM);
  const [customMass, setCustomMass] = useState<number>(initialItem?.mass ?? 1000);
  const [customVolume, setCustomVolume] = useState<number>(initialItem?.volume ?? 1000);

  const fillPct = Math.round(cargo.fillFraction * 100);
  const payload = analysis ? analysis.mass.cargoMass : 0;
  const capacity = analysis ? analysis.mass.cargoCapacity : 0;
  const isCustom = selectedId === CUSTOM;

  // How many of the *selected* item fit — item-aware, honoring each inventory's
  // type restriction (drills hold ore, reactors uranium, …). Independent of fill;
  // this is the max the ship can hold. Only meaningful for a real dataset item.
  const selectedItem = isCustom ? undefined : CARGO_ITEMS_BY_ID[selectedId];
  const canCarry = design && selectedItem ? itemCapacity(design, selectedItem) : 0;

  const selectItem = (id: string): void => {
    setSelectedId(id);
    if (id === CUSTOM) {
      const v = customVolume > 0 ? customVolume : 1;
      setCargoDensity(customMass / v);
    } else {
      const item = CARGO_ITEMS_BY_ID[id];
      if (item) setCargoDensity(itemDensity(item));
    }
  };

  const updateCustom = (mass: number, volume: number): void => {
    setCustomMass(mass);
    setCustomVolume(volume);
    if (isCustom) setCargoDensity(volume > 0 ? mass / volume : 0);
  };

  const effectiveDensity = cargo.densityKgPerL;

  return (
    <Panel title="Cargo loadout" icon={<IconBox size={16} />} subtitle="Defines the loaded state">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="cargo-fill" className="text-[11px] font-medium tracking-wide text-subtle uppercase">
              Fill level
            </label>
            <span className="font-mono text-sm font-semibold text-fg-bright">
              {formatPercent(cargo.fillFraction)}
            </span>
          </div>
          <input
            id="cargo-fill"
            type="range"
            min={0}
            max={100}
            step={1}
            value={fillPct}
            onChange={(e) => setCargoFill(Number(e.target.value) / 100)}
            aria-valuetext={`${fillPct} percent full`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-bg accent-accent"
          />
          <div className="flex justify-between text-xs text-subtle">
            <span>Empty</span>
            <span>
              {formatVolume(capacity * cargo.fillFraction)} of {formatVolume(capacity)}
            </span>
            <span>Full</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="cargo-item" className="text-[11px] font-medium tracking-wide text-subtle uppercase">
            Cargo contents
          </label>
          <select
            id="cargo-item"
            value={selectedId}
            onChange={(e) => selectItem(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-bg px-2.5 text-sm text-fg transition-colors hover:border-border-strong focus:border-accent"
          >
            {GROUP_ORDER.map(({ category, label }) => (
              <optgroup key={category} label={label}>
                {CARGO_ITEMS.filter((i) => i.category === category).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName} — {formatMass(item.mass)} / {formatVolume(item.volume)}
                  </option>
                ))}
              </optgroup>
            ))}
            <optgroup label="Other">
              <option value={CUSTOM}>Custom (enter mass &amp; volume)…</option>
            </optgroup>
          </select>

          {isCustom ? (
            <div className="flex flex-wrap items-end gap-3 rounded-lg bg-bg px-3 py-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-subtle">Mass</span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={customMass}
                    onChange={(e) => updateCustom(Number(e.target.value), customVolume)}
                    aria-label="Cargo mass in kilograms"
                    className="h-8 w-24 rounded-md border border-border bg-surface-2 px-2 font-mono text-sm text-fg transition-colors hover:border-border-strong focus:border-accent"
                  />
                  <span className="font-mono text-xs text-subtle">kg</span>
                </span>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-subtle">Volume</span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={customVolume}
                    onChange={(e) => updateCustom(customMass, Number(e.target.value))}
                    aria-label="Cargo volume in liters"
                    className="h-8 w-24 rounded-md border border-border bg-surface-2 px-2 font-mono text-sm text-fg transition-colors hover:border-border-strong focus:border-accent"
                  />
                  <span className="font-mono text-xs text-subtle">L</span>
                </span>
              </label>
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-subtle">Density</span>
                <span className="flex h-8 items-center font-mono text-sm text-fg-bright">
                  {effectiveDensity.toFixed(3)}
                  <span className="ml-1 text-subtle">kg/L</span>
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-subtle">
              Density{' '}
              <span className="font-mono text-muted">{effectiveDensity.toFixed(3)} kg/L</span>
              {' '}— derived from this item's mass and volume.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <WorldMultiplierControl
            name="analyze-inventory-multiplier"
            multiplier={inventoryMultiplier}
            onChange={setInventoryMultiplier}
          />
          {selectedItem && <ItemCapacityLine count={canCarry} itemName={selectedItem.displayName} />}
          {analysis && <CapacityBreakdown byConstraint={analysis.mass.inventoryByConstraint} />}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2">
          <span className="text-xs tracking-wide text-subtle uppercase">Payload added</span>
          <span className="font-mono text-sm font-semibold text-fg-bright">{formatMass(payload)}</span>
        </div>
      </div>
    </Panel>
  );
}
