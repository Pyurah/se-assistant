/**
 * EstimatorScenarioBar — the two decisions a user makes first, made prominent.
 *
 * Grid size and environment gate everything else in a build (grid size filters
 * every selectable block; environment sets the gravity and air the goals are
 * checked against), so they live in a sticky bar pinned directly under the app
 * header — visible on load, reachable at any scroll depth — rather than buried
 * in the control rail. Both drive the same {@link useEstimatorStore} slices the
 * rest of the estimator reads. All controls are labeled and keyboard-operable.
 */
import { PLANET_PRESETS, type GridSize } from '@data';
import { useEstimatorStore } from '../../app/store/estimator-store';
import { resolvePlanet } from '../../app/hooks/use-estimate';
import { formatGravity, formatPercent } from '../lib/format';
import { Badge } from '../components/Badge';
import { SegmentedControl } from '../components/SegmentedControl';
import { IconLayers, IconGlobe } from '../components/icons';

const GRID_OPTIONS = [
  { value: 'large' as const, label: 'Large grid' },
  { value: 'small' as const, label: 'Small grid' },
];

const label = 'text-[11px] font-medium tracking-wide text-subtle uppercase';

export function EstimatorScenarioBar(): React.JSX.Element {
  const gridSize = useEstimatorStore((s) => s.gridSize);
  const planetId = useEstimatorStore((s) => s.planetId);
  const setGridSize = useEstimatorStore((s) => s.setGridSize);
  const setPlanet = useEstimatorStore((s) => s.setPlanet);
  const planet = resolvePlanet(planetId);

  return (
    <div className="panel sticky top-14 z-10 flex flex-wrap items-center gap-x-8 gap-y-4 bg-surface/95 px-5 py-4 backdrop-blur">
      {/* Grid size — the first decision; gates every selectable block. */}
      <div className="flex items-center gap-3">
        <span className={`flex items-center gap-1.5 ${label}`}>
          <IconLayers size={13} />
          Grid size
        </span>
        <SegmentedControl<GridSize>
          name="scenario-grid-size"
          ariaLabel="Grid size"
          value={gridSize}
          options={GRID_OPTIONS}
          onChange={setGridSize}
        />
      </div>

      {/* Environment — sets the gravity + air the goals are checked against. */}
      <div className="flex min-w-0 items-center gap-3">
        <label htmlFor="scenario-planet" className={`flex items-center gap-1.5 ${label}`}>
          <IconGlobe size={13} />
          Environment
        </label>
        <select
          id="scenario-planet"
          value={planetId}
          onChange={(e) => setPlanet(e.target.value)}
          className="h-9 min-w-[180px] rounded-md border border-border bg-bg px-3 text-sm text-fg transition-colors hover:border-border-strong focus:border-accent"
        >
          {PLANET_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
        <span className="font-mono text-xs text-muted">{formatGravity(planet.surfaceGravity)}</span>
        {planet.hasAtmosphere ? (
          <Badge variant="info">Air {formatPercent(planet.atmosphereDensity)}</Badge>
        ) : (
          <Badge variant="neutral">Vacuum</Badge>
        )}
      </div>
    </div>
  );
}
