/**
 * PowerPanel — available power vs. realistic peak draw, brownout warning,
 * battery runtime.
 *
 * "Peak draw" is the realistic worst case: opposing thrusters (up vs. down,
 * etc.) never fire together, so the engine counts the larger side of each
 * opposing pair, not all six axes. "Available power" is sustained generation
 * plus battery discharge — a battery-only ship is powered by its batteries, not
 * "0 W". The meter shows peak draw against available power, with a threshold
 * line at sustained generation so it's clear whether reactors/engines alone
 * cover the load or the batteries are carrying it. A brownout banner appears
 * only when draw exceeds all available power.
 */
import { useAnalysis } from '../../app/hooks/use-analysis';
import { formatPower, formatEnergy, formatRuntime } from '../lib/format';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';
import { Meter } from '../components/Meter';
import { IconBolt, IconAlert, IconCheck } from '../components/icons';

export function PowerPanel(): React.JSX.Element | null {
  const analysis = useAnalysis();
  if (!analysis) return null;
  const { power } = analysis;

  const scale = Math.max(power.peakDraw, power.availablePower, 1);
  // Generation alone covers the draw when there's no battery deficit.
  const generationCovers = power.batteryRuntimeHours === Infinity;
  const meterTone = power.brownout ? 'danger' : generationCovers ? 'success' : 'warning';

  return (
    <Panel
      title="Power budget"
      icon={<IconBolt size={16} />}
      subtitle="Realistic peak draw at full throttle"
    >
      <div className="flex flex-col gap-5">
        {power.brownout ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-danger/50 bg-danger/10 p-3"
          >
            <span className="mt-0.5 shrink-0 text-danger">
              <IconAlert size={18} />
            </span>
            <div className="text-sm">
              <p className="font-semibold text-danger">Brownout — power deficit</p>
              <p className="text-muted">
                Peak draw exceeds generation plus battery output. Systems will drop under full
                load. Add generation, add batteries, or reduce thruster draw.
              </p>
            </div>
          </div>
        ) : generationCovers ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
            <span className="text-success">
              <IconCheck size={18} />
            </span>
            <span className="text-muted">Generation covers peak draw with margin.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
            <span className="text-success">
              <IconCheck size={18} />
            </span>
            <span className="text-muted">
              {power.batteryOnly
                ? 'Batteries power this ship — supply covers the peak draw.'
                : 'Batteries cover the peak draw on top of generation.'}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Meter
            value={power.peakDraw}
            max={scale}
            tone={meterTone}
            threshold={power.generation}
            thresholdLabel="Sustained generation"
            label="Peak power draw"
            valueText={`${formatPower(power.peakDraw)} of ${formatPower(scale)}`}
          />
          <div className="flex justify-between text-xs text-subtle">
            <span>
              Draw <span className="font-mono text-muted">{formatPower(power.peakDraw)}</span>
            </span>
            <span>
              Available <span className="font-mono text-muted">{formatPower(power.availablePower)}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
          <Stat
            label="Surplus"
            value={formatPower(power.surplus)}
            tone={power.surplus >= 0 ? 'success' : 'danger'}
            hint={power.batteryOnly ? 'battery supply' : `gen ${formatPower(power.generation)}`}
          />
          <Stat label="Battery" value={formatEnergy(power.batteryCapacity)} />
          <Stat
            label="Runtime"
            value={formatRuntime(power.batteryRuntimeHours)}
            tone={power.batteryRuntimeHours === 0 && power.brownout ? 'danger' : 'default'}
            hint={power.batteryOutput > 0 ? `${formatPower(power.batteryOutput)} out` : 'no batteries'}
          />
        </div>
      </div>
    </Panel>
  );
}
