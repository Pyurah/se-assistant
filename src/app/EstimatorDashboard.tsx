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

export function EstimatorDashboard(): React.JSX.Element {
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-4 p-6 lg:grid-cols-3">
      {/* Left column: inputs — essentials builder + build goals. */}
      <div className="flex flex-col gap-4">
        <EssentialsBuilder />
      </div>
      <div className="flex flex-col gap-4">
        <EstimatorConfigPanel />
      </div>
      {/* Right column: the recommendation payoff. */}
      <div className="flex flex-col gap-4">
        <RecommendationsPanel />
      </div>
    </main>
  );
}
