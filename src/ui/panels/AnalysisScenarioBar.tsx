/**
 * AnalysisScenarioBar — the analysis's headline context, made prominent.
 *
 * Environment is the one input a user reaches for first when a design loads
 * (which body am I evaluating this ship against?), and the imported grid size is
 * the context every readout depends on. Both sit in a sticky bar pinned directly
 * under the app header — visible on load, reachable at any scroll depth — instead
 * of buried in the control rail. The environment drives the same
 * {@link useDesignStore} slice every panel recalculates from; grid size is read
 * from the imported design and shown read-only (the blueprint decides it).
 */
import { PLANET_PRESETS } from '@data';
import { useDesignStore } from '../../app/store/design-store';
import { resolvePlanet } from '../../app/hooks/use-analysis';
import { formatGravity, formatPercent } from '../lib/format';
import { Badge } from '../components/Badge';
import { IconLayers, IconGlobe } from '../components/icons';

const label = 'text-[11px] font-medium tracking-wide text-subtle uppercase';

export function AnalysisScenarioBar(): React.JSX.Element {
  const planetId = useDesignStore((s) => s.planetId);
  const setPlanet = useDesignStore((s) => s.setPlanet);
  const gridSize = useDesignStore((s) => s.design?.gridSize);
  const planet = resolvePlanet(planetId);

  return (
    <div className="panel sticky top-14 z-10 flex flex-wrap items-center gap-x-8 gap-y-4 bg-surface/95 px-5 py-4 backdrop-blur">
      {/* Grid size — read-only; the imported blueprint decides it. */}
      <div className="flex items-center gap-3">
        <span className={`flex items-center gap-1.5 ${label}`}>
          <IconLayers size={13} />
          Grid size
        </span>
        <Badge variant="neutral">{gridSize === 'small' ? 'Small grid' : 'Large grid'}</Badge>
      </div>

      {/* Environment — sets the gravity + air every readout is evaluated against. */}
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
