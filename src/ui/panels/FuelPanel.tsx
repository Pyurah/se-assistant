/**
 * FuelPanel — hydrogen flight time, reactor uranium burn, and consumable runtime.
 *
 * Adapts to the ship's propulsion/power type. For a hydrogen ship the headline
 * is HOVER TIME on a full tank at the current loaded mass and planet — the
 * question that actually decides a mission. A meter places the hover burn rate
 * against the full-throttle burn (with sustained O2/H2 generation as a threshold
 * line, mirroring the PowerPanel) so it's clear how hard the thrusters work to
 * hold station and whether generators can keep up. Reactor ships get uranium
 * burn at peak draw with a "1 kg lasts X" readout; ships with neither get a
 * tidy electric/solar empty state. Infinity hover (zero-g) reads as "unlimited".
 */
import { useFuel } from '../../app/hooks/use-fuel';
import { useAnalysis } from '../../app/hooks/use-analysis';
import { formatVolume, formatDuration, formatRuntime, formatMass } from '../lib/format';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';
import { Meter } from '../components/Meter';
import { IconDroplet, IconBolt, IconAlert, IconCheck } from '../components/icons';

/** L/s burn rate → compact string ("385.6 L/s", "4.82 kL/s"). */
function formatBurnRate(litersPerSecond: number): string {
  return `${formatVolume(litersPerSecond)}/s`;
}

