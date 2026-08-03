import { logger } from '@core';
import { useAppModeStore, type AppMode } from './store/app-mode-store';
import { useDesignStore } from './store/design-store';
import { ImportScreen } from '../ui/panels/ImportScreen';
import { AnalysisDashboard } from './AnalysisDashboard';
import { EstimatorDashboard } from './EstimatorDashboard';
import { SegmentedControl } from '../ui/components/SegmentedControl';
import { IconRocket, IconList, IconSparkles } from '../ui/components/icons';

const log = logger.child({ module: 'app-shell' });

const MODE_OPTIONS = [
  { value: 'analyze' as const, label: 'Analyze blueprint' },
  { value: 'estimate' as const, label: 'Estimate build' },
];

/**
 * Application shell (kept thin).
 *
 * A top bar carries the app identity and the top-level mode switch between
 * "Analyze blueprint" (import a finished `.sbc`) and "Estimate build" (design a
 * ship's requirements from scratch). Below it, the active mode renders its own
 * surface. The two modes have fully independent stores, so switching between
 * them never disturbs the other's state. All feature UI lives in `src/ui` /
 * mode dashboards; this file only routes.
 */
export function App(): React.JSX.Element {
  const mode = useAppModeStore((s) => s.mode);
  const setMode = useAppModeStore((s) => s.setMode);
  const hasDesign = useDesignStore((s) => s.design !== null);
  log.debug('app render', { mode, hasDesign });

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg/80 px-6 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-accent-bright">
            <IconRocket size={16} />
          </span>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-fg-bright">
            SE Assistant
          </div>
        </div>
        <SegmentedControl<AppMode>
          name="app-mode"
          ariaLabel="Application mode"
          value={mode}
          options={MODE_OPTIONS}
          onChange={setMode}
        />
        <span className="hidden items-center gap-1.5 text-xs text-subtle sm:flex">
          {mode === 'analyze' ? (
            <>
              <IconList size={14} /> Analyze a finished ship
            </>
          ) : (
            <>
              <IconSparkles size={14} /> Plan a build from scratch
            </>
          )}
        </span>
      </header>

      {mode === 'estimate' ? (
        <EstimatorDashboard />
      ) : hasDesign ? (
        <AnalysisDashboard />
      ) : (
        <ImportScreen />
      )}
    </div>
  );
}
