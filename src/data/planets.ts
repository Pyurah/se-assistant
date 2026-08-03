import type { PlanetPreset } from './schema';

/**
 * Vanilla Space Engineers planet & moon presets.
 *
 * Surface gravity is expressed in m/s^2. Space Engineers describes gravity in
 * "g" (Earth = 1.0 g); we store the derived m/s^2 value (g x 9.81) because the
 * TWR formula needs m/s^2 directly.
 *
 * Atmosphere density is the sea-level air density on a 0..1 scale, which is the
 * value atmospheric/ion thruster effectiveness curves are evaluated against.
 *
 * NOTE (Phase 1): these figures are seeded from community references and MUST
 * be verified against the current game version and cited in the data-audit
 * task (roadmap Phase 1 / M1) before the numbers are presented to users as
 * authoritative. Values below use g = 9.81 m/s^2 for Earthlike = 1.0 g.
 */
export const PLANET_PRESETS: readonly PlanetPreset[] = [
  {
    id: 'space',
    displayName: 'Space (0g)',
    surfaceGravity: 0,
    atmosphereDensity: 0,
    hasAtmosphere: false,
  },
  {
    id: 'earthlike',
    displayName: 'Earthlike',
    surfaceGravity: 9.81, // 1.00 g
    atmosphereDensity: 1.0,
    hasAtmosphere: true,
  },
  {
    id: 'moon',
    displayName: 'Moon (Earthlike)',
    surfaceGravity: 2.45, // 0.25 g
    atmosphereDensity: 0,
    hasAtmosphere: false,
  },
  {
    id: 'mars',
    displayName: 'Mars',
    surfaceGravity: 8.83, // 0.90 g
    atmosphereDensity: 1.0,
    hasAtmosphere: true,
  },
  {
    id: 'europa',
    displayName: 'Europa (Mars moon)',
    surfaceGravity: 2.45, // 0.25 g
    atmosphereDensity: 0.5,
    hasAtmosphere: true,
  },
  {
    id: 'alien',
    displayName: 'Alien',
    surfaceGravity: 10.79, // 1.10 g
    atmosphereDensity: 1.2,
    hasAtmosphere: true,
  },
  {
    id: 'titan',
    displayName: 'Titan (Alien moon)',
    surfaceGravity: 2.45, // 0.25 g
    atmosphereDensity: 1.0,
    hasAtmosphere: true,
  },
  {
    id: 'pertam',
    displayName: 'Pertam',
    surfaceGravity: 9.81, // 1.00 g
    atmosphereDensity: 1.0,
    hasAtmosphere: true,
  },
  {
    id: 'triton',
    displayName: 'Triton',
    surfaceGravity: 9.81, // 1.00 g
    atmosphereDensity: 1.0,
    hasAtmosphere: true,
  },
] as const;

/** Convenience lookup by id. */
export const PLANET_PRESETS_BY_ID: Readonly<Record<string, PlanetPreset>> = Object.fromEntries(
  PLANET_PRESETS.map((p) => [p.id, p]),
);

/** Standard gravity used to convert Space Engineers "g" values to m/s^2. */
export const STANDARD_GRAVITY = 9.81;
