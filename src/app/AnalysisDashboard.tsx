/**
 * AnalysisDashboard — the loaded-design layout.
 *
 * A thin top bar (design name, source, re-import) over a responsive grid of
 * panels. The TWR panel leads (it's the product's core), with mass/power and
 * environment/cargo/blocks arranged around it. Layout collapses to a single
 * column on narrow viewports.
 */
import { useDesignStore } from './store/design-store';
import { useEstimatorStore } from './store/estimator-store';
import { useAppModeStore } from './store/app-mode-store';
import { Button } from '../ui/components/Button';
import { IconRefresh, IconRocket, IconSparkles } from '../ui/components/icons';
import { PlanetSelector } from '../ui/panels/PlanetSelector';
import { CargoControl } from '../ui/panels/CargoControl';
import { TwrPanel } from '../ui/panels/TwrPanel';
import { MassPanel } from '../ui/panels/MassPanel';
import { PowerPanel } from '../ui/panels/PowerPanel';
import { FuelPanel } from '../ui/panels/FuelPanel';
import { MotionPanel } from '../ui/panels/MotionPanel';
import { BlockListPanel } from '../ui/panels/BlockListPanel';

export function AnalysisDashboard(): React.JSX.Element {
  const design = useDesignStore((s) => s.design);
  const sourceName = useDesignStore((s) => s.sourceName);
  const reset = useDesignStore((s) => s.reset);
  const seedFromDesign = useEstimatorStore((s) => s.seedFromDesign);
  const setMode = useAppModeStore((s) => s.setMode);

  const useAsEstimateBase = (): void => {
    if (!design) return;
    seedFromDesign(design, sourceName ?? design.name);
    setMode('estimate');
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface/40 px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-accent-bright">
            <IconRocket size={16} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-fg-bright">
              {design?.name ?? 'Untitled design'}
            </h1>
            {sourceName && <p className="truncate text-xs text-subtle">{sourceName}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            icon={<IconSparkles size={15} />}
            disabled={!design}
            onClick={useAsEstimateBase}
          >
            Use as estimate base
          </Button>
          <Button variant="secondary" icon={<IconRefresh size={15} />} onClick={reset}>
            New import
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-4 p-6 lg:grid-cols-3">
        {/* Left column: TWR (the headline) spans two rows of importance */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <TwrPanel />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <MassPanel />
            <PowerPanel />
          </div>
          <FuelPanel />
          <MotionPanel />
        </div>

        {/* Right column: controls + manifest */}
        <div className="flex flex-col gap-4">
          <PlanetSelector />
          <CargoControl />
          <BlockListPanel />
        </div>
      </main>
    </div>
  );
}
