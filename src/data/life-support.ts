/**
 * Life-support constants — curated from the game's own definition files.
 *
 * Space Engineers models crew oxygen as a simple flow: a character breathes a
 * fixed volume of O₂ per second, and O2/H2 generators convert ice to oxygen at
 * a fixed rate. Everything here is a literal from the game files, cited inline,
 * so the life-support engine does exact arithmetic rather than guessing.
 *
 * PURE — no React, no DOM.
 */

/**
 * Oxygen a single character consumes, liters/second.
 *
 * From `Characters.sbc` → `OxygenConsumption` = 0.063 (with
 * `OxygenConsumptionMultiplier` = 1). Game version 1.210.012. See
 * docs/data-audit.md.
 */
export const CHARACTER_O2_CONSUMPTION_L_PER_S = 0.063;

/**
 * Ice→gas conversion ratios (liters of gas per liter of ice), from the O2/H2
 * generator definitions in `Production.sbc` (`IceToGasRatio`). Oxygen 10,
 * hydrogen 20. Used to cross-check generator output against ice burn.
 */
export const ICE_TO_OXYGEN_RATIO = 10;
export const ICE_TO_HYDROGEN_RATIO = 20;

/**
 * A crew whose members each breathe {@link CHARACTER_O2_CONSUMPTION_L_PER_S}
 * would be supported by 1 L/s of generation for this many members.
 * (= 1 / 0.063 ≈ 15.87 crew per L/s.) Handy reference for the panel.
 */
export const CREW_PER_L_PER_S = 1 / CHARACTER_O2_CONSUMPTION_L_PER_S;
