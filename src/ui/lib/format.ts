/**
 * Number & unit formatting for Space Engineers stats.
 *
 * SE numbers span many orders of magnitude — thrust in Newtons runs into the
 * millions, power in Watts into tens of MW, mass in kg into hundreds of tonnes.
 * Raw values are unreadable, so these helpers pick a sensible unit and a small,
 * consistent number of significant digits. Pure functions — unit-tested.
 */

/** Format a plain number with up to `maxFrac` fraction digits, trimming zeros. */
function trim(value: number, maxFrac: number): string {
  return value.toLocaleString('en-US', {
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: 0,
  });
}

/**
 * Force (Newtons) → N / kN / MN / GN. Chooses the unit so the mantissa is a
 * readable 1–3 digit number.
 */
export function formatForce(newtons: number): string {
  if (!Number.isFinite(newtons)) return '∞';
  const n = Math.abs(newtons);
  if (n >= 1e9) return `${trim(newtons / 1e9, 2)} GN`;
  if (n >= 1e6) return `${trim(newtons / 1e6, 2)} MN`;
  if (n >= 1e3) return `${trim(newtons / 1e3, 1)} kN`;
  return `${trim(newtons, 0)} N`;
}

/** Power (Watts) → W / kW / MW / GW. */
export function formatPower(watts: number): string {
  if (!Number.isFinite(watts)) return '∞';
  const w = Math.abs(watts);
  if (w >= 1e9) return `${trim(watts / 1e9, 2)} GW`;
  if (w >= 1e6) return `${trim(watts / 1e6, 2)} MW`;
  if (w >= 1e3) return `${trim(watts / 1e3, 1)} kW`;
  return `${trim(watts, 0)} W`;
}

/** Energy (Watt-hours) → Wh / kWh / MWh. */
export function formatEnergy(wh: number): string {
  if (!Number.isFinite(wh)) return '∞';
  const v = Math.abs(wh);
  if (v >= 1e6) return `${trim(wh / 1e6, 2)} MWh`;
  if (v >= 1e3) return `${trim(wh / 1e3, 1)} kWh`;
  return `${trim(wh, 0)} Wh`;
}

/** Mass (kg) → kg / t / kt. Tonnes above 1000 kg. */
export function formatMass(kg: number): string {
  if (!Number.isFinite(kg)) return '∞';
  const m = Math.abs(kg);
  if (m >= 1e6) return `${trim(kg / 1e6, 2)} kt`;
  if (m >= 1e3) return `${trim(kg / 1e3, 2)} t`;
  return `${trim(kg, 0)} kg`;
}

/** Volume (liters) → L / kL / ML. */
export function formatVolume(liters: number): string {
  if (!Number.isFinite(liters)) return '∞';
  const v = Math.abs(liters);
  if (v >= 1e6) return `${trim(liters / 1e6, 2)} ML`;
  if (v >= 1e3) return `${trim(liters / 1e3, 1)} kL`;
  return `${trim(liters, 0)} L`;
}

/**
 * Battery runtime (hours) → human phrase.
 *   Infinity → "sustained" (generation meets draw, batteries never drain)
 *   ≥ 1 h    → "3.2 h"
 *   < 1 h    → minutes ("3.4 min") or seconds ("42 s") for very short spans
 *   0        → "none"
 */
export function formatRuntime(hours: number): string {
  if (!Number.isFinite(hours)) return 'sustained';
  if (hours <= 0) return 'none';
  if (hours >= 1) return `${trim(hours, 1)} h`;
  const minutes = hours * 60;
  if (minutes >= 1) return `${trim(minutes, 1)} min`;
  return `${trim(minutes * 60, 0)} s`;
}

/**
 * Duration in SECONDS → human phrase. Sibling to {@link formatRuntime} (which
 * takes hours) for flight/hover times the fuel engine reports in seconds.
 *   Infinity → "unlimited" (zero-g hover, or no burn — caller adds context)
 *   ≥ 1 h    → "1h 42m" (whole hours + minutes; drops the "0m" tail)
 *   ≥ 1 min  → "3.4 min"
 *   < 1 min  → "42 s"
 *   0        → "none"
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'unlimited';
  if (seconds <= 0) return 'none';
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (seconds >= 60) return `${trim(seconds / 60, 1)} min`;
  return `${trim(seconds, 0)} s`;
}

/**
 * Turn time (seconds) → compact string for the maneuverability readout: tenths
 * of a second (turn times are small — a fraction of a second to a few seconds),
 * with a trailing "s". Infinity (no gyros / no mass) becomes an em dash the
 * caller can pair with a "can't turn" note; a non-positive time reads "0 s".
 */
export function formatTurnTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds <= 0) return '0 s';
  return `${trim(seconds, 1)} s`;
}

/**
 * TWR ratio → readable string. Infinity (0 g) becomes an em dash caller can
 * pair with a "no gravity" note; otherwise 2 decimals with a trailing ×.
 */
export function formatTwr(twr: number): string {
  if (!Number.isFinite(twr)) return '—';
  return `${trim(twr, 2)}×`;
}

/** Percentage from a 0..1 fraction. */
export function formatPercent(fraction: number, maxFrac = 0): string {
  return `${trim(fraction * 100, maxFrac)}%`;
}

/** Plain integer with thousands separators, or ∞. */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  return trim(n, 0);
}

/**
 * Distance (meters) → m / km. Infinity becomes ∞ (caller pairs it with a "no
 * braking thrust" note). Small distances keep one or two decimals; kilometers
 * kick in above 1000 m so a long stopping run reads "1.24 km" not "1,240 m".
 */
export function formatMeters(meters: number): string {
  if (!Number.isFinite(meters)) return '∞';
  const m = Math.abs(meters);
  if (m >= 1000) return `${trim(meters / 1000, 2)} km`;
  if (m >= 100) return `${trim(meters, 0)} m`;
  if (m >= 10) return `${trim(meters, 1)} m`;
  return `${trim(meters, 2)} m`;
}

/** Gravity (m/s²) → both m/s² and Earth-g, e.g. "9.81 m/s² (1.00 g)". */
export function formatGravity(mps2: number): string {
  if (mps2 === 0) return '0 (zero-g)';
  const g = mps2 / 9.81;
  return `${trim(mps2, 2)} m/s² (${trim(g, 2)} g)`;
}

/** Speed (m/s) → "100 m/s". Infinity becomes ∞. */
export function formatSpeed(mps: number): string {
  if (!Number.isFinite(mps)) return '∞';
  return `${trim(mps, 1)} m/s`;
}

/**
 * Acceleration (m/s²) → "23.8 m/s²". Infinity becomes ∞; zero reads "0 m/s²"
 * (caller pairs it with a "no thrust this axis" note). Small values keep two
 * decimals so a lightly-thrusted axis doesn't collapse to "0".
 */
export function formatAccel(mps2: number): string {
  if (!Number.isFinite(mps2)) return '∞';
  const a = Math.abs(mps2);
  const frac = a >= 10 ? 1 : 2;
  return `${trim(mps2, frac)} m/s²`;
}
