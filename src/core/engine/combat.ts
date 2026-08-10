/**
 * Combat analysis — per-weapon and total-ship DPS plus ammo burn.
 *
 * The question this answers: "how much damage does this ship output, and how
 * long does its loaded ammo last at full fire?" No target-HP or time-to-kill
 * model — that needs armour/shield assumptions this tool deliberately avoids.
 *
 * DPS MODEL. Two figures, because SE weapons reload:
 *
 *   burstDPS     = damage × projectileCount × (rateOfFire / 60)
 *                  — the instantaneous rate while the trigger is held and the
 *                    magazine has rounds. `rateOfFire` is shots/min, so ÷60.
 *
 *   sustainedDPS = burstDPS × dutyCycle, where over one full magazine the weapon
 *                  fires `burstShots` rounds then waits `reloadSeconds`:
 *                    fireTime  = burstShots / shotsPerSecond
 *                    dutyCycle = fireTime / (fireTime + reloadSeconds)
 *                  A continuous-fire weapon (reload 0) has dutyCycle 1, so
 *                  sustained == burst.
 *
 * `burstShots` is the weapon's `shotsInBurst`, except SE uses 0 to mean "no
 * burst cap" — there we fall back to the magazine capacity (fire the whole clip,
 * then reload). We never divide by zero: a weapon with no rounds-per-second
 * contributes nothing.
 *
 * AMMO BURN. With `magazinesPerWeapon` clips loaded per weapon (default 1),
 * total loaded rounds = Σ capacity × magazines × weaponCount. Seconds of full
 * (burst-rate) fire = totalRounds / totalShotsPerSecond. This is trigger-held
 * time, not wall-clock-including-reloads — the honest "how long until I'm dry".
 *
 * HONESTY. Weapon *blocks* live in the catalogue as mass-only `'other'` blocks;
 * this engine overlays firing stats by SubtypeId. Blocks whose SubtypeId looks
 * like a weapon (name heuristic) but have no curated stats are counted as
 * `unrecognizedWeapons` and surfaced — never silently zeroed — mirroring the
 * build-cost "known for N of M" convention.
 *
 * PURE — no React, no DOM. Consumes a {@link ShipDesign} and the pure datasets.
 */

import type { ShipDesign } from '../types';
import {
  WEAPON_STATS_BY_SUBTYPE,
  AMMO_MAGAZINES_BY_ID,
  AMMO_ROUNDS_BY_ID,
  type DamageKind,
} from '../../data';

/** Substrings that mark a block SubtypeId as (probably) a weapon. */
const WEAPON_NAME_MARKERS = [
  'gatling',
  'autocannon',
  'missilelauncher',
  'missileturret',
  'railgun',
  'calibregun',
  'calibreturret',
  'interiorturret',
  'rocketlauncher',
] as const;

/** True when a SubtypeId looks like a weapon (used to flag unknown weapons). */
function looksLikeWeapon(subtypeId: string): boolean {
  const s = subtypeId.toLowerCase();
  return WEAPON_NAME_MARKERS.some((m) => s.includes(m));
}

/** Per-weapon-type combat figures (one row per distinct weapon SubtypeId). */
export interface WeaponAnalysis {
  readonly subtypeId: string;
  readonly displayName: string;
  /** How many of this weapon are on the ship. */
  readonly quantity: number;
  readonly isTurret: boolean;
  /** The ammo round this weapon fires. */
  readonly roundDisplayName: string;
  /** Which game field the damage came from — for honest labelling. */
  readonly damageKind: DamageKind;
  /** Per-shot damage (damage × projectileCount) for ONE weapon. */
  readonly damagePerShot: number;
  /** Burst DPS for ONE weapon (trigger held, magazine loaded). */
  readonly burstDps: number;
  /** Sustained DPS for ONE weapon (accounts for the reload duty cycle). */
  readonly sustainedDps: number;
  /** Burst DPS across all `quantity` of this weapon. */
  readonly totalBurstDps: number;
  /** Sustained DPS across all `quantity` of this weapon. */
  readonly totalSustainedDps: number;
  /** Rounds loaded across all of this weapon (capacity × magazines × quantity). */
  readonly loadedRounds: number;
  /** Seconds of full-rate fire before this weapon type runs dry. */
  readonly fireDurationSeconds: number;
}

/** Whole-ship combat analysis. */
export interface Combat {
  /** True when the ship has at least one recognized weapon. */
  readonly isArmed: boolean;
  /** Per-weapon-type rows, sorted by total burst DPS descending. */
  readonly weapons: readonly WeaponAnalysis[];
  /** Distinct recognized weapon types. */
  readonly weaponTypeCount: number;
  /** Total individual weapon blocks (Σ quantity). */
  readonly weaponCount: number;
  /** Ship-wide burst DPS (all weapons firing). */
  readonly totalBurstDps: number;
  /** Ship-wide sustained DPS (all weapons, reloads accounted). */
  readonly totalSustainedDps: number;
  /** Total rounds loaded across the ship. */
  readonly totalLoadedRounds: number;
  /**
   * Seconds of full-rate fire before the *whole ship* runs dry, i.e.
   * totalRounds ÷ total shots/second. `Infinity` only if nothing fires.
   */
  readonly fireDurationSeconds: number;
  /** Magazines-per-weapon assumption used for the ammo-burn math. */
  readonly magazinesPerWeapon: number;
  /**
   * SubtypeIds that look like weapons but have no curated firing stats — modded
   * or not-yet-curated. Surfaced so DPS is honestly "known for N of M".
   */
  readonly unrecognizedWeapons: readonly string[];
}

