import type { GridSize } from './schema';

/**
 * Weapon firing-stats overlay — Space Engineers v1.210.012 b0.
 *
 * Pure, serializable data from `Weapons.sbc` (`RateOfFire`, `ShotsInBurst`,
 * `ReloadTime`, `AmmoMagazines`). This is deliberately an *overlay* keyed by the
 * weapon block's SubtypeId rather than a new `WeaponBlock` schema variant: the
 * weapon blocks already exist in the generated catalogue with definition-sourced
 * mass, and replacing them with hand-authored `WeaponBlock`s would overwrite that
 * trustworthy mass with an unverified one. The combat engine joins a design's
 * weapon blocks to this table by SubtypeId. See `docs/data-audit.md`.
 *
 * Fields:
 *   - `rateOfFire`   shots per MINUTE at full fire (`RateOfFire`).
 *   - `shotsInBurst` shots before a forced reload gap (`ShotsInBurst`); 0 in the
 *                    game means "no burst limit" — we normalise that to the
 *                    magazine capacity in the engine.
 *   - `reloadTimeMs` forced reload gap after a burst/magazine, milliseconds
 *                    (`ReloadTime`). Continuous-fire guns (no reload) use 0.
 *   - `magazineId`   the {@link AmmoMagazine} SubtypeId the weapon consumes.
 *
 * The curated set covers the common vanilla weapons across base + Warfare 1/2
 * (gatling gun/turret, autocannon, assault cannon, artillery, rockets/missiles,
 * railguns). A `generate:weapons` script over `Weapons.sbc` is a documented
 * fast-follow; hand-curation keeps the correctness surface verifiable now.
 */
export interface WeaponStats {
  /** Weapon block SubtypeId (e.g. `SmallGatlingGun`). */
  readonly subtypeId: string;
  readonly displayName: string;
  readonly gridSize: GridSize;
  /** True for turrets (auto-tracking), false for fixed/hand-aimed guns. */
  readonly isTurret: boolean;
  /** Shots per minute at full fire (`RateOfFire`). */
  readonly rateOfFire: number;
  /** Shots per burst before the reload gap (`ShotsInBurst`); 0 = no burst cap. */
  readonly shotsInBurst: number;
  /** Forced reload gap after a burst, milliseconds (`ReloadTime`). */
  readonly reloadTimeMs: number;
  /** SubtypeId of the magazine this weapon consumes. */
  readonly magazineId: string;
}

