import type { BlockDefinition } from './schema';

/**
 * Curated vanilla WEAPON blocks — Space Engineers v1.210.012 b0.
 *
 * These are catalogue entries so weapons are *selectable* in the estimator's
 * essentials palette (and render with a proper category in the block list),
 * exactly like drills or cargo. They are deliberately **mass-only** blocks under
 * the `weapon` category: firing stats (rate of fire, damage, ammo, reload) live
 * in the combat overlay (`weapons.ts`, `WEAPON_STATS`), joined to a block purely
 * by SubtypeId. A weapon is never a firing-stat carrier in the schema — that
 * separation keeps the combat math a single source of truth and lets the block
 * catalogue stay plain serializable data.
 *
 * TRUSTWORTHINESS: every `mass`, `gridSize`, `dlc`, and `cellCount` here is
 * copied VERBATIM from the generated catalogue (`generated-blocks.ts`, derived
 * from the game's own `<Components>` lists). The `all-blocks.ts` merge lets the
 * curated entry win on a SubtypeId conflict, so these values must match the
 * generated ones exactly — otherwise an imported ship's mass would silently
 * change. The set covers the 17 weapons that carry a stable SubtypeId AND have
 * curated firing stats in `WEAPON_STATS`. See `docs/data-audit.md`.
 */
export const WEAPON_BLOCKS: readonly BlockDefinition[] = [
  // === GATLING (25×184mm) =================================================
  {
    id: 'weapon-small-gatling-gun-warfare2',
    subtypeId: 'SmallGatlingGunWarfare2',
    displayName: 'Gatling Gun (Warfare 2)',
    category: 'weapon',
    gridSize: 'small',
    dlc: 'warfare-2',
    mass: 148.2,
    cellCount: 4,
    source: 'vanilla',
  },
  {
    id: 'weapon-large-gatling-turret-reskin',
    subtypeId: 'LargeGatlingTurretReskin',
    displayName: 'Gatling Turret Type II (Large Grid)',
    category: 'weapon',
    gridSize: 'large',
    dlc: 'contact',
    mass: 1428,
    cellCount: 27,
    source: 'vanilla',
  },
  {
    id: 'weapon-small-gatling-turret',
    subtypeId: 'SmallGatlingTurret',
    displayName: 'Gatling Turret (Small Grid)',
    category: 'weapon',
    gridSize: 'small',
    dlc: 'base',
    mass: 692,
    cellCount: 125,
    source: 'vanilla',
  },
  {
    id: 'weapon-small-gatling-turret-reskin',
    subtypeId: 'SmallGatlingTurretReskin',
    displayName: 'Gatling Turret Type II (Small Grid)',
    category: 'weapon',
    gridSize: 'small',
    dlc: 'contact',
    mass: 692,
    cellCount: 125,
    source: 'vanilla',
  },
  // === AUTOCANNON =========================================================
  {
    id: 'weapon-small-block-autocannon',
    subtypeId: 'SmallBlockAutocannon',
    displayName: 'Autocannon',
    category: 'weapon',
    gridSize: 'small',
    dlc: 'base',
    mass: 180.2,
    cellCount: 5,
    source: 'vanilla',
  },
  {
    id: 'weapon-autocannon-turret',
    subtypeId: 'AutoCannonTurret',
    displayName: 'Autocannon Turret',
    category: 'weapon',
    gridSize: 'small',
    dlc: 'base',
    mass: 870,
    cellCount: 100,
    source: 'vanilla',
  },
  // === ASSAULT CANNON (medium calibre) ====================================
  {
    id: 'weapon-small-block-medium-calibre-gun',
    subtypeId: 'SmallBlockMediumCalibreGun',
    displayName: 'Assault Cannon',
    category: 'weapon',
    gridSize: 'small',
    dlc: 'base',
    mass: 860.2,
    cellCount: 9,
    source: 'vanilla',
  },
  {
    id: 'weapon-small-block-medium-calibre-turret',
    subtypeId: 'SmallBlockMediumCalibreTurret',
    displayName: 'Assault Cannon Turret (Small Grid)',
    category: 'weapon',
    gridSize: 'small',
    dlc: 'base',
    mass: 2254,
    cellCount: 245,
    source: 'vanilla',
  },
  {
    id: 'weapon-large-block-medium-calibre-turret',
    subtypeId: 'LargeBlockMediumCalibreTurret',
    displayName: 'Assault Cannon Turret (Large Grid)',
    category: 'weapon',
    gridSize: 'large',
    dlc: 'base',
    mass: 9654,
    cellCount: 18,
    source: 'vanilla',
  },
  // === ARTILLERY (large calibre) ==========================================
  {
    id: 'weapon-large-block-large-calibre-gun',
    subtypeId: 'LargeBlockLargeCalibreGun',
    displayName: 'Artillery Cannon',
    category: 'weapon',
    gridSize: 'large',
    dlc: 'base',
    mass: 5781,
    cellCount: 4,
    source: 'vanilla',
  },
  {
    id: 'weapon-large-calibre-turret',
    subtypeId: 'LargeCalibreTurret',
    displayName: 'Artillery Turret',
    category: 'weapon',
    gridSize: 'large',
    dlc: 'base',
    mass: 14_224,
    cellCount: 27,
    source: 'vanilla',
  },
  // === RAILGUNS ===========================================================
  {
    id: 'weapon-large-railgun',
    subtypeId: 'LargeRailgun',
    displayName: 'Railgun (Large Grid)',
    category: 'weapon',
    gridSize: 'large',
    dlc: 'base',
    mass: 14_470,
    cellCount: 16,
    source: 'vanilla',
  },
  {
    id: 'weapon-small-railgun',
    subtypeId: 'SmallRailgun',
    displayName: 'Railgun (Small Grid)',
    category: 'weapon',
    gridSize: 'small',
    dlc: 'base',
    mass: 1364,
    cellCount: 16,
    source: 'vanilla',
  },
  // === ROCKETS / MISSILES =================================================
  {
    id: 'weapon-large-missile-launcher',
    subtypeId: 'LargeMissileLauncher',
    displayName: 'Rocket Launcher (Large Grid)',
    category: 'weapon',
    gridSize: 'large',
    dlc: 'base',
    mass: 1713.8,
    cellCount: 2,
    source: 'vanilla',
  },
  {
    id: 'weapon-small-missile-launcher-warfare2',
    subtypeId: 'SmallMissileLauncherWarfare2',
    displayName: 'Rocket Launcher (Small Grid, Warfare 2)',
    category: 'weapon',
    gridSize: 'small',
    dlc: 'warfare-2',
    mass: 226.2,
    cellCount: 4,
    source: 'vanilla',
  },
  {
    id: 'weapon-small-missile-turret',
    subtypeId: 'SmallMissileTurret',
    displayName: 'Missile Turret (Small Grid)',
    category: 'weapon',
    gridSize: 'small',
    dlc: 'base',
    mass: 894,
    cellCount: 125,
    source: 'vanilla',
  },
  {
    id: 'weapon-large-missile-turret-reskin',
    subtypeId: 'LargeMissileTurretReskin',
    displayName: 'Rocket Turret Type II (Large Grid)',
    category: 'weapon',
    gridSize: 'large',
    dlc: 'contact',
    mass: 1826,
    cellCount: 27,
    source: 'vanilla',
  },
] as const;