/** Options for {@link combatAnalysis}. */
export interface CombatOptions {
  /** Loaded magazines per weapon for ammo-burn math. Clamped to an integer ≥ 0. */
  readonly magazinesPerWeapon?: number;
}

/** Clamp magazines-per-weapon to a whole number ≥ 0 (default 1). */
function clampMagazines(count: number | undefined): number {
  if (count === undefined || !Number.isFinite(count)) return 1;
  return Math.max(0, Math.floor(count));
}

/**
 * Compute per-weapon and ship-wide DPS and ammo burn for a design. Weapons are
 * matched to curated firing stats by SubtypeId; unknown weapon-like blocks are
 * flagged, never zeroed into the totals silently.
 */
export function combatAnalysis(design: ShipDesign, options: CombatOptions = {}): Combat {
  const magazinesPerWeapon = clampMagazines(options.magazinesPerWeapon);

  const weapons: WeaponAnalysis[] = [];
  const unrecognized = new Set<string>();

  for (const block of design.blocks) {
    const subtypeId = block.definition.subtypeId;
    const stats = WEAPON_STATS_BY_SUBTYPE.get(subtypeId);

    if (!stats) {
      // Flag weapon-looking blocks we can't score (modded / not yet curated).
      if (subtypeId && looksLikeWeapon(subtypeId)) unrecognized.add(subtypeId);
      continue;
    }

    const magazine = AMMO_MAGAZINES_BY_ID.get(stats.magazineId);
    const round = magazine ? AMMO_ROUNDS_BY_ID.get(magazine.roundId) : undefined;
    // A curated weapon must resolve its magazine + round; skip defensively if not.
    if (!magazine || !round) {
      unrecognized.add(subtypeId);
      continue;
    }

    const quantity = block.quantity;
    const shotsPerSecond = stats.rateOfFire / 60;
    const damagePerShot = round.damage * round.projectileCount;
    const burstDps = damagePerShot * shotsPerSecond;

    // Duty cycle over one magazine: fire `burstShots`, then wait `reloadSeconds`.
    // shotsInBurst 0 means "no burst cap" → fire the whole clip before reloading.
    const burstShots = stats.shotsInBurst > 0 ? stats.shotsInBurst : magazine.capacity;
    const reloadSeconds = stats.reloadTimeMs / 1000;
    const fireTime = shotsPerSecond > 0 ? burstShots / shotsPerSecond : 0;
    const dutyCycle =
      fireTime + reloadSeconds > 0 ? fireTime / (fireTime + reloadSeconds) : 0;
    const sustainedDps = burstDps * dutyCycle;

    const loadedRounds = magazine.capacity * magazinesPerWeapon * quantity;
    // Full-rate fire time for this weapon type (per-weapon rounds ÷ per-weapon rate).
    const roundsPerWeapon = magazine.capacity * magazinesPerWeapon;
    const fireDurationSeconds =
      shotsPerSecond > 0 ? roundsPerWeapon / shotsPerSecond : Infinity;

    weapons.push({
      subtypeId,
      displayName: stats.displayName,
      quantity,
      isTurret: stats.isTurret,
      roundDisplayName: round.displayName,
      damageKind: round.damageKind,
      damagePerShot,
      burstDps,
      sustainedDps,
      totalBurstDps: burstDps * quantity,
      totalSustainedDps: sustainedDps * quantity,
      loadedRounds,
      fireDurationSeconds,
    });
  }

  weapons.sort((a, b) => b.totalBurstDps - a.totalBurstDps);

  const totalBurstDps = weapons.reduce((s, w) => s + w.totalBurstDps, 0);
  const totalSustainedDps = weapons.reduce((s, w) => s + w.totalSustainedDps, 0);
  const totalLoadedRounds = weapons.reduce((s, w) => s + w.loadedRounds, 0);
  const weaponCount = weapons.reduce((s, w) => s + w.quantity, 0);

  // Ship-wide fire duration = total rounds ÷ total shots/second across weapons.
  const totalShotsPerSecond = weapons.reduce(
    (s, w) => s + (WEAPON_STATS_BY_SUBTYPE.get(w.subtypeId)!.rateOfFire / 60) * w.quantity,
    0,
  );
  const fireDurationSeconds =
    totalShotsPerSecond > 0 ? totalLoadedRounds / totalShotsPerSecond : Infinity;

  return {
    isArmed: weapons.length > 0,
    weapons,
    weaponTypeCount: weapons.length,
    weaponCount,
    totalBurstDps,
    totalSustainedDps,
    totalLoadedRounds,
    fireDurationSeconds,
    magazinesPerWeapon,
    unrecognizedWeapons: [...unrecognized].sort(),
  };
}
