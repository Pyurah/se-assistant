import { describe, it, expect } from 'vitest';
import { BLOCKS_BY_SUBTYPE } from '../../data/all-blocks';
import type { ShipDesign, DesignBlock } from '../types';
import { combatAnalysis } from './combat';

function block(subtypeId: string, quantity: number): DesignBlock {
  const definition = BLOCKS_BY_SUBTYPE[subtypeId];
  if (!definition) throw new Error(`test setup: unknown subtypeId ${subtypeId}`);
  return { definition, quantity };
}

function ship(blocks: DesignBlock[], gridSize: 'small' | 'large' = 'small'): ShipDesign {
  return {
    id: 'combat',
    name: 'Gunship',
    gridSize,
    blocks,
    planetId: 'earthlike',
    cargo: { fillFraction: 0, densityKgPerL: 2 },
  };
}

describe('combatAnalysis — gatling worked example', () => {
  // Gatling: RoF 700/min → 11.6667 shots/s; LargeCaliber damage 33.
  //   burstDPS   = 33 × (700/60)        = 385 DPS
  //   burstShots = 140, reload 6 s (SmallGatlingTurret)
  //   fireTime   = 140 / 11.6667        = 12 s
  //   dutyCycle  = 12 / (12 + 6)        = 0.6667
  //   sustained  = 385 × 0.6667         = 256.67 DPS
  const c = combatAnalysis(ship([block('SmallGatlingTurret', 1)]));

  it('is armed with one weapon type', () => {
    expect(c.isArmed).toBe(true);
    expect(c.weaponTypeCount).toBe(1);
    expect(c.weaponCount).toBe(1);
  });

  it('computes burst DPS as damage × (RoF / 60)', () => {
    expect(c.weapons[0]!.burstDps).toBeCloseTo(385, 4);
  });

  it('discounts sustained DPS by the reload duty cycle', () => {
    // 6 s reload after a 140-shot burst that takes 12 s → 12/18 duty.
    expect(c.weapons[0]!.sustainedDps).toBeCloseTo(385 * (12 / 18), 2);
  });

  it('loads one magazine (140 rounds) by default and lasts 12 s of fire', () => {
    expect(c.weapons[0]!.loadedRounds).toBe(140);
    expect(c.weapons[0]!.fireDurationSeconds).toBeCloseTo(12, 4);
  });

  it('labels the damage kind and round', () => {
    expect(c.weapons[0]!.damageKind).toBe('health');
    expect(c.weapons[0]!.roundDisplayName).toMatch(/gatling/i);
  });
});

describe('combatAnalysis — continuous-fire gatling gun (no reload gap)', () => {
  // SmallGatlingGun: RoF 700, ShotsInBurst 140, reload 4000 ms.
  //   fireTime  = 140/11.6667 = 12 s; dutyCycle = 12/16 = 0.75.
  const c = combatAnalysis(ship([block('SmallGatlingGunWarfare2', 2)]));

  it('scales totals by weapon quantity', () => {
    expect(c.weaponCount).toBe(2);
    expect(c.weapons[0]!.totalBurstDps).toBeCloseTo(385 * 2, 2);
    expect(c.weapons[0]!.totalSustainedDps).toBeCloseTo(385 * 0.75 * 2, 2);
  });

  it('loads 140 rounds per weapon → 280 across two guns', () => {
    expect(c.weapons[0]!.loadedRounds).toBe(280);
    expect(c.totalLoadedRounds).toBe(280);
  });
});

describe('combatAnalysis — autocannon worked example', () => {
  // Autocannon: RoF 150 → 2.5 shots/s; AutocannonShell damage 85.
  //   burstDPS   = 85 × 2.5   = 212.5
  //   burstShots = 16, reload 4 s; fireTime = 16/2.5 = 6.4 s
  //   dutyCycle  = 6.4/10.4   = 0.6154 → sustained ≈ 130.77
  const c = combatAnalysis(ship([block('SmallBlockAutocannon', 1)]));

  it('computes burst and sustained DPS', () => {
    expect(c.weapons[0]!.burstDps).toBeCloseTo(212.5, 4);
    expect(c.weapons[0]!.sustainedDps).toBeCloseTo(212.5 * (6.4 / 10.4), 2);
  });
});

describe('combatAnalysis — ship totals and magazine option', () => {
  const design = ship([block('SmallGatlingTurret', 1), block('SmallBlockAutocannon', 1)]);

  it('sums burst DPS across weapon types', () => {
    const c = combatAnalysis(design);
    expect(c.totalBurstDps).toBeCloseTo(385 + 212.5, 2);
    expect(c.weaponTypeCount).toBe(2);
  });

  it('sorts weapon rows by total burst DPS descending', () => {
    const c = combatAnalysis(design);
    expect(c.weapons[0]!.subtypeId).toBe('SmallGatlingTurret'); // 385 > 212.5
  });

  it('scales loaded rounds with magazinesPerWeapon', () => {
    const c = combatAnalysis(design, { magazinesPerWeapon: 3 });
    // Gatling 140×3 + autocannon 16×3 = 420 + 48 = 468.
    expect(c.totalLoadedRounds).toBe(468);
    expect(c.magazinesPerWeapon).toBe(3);
  });

  it('treats magazinesPerWeapon 0 as no loaded ammo', () => {
    const c = combatAnalysis(design, { magazinesPerWeapon: 0 });
    expect(c.totalLoadedRounds).toBe(0);
    // Still armed — DPS is a rate, independent of loaded ammo.
    expect(c.isArmed).toBe(true);
    expect(c.totalBurstDps).toBeGreaterThan(0);
  });
});

describe('combatAnalysis — honesty & empty state', () => {
  it('reports an unarmed ship with no weapons', () => {
    const c = combatAnalysis(ship([block('SmallBlockCockpit', 1)]));
    expect(c.isArmed).toBe(false);
    expect(c.weapons).toHaveLength(0);
    expect(c.totalBurstDps).toBe(0);
    expect(c.fireDurationSeconds).toBe(Infinity);
  });

  it('flags weapon-like blocks with no curated stats instead of zeroing them', () => {
    // LargeInteriorTurret exists in the catalogue but has no curated firing stats.
    const c = combatAnalysis(ship([block('LargeInteriorTurret', 1)], 'large'));
    expect(c.isArmed).toBe(false);
    expect(c.unrecognizedWeapons).toContain('LargeInteriorTurret');
  });

  it('scores known weapons even when an unknown weapon is present', () => {
    const c = combatAnalysis(
      ship([block('SmallGatlingTurret', 1), block('LargeInteriorTurret', 1)], 'small'),
    );
    expect(c.isArmed).toBe(true);
    expect(c.weaponTypeCount).toBe(1);
    expect(c.unrecognizedWeapons).toContain('LargeInteriorTurret');
  });
});
