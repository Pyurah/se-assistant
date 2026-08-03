/**
 * PlanetSelector — choose the body the analysis is evaluated against.
 *
 * A native <select> (fully accessible, keyboard-operable, labeled) drives live
 * recalculation of every panel through the store. Below it, the chosen planet's
 * gravity and atmosphere are shown so the numbers have context.
 */
import { PLANET_PRESETS } from '@data';
import { useDesignStore } from '../../app/store/design-store';
import { resolvePlanet } from '../../app/hooks/use-analysis';
import { formatGravity, formatPercent } from '../lib/format';
import { Panel } from '../components/Panel';
import { Badge } from '../components/Badge';
import { IconGlobe } from '../components/icons';

export function PlanetSelector(): React.JSX.Element {
  const planetId = useDesignStore((s) => s.planetId);
  const setPlanet = useDesignStore((s) => s.setPlanet);
  const planet = resolvePlanet(planetId);

  return (
    <Panel title="Environment" icon={<IconGlobe size={16} />}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
            Planet / Moon
          </span>
          <select
            value={planetId}
            onChange={(e) => setPlanet(e.target.value)}
            className="h-9 rounded-md border border-border bg-bg px-3 text-sm text-fg transition-colors hover:border-border-strong focus:border-accent"
          >
            {PLANET_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] tracking-wide text-subtle uppercase">Gravity</dt>
            <dd className="font-mono text-fg">{formatGravity(planet.surfaceGravity)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] tracking-wide text-subtle uppercase">Atmosphere</dt>
            <dd className="font-mono text-fg">
              {planet.hasAtmosphere ? formatPercent(planet.atmosphereDensity) : '—'}
            </dd>
          </div>
        </dl>

        <div>
          {planet.hasAtmosphere ? (
            <Badge variant="info">Atmospheric — air-breathing thrusters work</Badge>
          ) : (
            <Badge variant="neutral">Vacuum — atmospheric thrusters are dead here</Badge>
          )}
        </div>
      </div>
    </Panel>
  );
}
