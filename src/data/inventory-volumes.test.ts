/**
 * Curated inventory-volume tests — verify the hand-curated `inventoryVolume` +
 * `inventoryConstraint` values (v0.27.0) survive the `all-blocks.ts` merge and
 * resolve through the merged `BLOCKS_BY_ID`. Because curated `source:'vanilla'`
 * blocks win the merge on a SubtypeId conflict, these are the definitions an
 * imported blueprint resolves to — so the item-count feature works for real
 * imports, not just estimator builds.
 */
import { describe, it, expect } from 'vitest';
import { BLOCKS_BY_ID, type InventoryConstraint } from './index';

const expectInventory = (id: string, volume: number, constraint: InventoryConstraint): void => {
  const block = BLOCKS_BY_ID[id];
  expect(block, `block ${id} should exist`).toBeDefined();
  expect(block?.inventoryVolume).toBe(volume);
  expect(block?.inventoryConstraint).toBe(constraint);
};

describe('curated inventory volumes (Realistic ×1)', () => {
  it('drills hold ore', () => {
    expectInventory('small-drill', 3375, 'ore');
    expectInventory('large-drill', 23_437.5, 'ore');
  });

  it('connectors & collectors hold anything', () => {
    expectInventory('small-connector', 1152, 'any');
    expectInventory('large-connector', 8000, 'any');
    expectInventory('small-collector', 1675, 'any');
    expectInventory('large-collector', 6250, 'any');
  });

  it('welders hold components; grinders hold anything', () => {
    expectInventory('small-welder', 3375, 'component');
    expectInventory('large-welder', 15_625, 'component');
    expectInventory('small-grinder', 2500, 'any');
    expectInventory('large-grinder', 13_500, 'any');
  });

  it('reactors hold uranium', () => {
    expectInventory('small-small-reactor', 125, 'uranium');
    expectInventory('small-large-reactor', 1000, 'uranium');
    expectInventory('large-small-reactor', 1000, 'uranium');
    expectInventory('large-large-reactor', 8000, 'uranium');
  });

  it('small-grid drill holds "a little more than 9k ore" (user calibration)', () => {
    // 3,375 L ÷ 0.37 L/ore = 9,121 ore.
    const drill = BLOCKS_BY_ID['small-drill'];
    const oreVolume = 0.37;
    expect(Math.floor((drill?.inventoryVolume ?? 0) / oreVolume)).toBe(9121);
  });
});
