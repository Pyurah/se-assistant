/**
 * LifeSupportPanel — crew oxygen balance, breathing time, and ice burn.
 *
 * The question this answers: "can my crew breathe, for how many people, and how
 * long do the tanks last if the generators quit?" A crew stepper (panel-owned
 * local state, like the build-cost fleet controls) drives the O₂ demand. A meter
 * places crew demand against generation so a deficit is obvious at a glance.
 * Ships with no life-support hardware get a tidy empty state rather than a wall
 * of zeros.
 */
import { useState } from 'react';
import { useLifeSupport } from '../../app/hooks/use-life-support';
import { formatVolume, formatDuration, formatCount } from '../lib/format';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';
import { Meter } from '../components/Meter';
import { Stepper } from '../components/Stepper';
import { IconDroplet, IconAlert, IconCheck } from '../components/icons';

/** L/s → compact "12.5 L/s". */
function formatFlow(litersPerSecond: number): string {
  return `${formatVolume(litersPerSecond)}/s`;
}

export function LifeSupportPanel(): React.JSX.Element | null {
  const [crewSize, setCrewSize] = useState(1);
  const ls = useLifeSupport({ crewSize });
  if (!ls) return null;

  const {
    hasLifeSupport,
    oxygenGeneration,
    oxygenCapacity,
    oxygenDemand,
    generationCoversCrew,
    maxCrewSupported,
    breathingTimeSeconds,
    iceBurnForOxygen,
  } = ls;

  // Empty state: no generators and no oxygen tanks to reason about.
  if (!hasLifeSupport) {
    return (
      <Panel title="Life support" icon={<IconDroplet size={16} />} subtitle="crew oxygen">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-bg p-3 text-sm">
          <span className="mt-0.5 shrink-0 text-info">
            <IconDroplet size={18} />
          </span>
          <div>
            <p className="font-medium text-fg">No life-support hardware</p>
            <p className="text-muted">
              This design has no O2/H2 generator and no oxygen tank, so there&apos;s no onboard
              oxygen supply — the crew relies on suit reserves or an external base.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  // Meter scale: whichever of demand/generation is larger, so both fit.
  const scale = Math.max(oxygenGeneration, oxygenDemand, 1);

  return (
    <Panel
      title="Life support"
      icon={<IconDroplet size={16} />}
      subtitle={`${formatFlow(oxygenGeneration)} O₂ generation`}
      actions={
        <div className="flex items-center gap-2">
          <span className="text-xs text-subtle">Crew</span>
          <Stepper value={crewSize} onChange={setCrewSize} min={0} max={999} ariaLabel="crew size" />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Headline verdict: can generation keep this crew breathing? */}
        {generationCoversCrew ? (
          <div className="flex items-start gap-3 rounded-lg border border-success/40 bg-success/10 p-3">
            <span className="mt-0.5 shrink-0 text-success">
              <IconCheck size={18} />
            </span>
            <div className="text-sm">
              <p className="font-semibold text-success">Generation covers the crew</p>
              <p className="text-muted">
                {oxygenGeneration > 0
                  ? `O2/H2 generation sustains up to ${formatCount(maxCrewSupported)} crew (needs ice).`
                  : 'No crew breathing — supply is untouched.'}
              </p>
            </div>
          </div>
        ) : (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-danger/50 bg-danger/10 p-3"
          >
            <span className="mt-0.5 shrink-0 text-danger">
              <IconAlert size={18} />
            </span>
            <div className="text-sm">
              <p className="font-semibold text-danger">Generation can&apos;t keep up</p>
              <p className="text-muted">
                {formatCount(crewSize)} crew need {formatFlow(oxygenDemand)}, but generation is only{' '}
                {formatFlow(oxygenGeneration)} — the crew draws down stored O₂
                {oxygenCapacity > 0 ? `, lasting ${formatDuration(breathingTimeSeconds)}.` : ' (and there is none stored).'}
              </p>
            </div>
          </div>
        )}

        {/* Demand vs generation meter. */}
        <div className="flex flex-col gap-2">
          <Meter
            value={oxygenDemand}
            max={scale}
            tone={generationCoversCrew ? 'success' : 'danger'}
            threshold={oxygenGeneration}
            thresholdLabel="O₂ generation"
            label="Crew oxygen demand vs generation"
            valueText={`${formatFlow(oxygenDemand)} demand of ${formatFlow(oxygenGeneration)} generation`}
          />
          <div className="flex justify-between text-xs text-subtle">
            <span>
              Demand <span className="font-mono text-muted">{formatFlow(oxygenDemand)}</span>
            </span>
            <span>
              Generation <span className="font-mono text-muted">{formatFlow(oxygenGeneration)}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Stat
            label="Supports"
            value={`${formatCount(maxCrewSupported)}`}
            hint="crew on generation"
            tone="accent"
          />
          <Stat
            label="Stored O₂"
            value={oxygenCapacity > 0 ? formatVolume(oxygenCapacity) : 'none'}
            hint={
              oxygenCapacity > 0
                ? crewSize > 0
                  ? `lasts ${formatDuration(breathingTimeSeconds)}`
                  : 'no crew draw'
                : 'no oxygen tanks'
            }
          />
          <Stat
            label="Ice burn"
            value={formatFlow(iceBurnForOxygen)}
            hint="to sustain O₂ output"
          />
        </div>
      </div>
    </Panel>
  );
}
