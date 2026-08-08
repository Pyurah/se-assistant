/**
 * Category groupings shared across the engine and UI.
 *
 * Kept in the data layer (pure, no React/DOM) so both the estimator engine and
 * the essentials palette agree on which categories the estimator *sizes* for you
 * (propulsion / power / attitude) versus which the user declares by hand. A
 * single source of truth prevents the two sides from drifting — e.g. the
 * essentials palette hiding a category the design→estimate seed still carries in.
 */
import type { BlockCategory } from './schema';

/**
 * Categories the requirement estimator sizes automatically: thrusters, power
 * blocks (battery / reactor / solar / hydrogen-engine / wind-turbine) and gyros.
 * These are excluded from the "essential gear" palette (the user picks a *model*,
 * the estimator picks the *count*) and are re-sized (not carried as fixed counts)
 * when a blueprint seeds an Estimate build.
 */
export const SIZED_CATEGORIES: ReadonlySet<BlockCategory> = new Set<BlockCategory>([
  'thruster',
  'battery',
  'reactor',
  'solar',
  'hydrogen-engine',
  'wind-turbine',
  'gyroscope',
]);

/** The power-*producer* categories (everything the estimator sizes as a producer, not a battery). */
export const POWER_PRODUCER_CATEGORIES: ReadonlySet<BlockCategory> = new Set<BlockCategory>([
  'reactor',
  'solar',
  'hydrogen-engine',
  'wind-turbine',
]);
