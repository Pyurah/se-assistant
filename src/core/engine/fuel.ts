/**
 * Fuel, flight-time, and consumable-runtime math (Phase 2 / M5).
 *
 * Hydrogen ships burn H2 from tanks; the burn rate depends on how hard the
 * thrusters are working, so "flight time" is only meaningful relative to a
 * throttle/thrust level. We express it two ways:
 *   - hover time: burn rate to hold up-thrust = weight (the common question)
 *   - full-throttle time: all hydrogen thrusters at 100%
 *
 * Reactors burn uranium at a rate set by their power output and a fixed
 * energy-per-kg efficiency. Solar sizing is guidance, not a hard number,
 * because output depends on sun exposure (day/night, orientation).
 *
 * All rates are per-second unless noted. Consumption scales linearly with the
 * fraction of max thrust in use (SE models thruster fuel burn linearly).
 */

import type { ShipDesign } from '../types';
import { effectiveThrust } from './thruster';
import { weight } from './twr';
import { loadedMass, dryMass } from './mass';
import { peakDraw, powerSummary } from './power';
import { URANIUM_WH_PER_KG } from '../../data/fuel-constants';
import { PLANET_PRESETS_BY_ID } from '../../data/planets';

/** Total hydrogen stored across all tanks in the design, liters. */
export function hydrogenCapacity(design: ShipDesign): number {
  let total = 0;
  for (const b of design.blocks) {
    const def = b.definition;
    // Count hydrogen tanks only — an oxygen tank shares category 'gas' and a
    // gasCapacity but is tagged storedGas: 'oxygen' (hydrogen tanks are untagged).
    if (
      def.category === 'gas' &&
      typeof def.gasCapacity === 'number' &&
      def.storedGas !== 'oxygen'
    ) {
      total += def.gasCapacity * b.quantity;
    }
  }
  return total;
}

/** Max hydrogen burn rate if every hydrogen thruster runs at full thrust, L/s. */
export function maxHydrogenBurn(design: ShipDesign): number {
  let total = 0;
  for (const b of design.blocks) {
    const def = b.definition;
    if (
      def.category === 'thruster' &&
      def.thrusterType === 'hydrogen' &&
      typeof def.maxHydrogenConsumption === 'number'
    ) {
      total += def.maxHydrogenConsumption * b.quantity;
    }
  }
  return total;
}

/** Hydrogen burn rate of engines converting H2 to power at full output, L/s. */
export function engineHydrogenBurn(design: ShipDesign): number {
  let total = 0;
  for (const b of design.blocks) {
    const def = b.definition;
    if (def.category === 'hydrogen-engine' && typeof def.maxHydrogenConsumption === 'number') {
      total += def.maxHydrogenConsumption * b.quantity;
    }
  }
  return total;
}

/** Sustained hydrogen output from all O2/H2 generators, L/s. */
export function hydrogenGeneration(design: ShipDesign): number {
  let total = 0;
  for (const b of design.blocks) {
    const def = b.definition;
    if (def.category === 'gas' && typeof def.hydrogenOutput === 'number') {
      total += def.hydrogenOutput * b.quantity;
    }
  }
  return total;
}

/**
 * Hydrogen burn rate (L/s) required to HOVER at a given mass on a planet, i.e.
 * to produce up-thrust equal to weight. Returns 0 in zero-g (nothing to fight).
 *
 * We find the throttle fraction on the ship's up-facing hydrogen thrusters that
 * yields thrust = weight, then scale their combined max burn by that fraction.
 * If up-thrust can't reach weight even at full throttle, hovering is impossible
 * and we report the full-throttle burn with `canHover: false`.
 */
export interface HoverBurn {
  /** Hydrogen burn to hold a hover, L/s (full-throttle burn if it can't hover). */
  readonly burnRate: number;
  /** Fraction of up hydrogen-thruster capacity used to hover, 0..1 (or >1). */
  readonly throttle: number;
  readonly canHover: boolean;
}

export function hoverHydrogenBurn(design: ShipDesign, planetId: string, mass: number): HoverBurn {
  const planet = PLANET_PRESETS_BY_ID[planetId];
  if (!planet || planet.surfaceGravity === 0) {
    return { burnRate: 0, throttle: 0, canHover: true };
  }
  const w = weight(mass, planet.surfaceGravity);

  // Up-facing hydrogen thrusters: their max up-thrust and max burn.
  let upThrust = 0;
  let upBurn = 0;
  for (const b of design.blocks) {
    const def = b.definition;
    if (
      def.category === 'thruster' &&
      def.thrusterType === 'hydrogen' &&
      b.thrustDirection === 'up' &&
      typeof def.maxHydrogenConsumption === 'number'
    ) {
      upThrust += effectiveThrust(def, planet.atmosphereDensity) * b.quantity;
      upBurn += def.maxHydrogenConsumption * b.quantity;
    }
  }

  if (upThrust <= 0) {
    return { burnRate: 0, throttle: 0, canHover: false };
  }
  const throttle = w / upThrust;
  if (throttle > 1) {
    // Can't hold a hover; report full-throttle burn.
    return { burnRate: upBurn, throttle, canHover: false };
  }
  return { burnRate: upBurn * throttle, throttle, canHover: true };
}

