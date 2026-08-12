/**
 * Cargo item + inventory-constraint tests.
 *
 * The `inventoryAccepts` truth table is correctness-critical: it decides which
 * block inventories count toward "how many X fit?" in the mass engine. A wrong
 * cell here would silently over- or under-count a hauler's capacity.
 */
import { describe, it, expect } from 'vitest';
import {
  CARGO_ITEMS_BY_ID,
  inventoryAccepts,
  itemDensity,
  type CargoItem,
  type InventoryConstraint,
} from './index';

const item = (id: string): CargoItem => {
  const found = CARGO_ITEMS_BY_ID[id];
  if (!found) throw new Error(`test setup: unknown cargo item ${id}`);
  return found;
};

describe('inventoryAccepts', () => {
  const ironOre = () => item('ore-iron');
  const ice = () => item('ore-ice');
  const uraniumIngot = () => item('ingot-uranium');
  const ironIngot = () => item('ingot-iron');
  const steelPlate = () => item('comp-steel-plate');

  it("'any' accepts every category", () => {
    for (const it of [ironOre(), ice(), uraniumIngot(), ironIngot(), steelPlate()]) {
      expect(inventoryAccepts('any', it)).toBe(true);
    }
  });

  it("'ore' accepts ores (and ice, which is an ore) but not ingots or components", () => {
    expect(inventoryAccepts('ore', ironOre())).toBe(true);
    expect(inventoryAccepts('ore', ice())).toBe(true); // ice is an ore in-game
    expect(inventoryAccepts('ore', ironIngot())).toBe(false);
    expect(inventoryAccepts('ore', uraniumIngot())).toBe(false);
    expect(inventoryAccepts('ore', steelPlate())).toBe(false);
  });

  it("'uranium' accepts only the uranium ingot", () => {
    expect(inventoryAccepts('uranium', uraniumIngot())).toBe(true);
    expect(inventoryAccepts('uranium', ironIngot())).toBe(false);
    expect(inventoryAccepts('uranium', item('ore-uranium'))).toBe(false); // ore, not ingot
    expect(inventoryAccepts('uranium', ironOre())).toBe(false);
  });

  it("'ice' accepts only ice", () => {
    expect(inventoryAccepts('ice', ice())).toBe(true);
    expect(inventoryAccepts('ice', ironOre())).toBe(false);
    expect(inventoryAccepts('ice', steelPlate())).toBe(false);
  });

  it("'component' accepts only component-category items", () => {
    expect(inventoryAccepts('component', steelPlate())).toBe(true);
    expect(inventoryAccepts('component', item('comp-computer'))).toBe(true);
    expect(inventoryAccepts('component', ironOre())).toBe(false);
    expect(inventoryAccepts('component', ironIngot())).toBe(false);
  });

  it("'ammo' accepts nothing (ammo isn't a haulable CargoItem)", () => {
    for (const it of [ironOre(), ice(), uraniumIngot(), ironIngot(), steelPlate()]) {
      expect(inventoryAccepts('ammo', it)).toBe(false);
    }
  });

  it('is total over every constraint (no unhandled case)', () => {
    const constraints: InventoryConstraint[] = ['any', 'ore', 'uranium', 'ice', 'component', 'ammo'];
    for (const c of constraints) {
      expect(typeof inventoryAccepts(c, item('ore-iron'))).toBe('boolean');
    }
  });
});

describe('itemDensity', () => {
  it('is mass / volume', () => {
    expect(itemDensity(item('comp-steel-plate'))).toBeCloseTo(20 / 3, 6);
    expect(itemDensity(item('ore-iron'))).toBeCloseTo(1 / 0.37, 6);
  });
});
