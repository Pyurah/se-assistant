import { describe, it, expect } from 'vitest';
import { BLOCKS_BY_SUBTYPE } from './all-blocks';
import {
  AMMO_ROUNDS,
  AMMO_MAGAZINES,
  AMMO_ROUNDS_BY_ID,
  AMMO_MAGAZINES_BY_ID,
} from './ammo';
import { WEAPON_STATS, WEAPON_STATS_BY_SUBTYPE } from './weapons';

describe('ammo dataset integrity', () => {
  it('every magazine references a round that exists', () => {
    for (const mag of AMMO_MAGAZINES) {
      expect(AMMO_ROUNDS_BY_ID.get(mag.roundId), `missing round: ${mag.roundId}`).toBeDefined();
    }
  });

  it('every round and magazine has positive quantities', () => {
    for (const round of AMMO_ROUNDS) {
      expect(round.damage).toBeGreaterThan(0);
      expect(round.projectileCount).toBeGreaterThanOrEqual(1);
    }
    for (const mag of AMMO_MAGAZINES) {
      expect(mag.capacity).toBeGreaterThanOrEqual(1);
      expect(mag.mass).toBeGreaterThan(0);
      expect(mag.volume).toBeGreaterThan(0);
    }
  });

  it('explosion rounds carry a radius; others do not', () => {
    for (const round of AMMO_ROUNDS) {
      if (round.damageKind === 'explosion') {
        expect(round.explosionRadius, `${round.id} needs a radius`).toBeGreaterThan(0);
      } else {
        expect(round.explosionRadius).toBeUndefined();
      }
    }
  });

  it('lookup maps are complete', () => {
    expect(AMMO_ROUNDS_BY_ID.size).toBe(AMMO_ROUNDS.length);
    expect(AMMO_MAGAZINES_BY_ID.size).toBe(AMMO_MAGAZINES.length);
  });
});

describe('weapon stats integrity', () => {
  it('every weapon SubtypeId resolves to a real block in the catalogue', () => {
    for (const w of WEAPON_STATS) {
      expect(BLOCKS_BY_SUBTYPE[w.subtypeId], `missing block: ${w.subtypeId}`).toBeDefined();
    }
  });

  it('every weapon references a magazine that exists', () => {
    for (const w of WEAPON_STATS) {
      expect(
        AMMO_MAGAZINES_BY_ID.get(w.magazineId),
        `missing magazine: ${w.magazineId}`,
      ).toBeDefined();
    }
  });

  it('every weapon has a positive rate of fire and non-negative reload/burst', () => {
    for (const w of WEAPON_STATS) {
      expect(w.rateOfFire, w.subtypeId).toBeGreaterThan(0);
      expect(w.reloadTimeMs, w.subtypeId).toBeGreaterThanOrEqual(0);
      expect(w.shotsInBurst, w.subtypeId).toBeGreaterThanOrEqual(0);
    }
  });

  it('the weapon grid size matches the block definition grid size', () => {
    for (const w of WEAPON_STATS) {
      const def = BLOCKS_BY_SUBTYPE[w.subtypeId];
      expect(def?.gridSize, w.subtypeId).toBe(w.gridSize);
    }
  });

  it('lookup map is complete and keyed by SubtypeId', () => {
    expect(WEAPON_STATS_BY_SUBTYPE.size).toBe(WEAPON_STATS.length);
    expect(WEAPON_STATS_BY_SUBTYPE.get('SmallGatlingTurret')?.rateOfFire).toBe(700);
  });
});