export const WEAPON_STATS: readonly WeaponStats[] = [
  // === GATLING (25×184mm, ProjectileHealthDamage 33) ======================
  // NOTE: the base-game Gatling Gun and (large) Gatling Turret ship with an
  // EMPTY <SubtypeName> in the game files, so they are not in the catalogue
  // under a stable SubtypeId and cannot be matched by one. We curate the
  // named/reskin variants that DO carry a SubtypeId (mechanically identical).
  {
    subtypeId: 'SmallGatlingGunWarfare2',
    displayName: 'Gatling Gun (Warfare 2)',
    gridSize: 'small',
    isTurret: false,
    rateOfFire: 700,
    shotsInBurst: 140,
    reloadTimeMs: 4000,
    magazineId: 'NATO_25x184mm',
  },
  {
    subtypeId: 'LargeGatlingTurretReskin',
    displayName: 'Gatling Turret Type II (Large Grid)',
    gridSize: 'large',
    isTurret: true,
    rateOfFire: 700,
    shotsInBurst: 140,
    reloadTimeMs: 4000,
    magazineId: 'NATO_25x184mm',
  },
  {
    subtypeId: 'SmallGatlingTurret',
    displayName: 'Gatling Turret (Small Grid)',
    gridSize: 'small',
    isTurret: true,
    rateOfFire: 700,
    shotsInBurst: 140,
    reloadTimeMs: 6000,
    magazineId: 'NATO_25x184mm',
  },
  {
    subtypeId: 'SmallGatlingTurretReskin',
    displayName: 'Gatling Turret Type II (Small Grid)',
    gridSize: 'small',
    isTurret: true,
    rateOfFire: 700,
    shotsInBurst: 140,
    reloadTimeMs: 6000,
    magazineId: 'NATO_25x184mm',
  },
  // === AUTOCANNON (AutocannonShell, ProjectileHealthDamage 85) ============
  {
    subtypeId: 'SmallBlockAutocannon',
    displayName: 'Autocannon',
    gridSize: 'small',
    isTurret: false,
    rateOfFire: 150,
    shotsInBurst: 16,
    reloadTimeMs: 4000,
    magazineId: 'AutocannonClip',
  },
  {
    subtypeId: 'AutoCannonTurret',
    displayName: 'Autocannon Turret',
    gridSize: 'small',
    isTurret: true,
    rateOfFire: 150,
    shotsInBurst: 16,
    reloadTimeMs: 4000,
    magazineId: 'AutocannonClip',
  },
  // === ASSAULT CANNON (MediumCalibreShell, MissileHealthPool 4000) ========
  {
    subtypeId: 'SmallBlockMediumCalibreGun',
    displayName: 'Assault Cannon',
    gridSize: 'small',
    isTurret: false,
    rateOfFire: 200,
    shotsInBurst: 1,
    reloadTimeMs: 6000,
    magazineId: 'MediumCalibreAmmo',
  },
  {
    subtypeId: 'SmallBlockMediumCalibreTurret',
    displayName: 'Assault Cannon Turret (Small Grid)',
    gridSize: 'small',
    isTurret: true,
    rateOfFire: 200,
    shotsInBurst: 1,
    reloadTimeMs: 6000,
    magazineId: 'MediumCalibreAmmo',
  },
  {
    subtypeId: 'LargeBlockMediumCalibreTurret',
    displayName: 'Assault Cannon Turret (Large Grid)',
    gridSize: 'large',
    isTurret: true,
    rateOfFire: 180,
    shotsInBurst: 2,
    reloadTimeMs: 6000,
    magazineId: 'MediumCalibreAmmo',
  },
  // === ARTILLERY (LargeCalibreShell, MissileHealthPool 17000) =============
  {
    subtypeId: 'LargeBlockLargeCalibreGun',
    displayName: 'Artillery Cannon',
    gridSize: 'large',
    isTurret: false,
    rateOfFire: 80,
    shotsInBurst: 1,
    reloadTimeMs: 12_000,
    magazineId: 'LargeCalibreAmmo',
  },
  {
    subtypeId: 'LargeCalibreTurret',
    displayName: 'Artillery Turret',
    gridSize: 'large',
    isTurret: true,
    rateOfFire: 80,
    shotsInBurst: 2,
    reloadTimeMs: 12_000,
    magazineId: 'LargeCalibreAmmo',
  },
  // === RAILGUNS (MissileHealthPool) =======================================
  {
    subtypeId: 'LargeRailgun',
    displayName: 'Railgun (Large Grid)',
    gridSize: 'large',
    isTurret: false,
    rateOfFire: 20,
    shotsInBurst: 1,
    reloadTimeMs: 4000,
    magazineId: 'LargeRailgunAmmo',
  },
  {
    subtypeId: 'SmallRailgun',
    displayName: 'Railgun (Small Grid)',
    gridSize: 'small',
    isTurret: false,
    rateOfFire: 20,
    shotsInBurst: 1,
    reloadTimeMs: 4000,
    magazineId: 'SmallRailgunAmmo',
  },
  // === ROCKETS / MISSILES (Missile, MissileExplosionDamage 500) ===========
  // The base-grid Rocket Launcher and (large) Missile Turret also ship with an
  // empty <SubtypeName>; we curate the named/reskin variants that carry an id.
  {
    subtypeId: 'LargeMissileLauncher',
    displayName: 'Rocket Launcher (Large Grid)',
    gridSize: 'large',
    isTurret: false,
    rateOfFire: 120,
    shotsInBurst: 19,
    reloadTimeMs: 4000,
    magazineId: 'Missile200mm',
  },
  {
    subtypeId: 'SmallMissileLauncherWarfare2',
    displayName: 'Rocket Launcher (Small Grid, Warfare 2)',
    gridSize: 'small',
    isTurret: false,
    rateOfFire: 120,
    shotsInBurst: 19,
    reloadTimeMs: 4000,
    magazineId: 'Missile200mm',
  },
  {
    subtypeId: 'SmallMissileTurret',
    displayName: 'Missile Turret (Small Grid)',
    gridSize: 'small',
    isTurret: true,
    rateOfFire: 90,
    shotsInBurst: 2,
    reloadTimeMs: 6000,
    magazineId: 'Missile200mm',
  },
  {
    subtypeId: 'LargeMissileTurretReskin',
    displayName: 'Rocket Turret Type II (Large Grid)',
    gridSize: 'large',
    isTurret: true,
    rateOfFire: 90,
    shotsInBurst: 6,
    reloadTimeMs: 4000,
    magazineId: 'Missile200mm',
  },
] as const;

/** Weapon-stats lookup by block SubtypeId — the map the combat engine uses. */
export const WEAPON_STATS_BY_SUBTYPE: ReadonlyMap<string, WeaponStats> = new Map(
  WEAPON_STATS.map((w) => [w.subtypeId, w]),
);
