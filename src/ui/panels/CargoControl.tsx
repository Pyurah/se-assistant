/**
 * CargoControl — the fill-fraction slider and cargo-density picker.
 *
 * These two inputs define the "loaded" state everything else compares against.
 * The slider is a labeled native range (keyboard-operable, aria-valuetext for
 * screen readers); density offers common-cargo presets plus a free numeric
 * input for anything in between. Changes flow to the store and recompute live.
 */
import { useDesignStore } from '../../app/store/design-store';
import { useAnalysis } from '../../app/hooks/use-analysis';
import { formatMass, formatPercent, formatVolume } from '../lib/format';
import { Panel } from '../components/Panel';
import { IconBox } from '../components/icons';
import { cn } from '../lib/cn';

/** Representative average densities (kg/L) for common Space Engineers cargo. */
const DENSITY_PRESETS: readonly { label: string; density: number }[] = [
  { label: 'Ice', density: 0.92 },
  { label: 'Components', density: 1.5 },
  { label: 'Ingots', density: 2.0 },
  { label: 'Ore', density: 2.7 },
  { label: 'Uranium', density: 7.6 },
];

export function CargoControl(): React.JSX.Element {
  const cargo = useDesignStore((s) => s.cargo);
  const setCargoFill = useDesignStore((s) => s.setCargoFill);
  const setCargoDensity = useDesignStore((s) => s.setCargoDensity);
  const analysis = useAnalysis();

  const fillPct = Math.round(cargo.fillFraction * 100);
  const payload = analysis ? analysis.mass.cargoMass : 0;
  const capacity = analysis ? analysis.mass.cargoCapacity : 0;

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
          <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
            Cargo density
          </span>
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

        <div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2">
          <span className="text-xs tracking-wide text-subtle uppercase">Payload added</span>
          <span className="font-mono text-sm font-semibold text-fg-bright">{formatMass(payload)}</span>
        </div>
      </div>
    </Panel>
  );
}