export function FuelPanel(): React.JSX.Element | null {
  const fuel = useFuel();
  const analysis = useAnalysis();
  if (!fuel || !analysis) return null;

  const { summary, hydrogenGeneration } = fuel;
  const { flight, uranium, batteryRuntimeHours, usesHydrogen, usesReactor } = summary;
  const { planet, mass } = analysis;
  const noGravity = planet.surfaceGravity === 0;
  const hasBattery = batteryRuntimeHours > 0;

  // Empty state: purely electric/solar propulsion — no consumable to track.
  if (!usesHydrogen && !usesReactor) {
    return (
      <Panel
        title="Fuel & flight time"
        icon={<IconDroplet size={16} />}
        subtitle={`on ${planet.displayName}`}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-bg p-3 text-sm">
            <span className="mt-0.5 shrink-0 text-info">
              <IconBolt size={18} />
            </span>
            <div>
              <p className="font-medium text-fg">No consumable fuel</p>
              <p className="text-muted">
                This ship runs on electric thrusters and/or solar — no hydrogen or uranium to burn,
                so flight time is bounded only by stored battery charge.
              </p>
            </div>
          </div>
          {hasBattery && (
            <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted">Battery runtime at peak draw</span>
              <span className="font-mono text-fg">{formatRuntime(batteryRuntimeHours)}</span>
            </div>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Fuel & flight time"
      icon={<IconDroplet size={16} />}
      subtitle={`at ${formatMass(mass.loadedMass)} loaded on ${planet.displayName}`}
    >
      <div className="flex flex-col gap-5">
        {usesHydrogen && (
          <HydrogenSection
            flight={flight}
            generation={hydrogenGeneration}
            noGravity={noGravity}
            planetName={planet.displayName}
          />
        )}

        {usesReactor && (
          <div className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
            <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
              Reactor · uranium burn
            </span>
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="At peak draw"
                value={`${formatKgPerHour(uranium.kgPerHour)}/h`}
                tone="accent"
                hint="uranium ingots consumed"
              />
              <Stat
                label="1 kg lasts"
                value={uranium.kgPerHour > 0 ? formatRuntime(1 / uranium.kgPerHour) : 'sustained'}
                hint={uranium.kgPerHour > 0 ? 'per uranium ingot' : 'no reactor load'}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
          <span className="text-muted">Battery runtime</span>
          <span className="font-mono text-fg">
            {hasBattery ? formatRuntime(batteryRuntimeHours) : 'no batteries'}
          </span>
        </div>
      </div>
    </Panel>
  );
}

/** kg/h with sensible precision (small rates need decimals). */
function formatKgPerHour(kgPerHour: number): string {
  if (!Number.isFinite(kgPerHour)) return '∞ kg';
  const maxFrac = kgPerHour >= 100 ? 0 : kgPerHour >= 1 ? 1 : 3;
  return `${kgPerHour.toLocaleString('en-US', { maximumFractionDigits: maxFrac, minimumFractionDigits: 0 })} kg`;
}

interface FlightTimeEstimateLike {
  readonly hydrogenCapacity: number;
  readonly hoverBurnRate: number;
  readonly hoverTimeSeconds: number;
  readonly fullThrottleBurnRate: number;
  readonly fullThrottleTimeSeconds: number;
  readonly canHover: boolean;
  readonly netHoverWithGeneration: number;
}

function HydrogenSection({
  flight,
  generation,
  noGravity,
  planetName,
}: {
  flight: FlightTimeEstimateLike;
  generation: number;
  noGravity: boolean;
  planetName: string;
}): React.JSX.Element {
  const scale = Math.max(flight.fullThrottleBurnRate, flight.hoverBurnRate, 1);
  // Generators sustain the hover if their output meets or beats the hover burn.
  const generatorsSustain = generation > 0 && flight.netHoverWithGeneration >= 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Headline: hover time on a full tank. */}
      {!flight.canHover ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-danger/50 bg-danger/10 p-3"
        >
          <span className="mt-0.5 shrink-0 text-danger">
            <IconAlert size={18} />
          </span>
          <div className="text-sm">
            <p className="font-semibold text-danger">Can&apos;t hold a hover</p>
            <p className="text-muted">
              Hydrogen up-thrust can&apos;t lift this mass on {planetName}, so there&apos;s no
              sustainable hover. At full throttle the tanks last{' '}
              <span className="font-mono font-semibold text-fg">
                {formatDuration(flight.fullThrottleTimeSeconds)}
              </span>
              .
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-bg p-4">
          <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
            {noGravity ? 'Hover time (zero-g)' : 'Hover time on a full tank'}
          </span>
          {noGravity ? (
            <span className="font-mono text-2xl leading-none font-semibold text-fg-bright">
              unlimited
            </span>
          ) : generatorsSustain ? (
            <span className="font-mono text-2xl leading-none font-semibold text-success">
              sustained
            </span>
          ) : (
            <span className="font-mono text-2xl leading-none font-semibold text-fg-bright">
              {formatDuration(flight.hoverTimeSeconds)}
            </span>
          )}
          <span className="text-xs text-muted">
            {noGravity
              ? 'No gravity — no burn needed to hold position.'
              : generatorsSustain
                ? 'O2/H2 generators out-produce the hover burn — hover indefinitely with ice.'
                : `burning ${formatBurnRate(flight.hoverBurnRate)} to hold station`}
          </span>
        </div>
      )}

      {/* Burn-rate meter: hover vs full-throttle, with generation threshold. */}
      {flight.fullThrottleBurnRate > 0 && (
        <div className="flex flex-col gap-2">
          <Meter
            value={flight.hoverBurnRate}
            max={scale}
            tone={flight.canHover ? 'accent' : 'danger'}
            {...(generation > 0
              ? { threshold: generation, thresholdLabel: 'O2/H2 generation' }
              : {})}
            label="Hydrogen hover burn rate"
            valueText={`${formatBurnRate(flight.hoverBurnRate)} of ${formatBurnRate(scale)} full throttle`}
          />
          <div className="flex justify-between text-xs text-subtle">
            <span>
              Hover <span className="font-mono text-muted">{formatBurnRate(flight.hoverBurnRate)}</span>
            </span>
            <span>
              Full throttle{' '}
              <span className="font-mono text-muted">{formatBurnRate(flight.fullThrottleBurnRate)}</span>
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Stat label="H2 capacity" value={formatVolume(flight.hydrogenCapacity)} />
        <Stat
          label="Full-throttle"
          value={formatDuration(flight.fullThrottleTimeSeconds)}
          hint={formatBurnRate(flight.fullThrottleBurnRate)}
        />
        <Stat
          label="Generation"
          value={generation > 0 ? formatBurnRate(generation) : 'none'}
          tone={generatorsSustain ? 'success' : 'default'}
          hint={generation > 0 ? 'O2/H2 output' : 'no generators'}
        />
      </div>

      {generation > 0 && !generatorsSustain && flight.canHover && !noGravity && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <span className="text-warning">
            <IconAlert size={18} />
          </span>
          <span className="text-muted">
            Generators slow the drain but can&apos;t match the hover burn — net{' '}
            <span className="font-mono text-fg">{formatBurnRate(Math.abs(flight.netHoverWithGeneration))}</span>{' '}
            deficit.
          </span>
        </div>
      )}
      {generatorsSustain && !noGravity && (
        <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
          <span className="text-success">
            <IconCheck size={18} />
          </span>
          <span className="text-muted">
            O2/H2 generation covers the hover burn with{' '}
            <span className="font-mono text-fg">{formatBurnRate(flight.netHoverWithGeneration)}</span>{' '}
            to spare (needs ice).
          </span>
        </div>
      )}
    </div>
  );
}
