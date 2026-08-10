/**
 * Category presentation metadata — labels and a categorical color palette for
 * block categories, shared by the block list and the mass breakdown so a
 * category is the same color everywhere (consistent visual encoding).
 *
 * The palette is a hand-picked categorical set (distinct hues, similar
 * lightness) rather than a sequential ramp, since categories are nominal.
 */
import type { BlockCategory } from '@data';

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  thruster: 'Thrusters',
  cargo: 'Cargo',
  reactor: 'Reactors',
  battery: 'Batteries',
  solar: 'Solar',
  'hydrogen-engine': 'Hydrogen Engines',
  'wind-turbine': 'Wind Turbines',
  gyroscope: 'Gyroscopes',
  cockpit: 'Cockpits',
  drill: 'Drills',
  welder: 'Welders',
  grinder: 'Grinders',
  connector: 'Connectors',
  conveyor: 'Conveyors',
  light: 'Lights',
  beacon: 'Beacons',
  antenna: 'Antennas',
  sensor: 'Sensors',
  control: 'Control',
  logic: 'Logic',
  gas: 'Gas Systems',
  utility: 'Utility',
  weapon: 'Weapons',
  structural: 'Structural',
  other: 'Other',
};

/** Tailwind background classes keyed by category (arbitrary oklch values). */
export const CATEGORY_COLOR: Record<BlockCategory, string> = {
  thruster: 'bg-[oklch(0.7_0.15_255)]',
  cargo: 'bg-[oklch(0.72_0.14_155)]',
  reactor: 'bg-[oklch(0.7_0.17_25)]',
  battery: 'bg-[oklch(0.78_0.15_85)]',
  solar: 'bg-[oklch(0.8_0.14_100)]',
  'hydrogen-engine': 'bg-[oklch(0.72_0.13_200)]',
  'wind-turbine': 'bg-[oklch(0.75_0.12_180)]',
  gyroscope: 'bg-[oklch(0.68_0.14_310)]',
  cockpit: 'bg-[oklch(0.72_0.14_290)]',
  drill: 'bg-[oklch(0.7_0.16_45)]',
  welder: 'bg-[oklch(0.76_0.15_130)]',
  grinder: 'bg-[oklch(0.7_0.15_15)]',
  connector: 'bg-[oklch(0.72_0.13_220)]',
  conveyor: 'bg-[oklch(0.62_0.06_240)]',
  light: 'bg-[oklch(0.82_0.13_95)]',
  beacon: 'bg-[oklch(0.72_0.15_340)]',
  antenna: 'bg-[oklch(0.72_0.14_325)]',
  sensor: 'bg-[oklch(0.7_0.13_170)]',
  control: 'bg-[oklch(0.72_0.13_275)]',
  logic: 'bg-[oklch(0.68_0.12_300)]',
  gas: 'bg-[oklch(0.74_0.12_190)]',
  utility: 'bg-[oklch(0.6_0.04_260)]',
  weapon: 'bg-[oklch(0.66_0.18_35)]',
  structural: 'bg-[oklch(0.6_0.02_260)]',
  other: 'bg-[oklch(0.55_0.02_260)]',
};

/** Stable display order for categories in lists and legends. */
export const CATEGORY_ORDER: readonly BlockCategory[] = [
  'thruster',
  'cargo',
  'reactor',
  'battery',
  'hydrogen-engine',
  'solar',
  'wind-turbine',
  'cockpit',
  'gyroscope',
  'drill',
  'welder',
  'grinder',
  'connector',
  'conveyor',
  'light',
  'beacon',
  'antenna',
  'sensor',
  'control',
  'logic',
  'gas',
  'utility',
  'weapon',
  'structural',
  'other',
];
