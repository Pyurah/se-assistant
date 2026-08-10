/**
 * EstimatorDashboard — the "Estimate build" mode layout.
 *
 * The inverse of AnalysisDashboard: a responsive grid where the user declares
 * essentials and goals on the left and the recommended build (the payoff) reads
 * out on the right. Layout collapses to a single column on narrow viewports.
 * The shell (mode switch, app chrome) lives in App; this component owns only the
 * estimator surface.
 */
import { EssentialsBuilder } from '../ui/panels/EssentialsBuilder';
import { EstimatorConfigPanel } from '../ui/panels/EstimatorConfigPanel';
import { RecommendationsPanel } from '../ui/panels/RecommendationsPanel';
import { EstimatorTwrPanel } from '../ui/panels/EstimatorTwrPanel';
import { EstimatorLifeSupportPanel } from '../ui/panels/EstimatorLifeSupportPanel';
import { EstimatorCombatPanel } from '../ui/panels/EstimatorCombatPanel';
import { SeedFromBlueprint } from '../ui/panels/SeedFromBlueprint';

export function EstimatorDashboard(): React.JSX.Element {
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-4 p-6 lg:grid-cols-3">
      {/* Left column: seed-from-blueprint affordance, then the essentials builder. */}
      <div className="flex flex-col gap-4">
        <SeedFromBlueprint />
        <EssentialsBuilder />
      </div>
      <div className="flex flex-col gap-4">
        <EstimatorConfigPanel />
      </div>
      {/* Right column: the recommendation payoff + directional TWR readout,
          then the life-support and combat readouts (each self-hides until the
          build has gas gear / weapons). */}
      <div className="flex flex-col gap-4">
        <RecommendationsPanel />
        <EstimatorTwrPanel />
        <EstimatorLifeSupportPanel />
        <EstimatorCombatPanel />
      </div>
    </main>
  );
}
