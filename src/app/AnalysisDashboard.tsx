/**
 * AnalysisDashboard — the loaded-design layout.
 *
 * A thin top bar (design name, source, re-import) over an asymmetric two-track
 * layout: a sticky control rail (planet, cargo, extra mass) and a wide content
 * canvas. The TWR panel leads the canvas (it's the product's core), with the
 * remaining readouts arranged into two explicit sub-columns below it. Layout
 * collapses to a single column on narrow viewports.
 */
import { useDesignStore } from './store/design-store';
import { useEstimatorStore } from './store/estimator-store';
import { useAppModeStore } from './store/app-mode-store';
import { Button } from '../ui/components/Button';
import { IconRefresh, IconRocket, IconSparkles } from '../ui/components/icons';
import { CargoControl } from '../ui/panels/CargoControl';
import { ExtraMassControl } from '../ui/panels/ExtraMassControl';
import { AnalysisScenarioBar } from '../ui/panels/AnalysisScenarioBar';
import { TwrPanel } from '../ui/panels/TwrPanel';
import { MassPanel } from '../ui/panels/MassPanel';
import { PowerPanel } from '../ui/panels/PowerPanel';
import { FuelPanel } from '../ui/panels/FuelPanel';
import { MotionPanel } from '../ui/panels/MotionPanel';
import { BlockListPanel } from '../ui/panels/BlockListPanel';
import { BuildCostPanel } from '../ui/panels/BuildCostPanel';
import { ConveyorPanel } from '../ui/panels/ConveyorPanel';
import { LifeSupportPanel } from '../ui/panels/LifeSupportPanel';
import { CombatPanel } from '../ui/panels/CombatPanel';

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

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 p-6 lg:gap-8 lg:p-8">
        {/* Environment (+ the imported grid size) — the context every readout
            depends on — pinned on top, above the fold and reachable at any depth. */}
        <AnalysisScenarioBar />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-8">
          {/* Track 1: control rail — the inputs that define the design's context.
              Sticks below the scenario bar on wide viewports so the canvas scrolls
              past it. */}
          <div className="flex flex-col gap-6 lg:sticky lg:top-[132px] lg:self-start">
            <CargoControl />
            <ExtraMassControl />
          </div>

          {/* Track 2: content canvas — TWR headline, then a two-up readout region
              split into two explicit sub-columns so panels keep a stable order
              rather than reflowing through auto-placement. */}
          <div className="flex min-w-0 flex-col gap-6">
            <TwrPanel />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="flex flex-col gap-6">
                <MassPanel />
                <PowerPanel />
                <FuelPanel />
                <MotionPanel />
              </div>
              <div className="flex flex-col gap-6">
                <CombatPanel />
                <LifeSupportPanel />
                <ConveyorPanel />
                <BuildCostPanel />
                <BlockListPanel />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
