/**
 * Fuel, energy, and grid geometry constants for the calc engine.
 *
 * VERIFICATION (Phase 2): fuel figures are seeded from community references and
 * being confirmed against the current game version — see `docs/data-audit.md`.
 */

/**
 * Energy produced per kilogram of Uranium Ingot, watt-hours.
 *
 * The wiki states reactors yield ~1 MWh per 1 kg of Uranium Ingot, uniform
 * across reactor sizes. A reactor at P watts therefore burns uranium at
 * P / URANIUM_WH_PER_KG kg per hour.
 */
export const URANIUM_WH_PER_KG = 1_000_000;

/**
 * Grid cell edge length in meters, by grid size. Large-grid cubes are 2.5 m,
 * small-grid cubes 0.5 m. Converts a block's integer `<Min>` cell coordinate to
 * metric offsets for center-of-mass and thrust-center-alignment math.
 */
export const GRID_CELL_SIZE_M: Readonly<Record<'small' | 'large', number>> = {
  small: 0.5,
  large: 2.5,
};