/** Convert a burn rate (L/s) and a reserve (L) into a duration in seconds. */
function duration(reserveL: number, burnRateLps: number): number {
  if (burnRateLps <= 0) return Infinity;
  return reserveL / burnRateLps;
}

export interface FlightTimeEstimate {
  /** Total hydrogen aboard, liters. */
  readonly hydrogenCapacity: number;
  /** Burn rate to hover at the given mass, L/s. */
  readonly hoverBurnRate: number;
  /** Seconds of hover on a full tank (Infinity in zero-g / no burn). */
  readonly hoverTimeSeconds: number;
  /** Burn rate at full throttle on all H2 thrusters, L/s. */
  readonly fullThrottleBurnRate: number;
  /** Seconds at full throttle on a full tank. */
  readonly fullThrottleTimeSeconds: number;
  /** Whether the ship can actually hold a hover at this mass. */
  readonly canHover: boolean;
  /** Net H2 with generators running: generation − hover burn, L/s (info). */
  readonly netHoverWithGeneration: number;
}

/**
 * Full flight-time picture for a hydrogen ship at a given mass on a planet.
 */
export function flightTime(design: ShipDesign, planetId: string, mass: number): FlightTimeEstimate {
  const capacity = hydrogenCapacity(design);
  const hover = hoverHydrogenBurn(design, planetId, mass);
  const fullBurn = maxHydrogenBurn(design);
  const generation = hydrogenGeneration(design);
  return {
    hydrogenCapacity: capacity,
    hoverBurnRate: hover.burnRate,
    hoverTimeSeconds: duration(capacity, hover.burnRate),
    fullThrottleBurnRate: fullBurn,
    fullThrottleTimeSeconds: duration(capacity, fullBurn),
    canHover: hover.canHover,
    netHoverWithGeneration: generation - hover.burnRate,
  };
}

/**
 * Uranium consumption for the ship's reactors at a given electrical load.
 *
 * A reactor running at P watts burns uranium at P / (energy per kg). We size
 * the load to the ship's peak draw by default; callers can pass an explicit
 * load. Rate is kg/s; also returned per-hour for readability.
 */
export interface UraniumUsage {
  /** Electrical load assumed, W. */
  readonly loadWatts: number;
  /** Uranium ingot consumption, kg/second. */
  readonly kgPerSecond: number;
  /** Uranium ingot consumption, kg/hour. */
  readonly kgPerHour: number;
}

export function uraniumUsage(design: ShipDesign, loadWatts?: number): UraniumUsage {
  // Only meaningful if the ship has reactors; otherwise load isn't uranium-fed.
  const hasReactor = design.blocks.some((b) => b.definition.category === 'reactor');
  const load = loadWatts ?? peakDraw(design);
  const effectiveLoad = hasReactor ? load : 0;
  const kgPerHour = effectiveLoad / URANIUM_WH_PER_KG; // W / (Wh/kg) = kg/h
  return {
    loadWatts: effectiveLoad,
    kgPerSecond: kgPerHour / 3600,
    kgPerHour,
  };
}

/**
 * Solar sizing guidance: how many solar panels would be needed to cover a load,
 * with the caveat that this is best-case (full sun). Real output averages far
 * lower over a day/night cycle, so we also give a day/night-adjusted figure.
 */
export interface SolarGuidance {
  readonly loadWatts: number;
  /** Panels needed at full sun (best case). */
  readonly panelsFullSun: number;
  /** Panels needed accounting for ~50% average sun exposure (guidance). */
  readonly panelsDayNight: number;
  readonly perPanelOutput: number;
}

export function solarGuidance(perPanelOutput: number, loadWatts: number): SolarGuidance {
  const full = perPanelOutput > 0 ? Math.ceil(loadWatts / perPanelOutput) : Infinity;
  // Panels see the sun only part of the time and rarely at a perfect angle; a
  // ~50% average is a common planning heuristic. Labeled as guidance in the UI.
  const dayNight = perPanelOutput > 0 ? Math.ceil(loadWatts / (perPanelOutput * 0.5)) : Infinity;
  return {
    loadWatts,
    panelsFullSun: full,
    panelsDayNight: dayNight,
    perPanelOutput,
  };
}

/**
 * Convenience: full fuel/consumable summary for a design at its loaded mass on
 * its selected planet. Combines hydrogen flight time, uranium burn, and a
 * battery-runtime echo from the power summary.
 */
export interface FuelSummary {
  readonly flight: FlightTimeEstimate;
  readonly uranium: UraniumUsage;
  readonly batteryRuntimeHours: number;
  readonly usesHydrogen: boolean;
  readonly usesReactor: boolean;
}

export function fuelSummary(design: ShipDesign): FuelSummary {
  const loaded = loadedMass(design);
  const flight = flightTime(design, design.planetId, loaded);
  const uranium = uraniumUsage(design);
  const power = powerSummary(design);
  return {
    flight,
    uranium,
    batteryRuntimeHours: power.batteryRuntimeHours,
    usesHydrogen: maxHydrogenBurn(design) > 0 || hydrogenCapacity(design) > 0,
    usesReactor: design.blocks.some((b) => b.definition.category === 'reactor'),
  };
}

/** Re-export for callers that want the empty-ship comparison too. */
export { dryMass };
