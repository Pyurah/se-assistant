import type { GridSize } from './schema';

/**
 * Weapon ammunition dataset — Space Engineers v1.210.012 b0.
 *
 * Pure, serializable data extracted from the game's own definition files:
 *   - `Ammos.sbc`          — per-round damage & projectile count
 *   - `AmmoMagazines.sbc`  — magazine capacity, mass, volume, and the round it holds
 *
 * This is a combat *overlay*: weapons themselves stay in the block catalogue as
 * regular (mass-bearing) blocks. The combat engine joins a design's weapon
 * blocks to these tables by SubtypeId to compute DPS and ammo burn. See
 * `docs/data-audit.md` for the citation log.
 *
 * DAMAGE MODEL (important). Space Engineers stores weapon damage in three
 * different fields depending on the ammo family, so a single "damage" number
 * has to branch:
 *   - `health`    — kinetic rounds use `ProjectileHealthDamage` (gatling,
 *                   autocannon). Direct HP damage per projectile.
 *   - `explosion` — missiles use `MissileExplosionDamage` over a radius.
 *   - `pool`      — shells & railgun slugs use `MissileHealthPool` (assault/
 *                   artillery cannons, railguns): a large single-hit HP pool.
 * `damageKind` records which field the value came from so the UI can label it
 * honestly rather than implying all three are directly comparable.
 *
 * NOT MODELLED (flagged, never fabricated): projectile speed / max range /
 * explosion falloff / area-of-effect target coverage. Those need verified
 * `DesiredSpeed` / `MaxTrajectory` values we have not yet audited — a documented
 * fast-follow. DPS and ammo-duration math does not depend on them.
 */

/** Which game field a round's damage came from — drives honest labelling. */
export type DamageKind = 'health' | 'explosion' | 'pool';

/** A single projectile/round's damage profile (from `Ammos.sbc`). */
export interface AmmoRound {
  /** Round SubtypeId (e.g. `LargeCaliber`). */
  readonly id: string;
  readonly displayName: string;
  /** Which game damage field {@link damage} was read from. */
  readonly damageKind: DamageKind;
  /**
   * Effective per-projectile damage. Meaning depends on {@link damageKind}:
   * health points (kinetic), explosion damage (missiles), or health-pool
   * (shells/slugs). Not cross-comparable across kinds without context.
   */
  readonly damage: number;
  /** Projectiles fired per shot (>1 for shotgun-style rounds). Vanilla guns = 1. */
  readonly projectileCount: number;
  /** Explosion radius in metres — only for `explosion` rounds. */
  readonly explosionRadius?: number;
}

/** An ammo magazine/clip (from `AmmoMagazines.sbc`). */
export interface AmmoMagazine {
  /** Magazine SubtypeId (e.g. `NATO_25x184mm`). */
  readonly id: string;
  readonly displayName: string;
  /** Rounds contained in one magazine item (`Capacity`). */
  readonly capacity: number;
  /** Magazine mass, kg. */
  readonly mass: number;
  /** Magazine volume, litres. */
  readonly volume: number;
  /** SubtypeId of the {@link AmmoRound} this magazine feeds. */
  readonly roundId: string;
  /** Grid size the magazine is used on (informational). */
  readonly gridSize: GridSize | 'both';
}

/**
 * Ammo rounds, keyed by SubtypeId. Damage values from `Ammos.sbc`:
 * `ProjectileHealthDamage` for kinetic, `MissileExplosionDamage` for missiles,
 * `MissileHealthPool` for shells/slugs.
 */
