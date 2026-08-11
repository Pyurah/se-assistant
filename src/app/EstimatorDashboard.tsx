/**
 * EstimatorDashboard — the "Estimate build" mode layout.
 *
 * The inverse of AnalysisDashboard: an asymmetric two-track layout. A control
 * rail (seed-from-blueprint, essentials builder, build parameters) declares the
 * essentials and context on the left; a wide content canvas reads out the
 * payoff on the right — the thruster-assignment workbench leads, then the
 * recommended build and the directional TWR / life-support / combat readouts.
 * Layout collapses to a single column on narrow viewports. The shell (mode
 * switch, app chrome) lives in App; this component owns only the estimator
 * surface.
 */
import { EssentialsBuilder } from '../ui/panels/EssentialsBuilder';
import { BuildParametersPanel } from '../ui/panels/BuildParametersPanel';
import { ThrusterAssignmentPanel } from '../ui/panels/ThrusterAssignmentPanel';
import { RecommendationsPanel } from '../ui/panels/RecommendationsPanel';
import { EstimatorTwrPanel } from '../ui/panels/EstimatorTwrPanel';
import { EstimatorLifeSupportPanel } from '../ui/panels/EstimatorLifeSupportPanel';
import { EstimatorCombatPanel } from '../ui/panels/EstimatorCombatPanel';
import { SeedFromBlueprint } from '../ui/panels/SeedFromBlueprint';
import { EstimatorScenarioBar } from '../ui/panels/EstimatorScenarioBar';

export function EstimatorDashboard(): React.JSX.Element {
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-6 lg:gap-8 lg:p-8">
      {/* The two decisions made first — grid size + environment — pinned on top. */}
      <EstimatorScenarioBar />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-8">
        {/* Track 1: control rail — seed-from-blueprint affordance, the essentials
            builder, then the mass/power/maneuverability context. */}
        <div className="flex flex-col gap-6">
          <SeedFromBlueprint />
          <EssentialsBuilder />
          <BuildParametersPanel />
        </div>

        {/* Track 2: content canvas — the thruster-assignment workbench leads,
            then a two-up readout: the recommendation payoff on one side and the
            directional TWR / life-support / combat readouts on the other (each
            self-hides until the build has gas gear / weapons). */}
        <div className="flex min-w-0 flex-col gap-6">
          <ThrusterAssignmentPanel />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="flex flex-col gap-6">
              <RecommendationsPanel />
            </div>
            <div className="flex flex-col gap-6">
              <EstimatorTwrPanel />
              <EstimatorLifeSupportPanel />
              <EstimatorCombatPanel />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