export const AMMO_ROUNDS: readonly AmmoRound[] = [
  // --- Kinetic (ProjectileHealthDamage) ---
  {
    id: 'LargeCaliber',
    displayName: '25×184mm (Gatling)',
    damageKind: 'health',
    damage: 33, // ProjectileHealthDamage 33 (Ammos.sbc, gatling round)
    projectileCount: 1,
  },
  {
    id: 'AutocannonShell',
    displayName: 'Autocannon Shell',
    damageKind: 'health',
    damage: 85, // ProjectileHealthDamage 85 (Ammos.sbc)
    projectileCount: 1,
  },
  // --- Missiles (MissileExplosionDamage) ---
  {
    id: 'Missile',
    displayName: '200mm Missile',
    damageKind: 'explosion',
    damage: 500, // MissileExplosionDamage 500 (Ammos.sbc)
    projectileCount: 1,
    explosionRadius: 4, // MissileExplosionRadius 4 m
  },
  // --- Shells & slugs (MissileHealthPool) ---
  {
    id: 'MediumCalibreShell',
    displayName: 'Assault Cannon Shell',
    damageKind: 'pool',
    damage: 4000, // MissileHealthPool 4000 (Ammos.sbc)
    projectileCount: 1,
  },
  {
    id: 'LargeCalibreShell',
    displayName: 'Artillery Shell',
    damageKind: 'pool',
    damage: 17_000, // MissileHealthPool 17000 (Ammos.sbc)
    projectileCount: 1,
  },
  {
    id: 'LargeRailgunSlug',
    displayName: 'Large Railgun Sabot',
    damageKind: 'pool',
    damage: 50_000, // MissileHealthPool 50000 (Ammos.sbc)
    projectileCount: 1,
  },
  {
    id: 'SmallRailgunSlug',
    displayName: 'Small Railgun Sabot',
    damageKind: 'pool',
    damage: 8000, // MissileHealthPool 8000 (Ammos.sbc)
    projectileCount: 1,
  },
] as const;

/** Ammo magazines, keyed by SubtypeId (from `AmmoMagazines.sbc`). */
export const AMMO_MAGAZINES: readonly AmmoMagazine[] = [
  {
    id: 'NATO_25x184mm',
    displayName: 'Gatling Ammo Box',
    capacity: 140, // Capacity 140
    mass: 35,
    volume: 16,
    roundId: 'LargeCaliber',
    gridSize: 'both',
  },
  {
    id: 'AutocannonClip',
    displayName: 'Autocannon Magazine',
    capacity: 16,
    mass: 40,
    volume: 24,
    roundId: 'AutocannonShell',
    gridSize: 'small',
  },
  {
    id: 'Missile200mm',
    displayName: 'Rocket',
    capacity: 1,
    mass: 45,
    volume: 60,
    roundId: 'Missile',
    gridSize: 'both',
  },
  {
    id: 'MediumCalibreAmmo',
    displayName: 'Assault Cannon Shell',
    capacity: 1,
    mass: 60,
    volume: 30,
    roundId: 'MediumCalibreShell',
    gridSize: 'both',
  },
  {
    id: 'LargeCalibreAmmo',
    displayName: 'Artillery Shell',
    capacity: 1,
    mass: 100,
    volume: 100,
    roundId: 'LargeCalibreShell',
    gridSize: 'large',
  },
  {
    id: 'LargeRailgunAmmo',
    displayName: 'Large Railgun Sabot',
    capacity: 1,
    mass: 60,
    volume: 40,
    roundId: 'LargeRailgunSlug',
    gridSize: 'large',
  },
  {
    id: 'SmallRailgunAmmo',
    displayName: 'Small Railgun Sabot',
    capacity: 1,
    mass: 10,
    volume: 8,
    roundId: 'SmallRailgunSlug',
    gridSize: 'small',
  },
] as const;

/** Round lookup by SubtypeId. */
export const AMMO_ROUNDS_BY_ID: ReadonlyMap<string, AmmoRound> = new Map(
  AMMO_ROUNDS.map((r) => [r.id, r]),
);

/** Magazine lookup by SubtypeId. */
export const AMMO_MAGAZINES_BY_ID: ReadonlyMap<string, AmmoMagazine> = new Map(
  AMMO_MAGAZINES.map((m) => [m.id, m]),
);
