import { describe, it, expect, beforeEach } from 'vitest';
import {
  useEstimatorStore,
  GRID_DEFAULTS,
  isAdjustedFromSource,
  emptyStacks,
  defaultGoals,
} from './estimator-store';
import { useEstimate } from '../hooks/use-estimate';
import { renderHook } from '@testing-library/react';
import { VANILLA_BLOCKS_BY_ID } from '@data';
import type { BlockDefinition, ThrusterBlock } from '@data';
import type { ShipDesign, DesignBlock } from '@core';

/** Read current store state without React. */
const state = () => useEstimatorStore.getState();

const cockpit = VANILLA_BLOCKS_BY_ID['large-cockpit'] as BlockDefinition;
const largeCargo = VANILLA_BLOCKS_BY_ID['large-large-cargo-container'] as BlockDefinition;
const atmoLarge = VANILLA_BLOCKS_BY_ID['large-large-atmospheric-thruster'] as ThrusterBlock;
const ionLarge = VANILLA_BLOCKS_BY_ID['large-large-ion-thruster'] as ThrusterBlock;
const largeReactor = VANILLA_BLOCKS_BY_ID['large-large-reactor'] as BlockDefinition;

const ATMO = 'large-large-atmospheric-thruster';
const ION = 'large-large-ion-thruster';

const moddedBlock: BlockDefinition = {
  id: 'modded:Exotic',
  subtypeId: 'Exotic',
  displayName: 'Exotic (modded)',
  category: 'other',
  gridSize: 'large',
  dlc: 'base',
  mass: 0,
  source: 'blueprint',
};

function seedDesign(blocks: DesignBlock[], overrides?: Partial<ShipDesign>): ShipDesign {
  return {
    id: 'seed-src',
    name: 'Seed Source',
    gridSize: 'large',
    blocks,
    planetId: 'earthlike',
    cargo: { fillFraction: 0.5, densityKgPerL: 2.8 },
    ...overrides,
  };
}

describe('estimator store', () => {
  beforeEach(() => {
    state().reset();
  });

  describe('grid size', () => {
    it('defaults to large grid with matching default block choices', () => {
      const s = state();
      expect(s.gridSize).toBe('large');
      expect(s.powerBlockId).toBe(GRID_DEFAULTS.large.batteryId);
      expect(s.thrusterStacks).toEqual(emptyStacks());
    });

    it('switching grid resets block choices, clears essentials AND thruster stacks', () => {
      state().addBlock('large-drill');
      state().addThruster('up', ATMO);
      expect(state().fixedBlocks).toHaveLength(1);
      expect(state().thrusterStacks.up).toHaveLength(1);
      state().setGridSize('small');
      const s = state();
      expect(s.gridSize).toBe('small');
      expect(s.fixedBlocks).toHaveLength(0);
      expect(s.thrusterStacks).toEqual(emptyStacks());
      expect(s.powerKind).toBe('battery');
      expect(s.powerBlockId).toBe(GRID_DEFAULTS.small.batteryId);
    });

    it('switching grid leaves goals and load-state untouched (grid-agnostic UI targets)', () => {
      state().setDirectionGoal('up', 3.5);
      state().setGoalLoadState('empty');
      state().setGridSize('small');
      expect(state().directionGoals.up).toBe(3.5);
      expect(state().goalLoadState).toBe('empty');
    });
  });

  describe('per-direction thruster stacks', () => {
    it('defaults to empty stacks in every direction', () => {
      expect(state().thrusterStacks).toEqual(emptyStacks());
    });

    it('addThruster adds a type at count 1 and bumps on repeat', () => {
      state().addThruster('up', ATMO);
      expect(state().thrusterStacks.up).toEqual([{ blockId: ATMO, count: 1 }]);
      state().addThruster('up', ATMO);
      expect(state().thrusterStacks.up).toEqual([{ blockId: ATMO, count: 2 }]);
    });

    it('supports MULTIPLE types mixed in one direction', () => {
      state().addThruster('up', ATMO);
      state().addThruster('up', ION);
      state().setThrusterCount('up', ATMO, 4);
      state().setThrusterCount('up', ION, 6);
      expect(state().thrusterStacks.up).toEqual([
        { blockId: ATMO, count: 4 },
        { blockId: ION, count: 6 },
      ]);
    });

    it('setThrusterCount floors, and zero removes the entry', () => {
      state().addThruster('up', ATMO);
      state().setThrusterCount('up', ATMO, 7.9);
      expect(state().thrusterStacks.up).toEqual([{ blockId: ATMO, count: 7 }]);
      state().setThrusterCount('up', ATMO, 0);
      expect(state().thrusterStacks.up).toEqual([]);
    });

    it('setThrusterCount adds an entry when the type is not yet present', () => {
      state().setThrusterCount('left', ION, 3);
      expect(state().thrusterStacks.left).toEqual([{ blockId: ION, count: 3 }]);
    });

    it('removeThruster drops only that type from the direction', () => {
      state().addThruster('up', ATMO);
      state().addThruster('up', ION);
      state().removeThruster('up', ATMO);
      expect(state().thrusterStacks.up).toEqual([{ blockId: ION, count: 1 }]);
    });

    it('stacks are per-direction independent', () => {
      state().addThruster('up', ATMO);
      state().addThruster('down', ION);
      expect(state().thrusterStacks.up).toEqual([{ blockId: ATMO, count: 1 }]);
      expect(state().thrusterStacks.down).toEqual([{ blockId: ION, count: 1 }]);
      expect(state().thrusterStacks.left).toEqual([]);
    });

    it('reset clears all stacks', () => {
      state().addThruster('up', ATMO);
      state().addThruster('down', ION);
      state().reset();
      expect(state().thrusterStacks).toEqual(emptyStacks());
    });
  });

  describe('per-direction goals + load state', () => {
    it('defaults to 2.0 up / 1.0 elsewhere, loaded', () => {
      expect(state().directionGoals).toEqual(defaultGoals());
      expect(state().directionGoals.up).toBe(2.0);
      expect(state().directionGoals.left).toBe(1.0);
      expect(state().goalLoadState).toBe('loaded');
    });

    it('setDirectionGoal floors at 0', () => {
      state().setDirectionGoal('up', 3.5);
      expect(state().directionGoals.up).toBe(3.5);
      state().setDirectionGoal('up', -2);
      expect(state().directionGoals.up).toBe(0);
    });

    it('setGoalLoadState toggles empty/loaded', () => {
      state().setGoalLoadState('empty');
      expect(state().goalLoadState).toBe('empty');
      state().setGoalLoadState('loaded');
      expect(state().goalLoadState).toBe('loaded');
    });

    it('reset restores goal + load-state defaults', () => {
      state().setDirectionGoal('up', 5);
      state().setGoalLoadState('empty');
      state().reset();
      expect(state().directionGoals).toEqual(defaultGoals());
      expect(state().goalLoadState).toBe('loaded');
    });
  });

  describe('essentials (add / remove / quantity)', () => {
    it('adds a new block at quantity 1', () => {
      state().addBlock('large-drill');
      expect(state().fixedBlocks).toEqual([{ id: 'large-drill', quantity: 1 }]);
    });

    it('adding an existing block bumps its quantity', () => {
      state().addBlock('large-drill');
      state().addBlock('large-drill');
      expect(state().fixedBlocks).toEqual([{ id: 'large-drill', quantity: 2 }]);
    });

    it('setQuantity floors, and zero removes the block', () => {
      state().addBlock('large-drill');
      state().setQuantity('large-drill', 4.9);
      expect(state().fixedBlocks[0]?.quantity).toBe(4);
      state().setQuantity('large-drill', 0);
      expect(state().fixedBlocks).toHaveLength(0);
    });

    it('removeBlock drops the entry', () => {
      state().addBlock('large-drill');
      state().addBlock('large-large-cargo-container');
      state().removeBlock('large-drill');
      expect(state().fixedBlocks.map((b) => b.id)).toEqual(['large-large-cargo-container']);
    });
  });

  describe('support config updates & clamping', () => {
    it('setPower switches kind and block together', () => {
      state().setPower('producer', 'large-large-reactor');
      const s = state();
      expect(s.powerKind).toBe('producer');
      expect(s.powerBlockId).toBe('large-large-reactor');
    });

    it('clamps cargo fill to 0..1', () => {
      state().setCargoFill(1.9);
      expect(state().cargo.fillFraction).toBe(1);
      state().setCargoFill(-0.5);
      expect(state().cargo.fillFraction).toBe(0);
    });

    it('floors cargo density and runtime target at 0', () => {
      state().setCargoDensity(-2);
      expect(state().cargo.densityKgPerL).toBe(0);
      state().setRuntimeTargetHours(-1);
      expect(state().runtimeTargetHours).toBe(0);
    });
  });

  describe('target turn time (maneuverability)', () => {
    it('defaults to 2.5 s', () => {
      expect(state().targetTurnTime).toBe(2.5);
    });

    it('setTargetTurnTime sets a value in range', () => {
      state().setTargetTurnTime(1.5);
      expect(state().targetTurnTime).toBe(1.5);
    });

    it('clamps below the 0.25 s floor', () => {
      state().setTargetTurnTime(0.05);
      expect(state().targetTurnTime).toBe(0.25);
    });

    it('clamps above the 60 s ceiling', () => {
      state().setTargetTurnTime(120);
      expect(state().targetTurnTime).toBe(60);
    });

    it('falls back to the 2.5 s default for a non-finite value', () => {
      state().setTargetTurnTime(Number.NaN);
      expect(state().targetTurnTime).toBe(2.5);
      state().setTargetTurnTime(Number.POSITIVE_INFINITY);
      expect(state().targetTurnTime).toBe(2.5);
    });

    it('reset restores the 2.5 s default', () => {
      state().setTargetTurnTime(10);
      state().reset();
      expect(state().targetTurnTime).toBe(2.5);
    });

    it('is a UI target: seedFromDesign leaves it untouched', () => {
      state().setTargetTurnTime(4);
      state().seedFromDesign(
        seedDesign([{ definition: atmoLarge, quantity: 8, thrustDirection: 'up' }]),
        'ship.sbc',
      );
      expect(state().targetTurnTime).toBe(4);
    });

    it('is a UI target: changing it never flips isAdjustedFromSource', () => {
      state().seedFromDesign(
        seedDesign([
          { definition: cockpit, quantity: 1 },
          { definition: atmoLarge, quantity: 8, thrustDirection: 'up' },
        ]),
        'ship.sbc',
      );
      state().setTargetTurnTime(0.5);
      expect(isAdjustedFromSource(state())).toBe(false);
    });
  });

  describe('resolves ids into a live Estimate via useEstimate', () => {
    it('is empty before any essentials or thrusters are added', () => {
      const { result } = renderHook(() => useEstimate());
      expect(result.current).not.toBeNull();
      expect(result.current?.isEmpty).toBe(true);
    });

    it('sizes power + gyros against a manually-assigned thruster build', () => {
      state().addBlock('large-large-cargo-container');
      state().setQuantity('large-large-cargo-container', 2);
      state().setPlanet('earthlike');
      state().setThrusterCount('up', ATMO, 10);
      const { result } = renderHook(() => useEstimate());
      const r = result.current;
      expect(r).not.toBeNull();
      expect(r?.isEmpty).toBe(false);
      expect(r?.essentialsCount).toBe(2);
      // The manual UP thrusters carry into the estimate; support is sized.
      expect(r?.estimate.thrusters.up).toBe(10);
      expect(r?.estimate.powerCount).toBeGreaterThan(0);
      expect(r?.estimate.gyroCount).toBeGreaterThan(0);
    });

    it('warns (advisory) for atmospheric thrusters assigned in space', () => {
      state().addBlock('large-large-cargo-container');
      state().setPlanet('space');
      state().setThrusterCount('up', ATMO, 4);
      const { result } = renderHook(() => useEstimate());
      const r = result.current;
      expect(r?.estimate.warnings.length).toBeGreaterThan(0);
      expect(r?.estimate.warnings.join(' ')).toMatch(/thrust/i);
    });

    it('resolves the per-direction layout, mixing types, into directional TWR', () => {
      state().addBlock('large-large-cargo-container');
      state().setPlanet('earthlike');
      state().setThrusterCount('up', ATMO, 8);
      state().setThrusterCount('left', ION, 3);
      state().setThrusterCount('right', ION, 3);
      const { result } = renderHook(() => useEstimate());
      const r = result.current;
      expect(r).not.toBeNull();
      // Resolved layout reflects the assigned types.
      expect(r?.resolvedLayout.up).toEqual([{ definition: atmoLarge, count: 8 }]);
      expect(r?.resolvedLayout.left).toEqual([{ definition: ionLarge, count: 3 }]);
      // Directional TWR (empty + loaded) is exposed for the readout.
      expect(r?.directional.loaded.up).toBeGreaterThan(0);
      expect(r?.directional.empty.up).toBeGreaterThanOrEqual(r!.directional.loaded.up);
    });

    it('computes per-direction goal verdicts at the chosen load-state', () => {
      state().addBlock('large-large-cargo-container');
      state().setPlanet('earthlike');
      state().setDirectionGoal('up', 2.0);
      // Give UP plenty of lift so it clears the goal.
      state().setThrusterCount('up', ATMO, 40);
      const { result } = renderHook(() => useEstimate());
      const r = result.current;
      expect(r).not.toBeNull();
      const up = r!.goalVerdicts.up;
      expect(up.isSpace).toBe(false);
      expect(['reached', 'exceeded']).toContain(up.status);
      // DOWN has no thrusters and a positive goal → short.
      expect(r!.goalVerdicts.down.status).toBe('short');
    });

    it('exposes ranked thruster-type suggestions per direction', () => {
      state().addBlock('large-large-cargo-container');
      state().setPlanet('earthlike');
      const { result } = renderHook(() => useEstimate());
      const r = result.current;
      expect(r).not.toBeNull();
      const up = r!.suggestions.up;
      expect(up).toHaveLength(3);
      expect(up[0]!.feasible).toBe(true);
      const ion = up.find((s) => s.thrusterType === 'ion')!;
      expect(ion.note).toBe('weak in dense air');
    });
  });

  describe('seedFromDesign', () => {
    it('populates essentials + real thruster layout + power atomically', () => {
      const src = seedDesign([
        { definition: cockpit, quantity: 1 },
        { definition: largeCargo, quantity: 3 },
        { definition: atmoLarge, quantity: 8, thrustDirection: 'up' },
        { definition: ionLarge, quantity: 4, thrustDirection: 'left' },
        { definition: largeReactor, quantity: 2 },
      ]);
      state().seedFromDesign(src, 'my-ship.sbc');
      const s = state();

      // Essentials carried with real counts; sized blocks are NOT essentials.
      expect(s.fixedBlocks).toEqual([
        { id: cockpit.id, quantity: 1 },
        { id: largeCargo.id, quantity: 3 },
      ]);
      // Thruster stacks carry the ship's REAL per-direction layout.
      expect(s.thrusterStacks.up).toEqual([{ blockId: atmoLarge.id, count: 8 }]);
      expect(s.thrusterStacks.left).toEqual([{ blockId: ionLarge.id, count: 4 }]);
      expect(s.thrusterStacks.down).toEqual([]);
      // Power seeded from the dominant power block.
      expect(s.powerKind).toBe('producer');
      expect(s.powerBlockId).toBe(largeReactor.id);
      // Planet + cargo + grid carry through.
      expect(s.gridSize).toBe('large');
      expect(s.planetId).toBe('earthlike');
      expect(s.cargo).toEqual({ fillFraction: 0.5, densityKgPerL: 2.8 });
      // Source snapshot recorded for the adjusted/reset affordance.
      expect(s.sourceName).toBe('my-ship.sbc');
      expect(s.sourceDesign).toBe(src);
    });

    it('does NOT seed goals or load-state (UI targets, not part of the ship)', () => {
      state().setDirectionGoal('up', 4);
      state().setGoalLoadState('empty');
      state().seedFromDesign(
        seedDesign([{ definition: atmoLarge, quantity: 8, thrustDirection: 'up' }]),
        'ship.sbc',
      );
      // Goals + load-state survive a seed unchanged.
      expect(state().directionGoals.up).toBe(4);
      expect(state().goalLoadState).toBe('empty');
    });

    it('falls back to grid default power when the design has no power', () => {
      state().seedFromDesign(seedDesign([{ definition: cockpit, quantity: 1 }]), 'bare.sbc');
      const s = state();
      expect(s.thrusterStacks).toEqual(emptyStacks());
      expect(s.powerBlockId).toBe(GRID_DEFAULTS.large.batteryId);
      expect(s.powerKind).toBe('battery');
    });

    it('records skipped modded blocks and never lists them as essentials', () => {
      state().seedFromDesign(
        seedDesign([
          { definition: cockpit, quantity: 1 },
          { definition: moddedBlock, quantity: 4, thrustDirection: 'up' },
        ]),
        'modded.sbc',
      );
      const s = state();
      expect(s.fixedBlocks.map((b) => b.id)).not.toContain(moddedBlock.id);
      expect(s.lastSeedSkipped).toHaveLength(1);
      expect(s.lastSeedSkipped[0]).toMatchObject({ id: moddedBlock.id, quantity: 4 });
    });

    it('does not mutate the source design', () => {
      const src = seedDesign([{ definition: largeCargo, quantity: 2 }]);
      const before = JSON.stringify(src);
      state().seedFromDesign(src, 'x.sbc');
      state().addBlock('large-large-cargo-container');
      state().setCargoFill(0.9);
      expect(JSON.stringify(src)).toBe(before);
    });
  });

  describe('isAdjustedFromSource + resetToSource', () => {
    const src = () =>
      seedDesign([
        { definition: cockpit, quantity: 1 },
        { definition: largeCargo, quantity: 2 },
        { definition: atmoLarge, quantity: 8, thrustDirection: 'up' },
      ]);

    it('is false with no source snapshot', () => {
      expect(isAdjustedFromSource(state())).toBe(false);
    });

    it('is false immediately after seeding', () => {
      state().seedFromDesign(src(), 'ship.sbc');
      expect(isAdjustedFromSource(state())).toBe(false);
    });

    it('flips true after adding an essential, false again after reset', () => {
      state().seedFromDesign(src(), 'ship.sbc');
      state().addBlock('large-large-cargo-container');
      expect(isAdjustedFromSource(state())).toBe(true);
      state().resetToSource();
      expect(isAdjustedFromSource(state())).toBe(false);
    });

    it('flips true after changing an essential quantity', () => {
      state().seedFromDesign(src(), 'ship.sbc');
      state().setQuantity(largeCargo.id, 5);
      expect(isAdjustedFromSource(state())).toBe(true);
    });

    it('flips true after changing cargo fill', () => {
      state().seedFromDesign(src(), 'ship.sbc');
      state().setCargoFill(0.1);
      expect(isAdjustedFromSource(state())).toBe(true);
    });

    it('flips true after changing a thruster stack (count)', () => {
      state().seedFromDesign(src(), 'ship.sbc');
      state().setThrusterCount('up', atmoLarge.id, 12);
      expect(isAdjustedFromSource(state())).toBe(true);
    });

    it('flips true after adding a thruster type to a direction', () => {
      state().seedFromDesign(src(), 'ship.sbc');
      state().addThruster('up', ION);
      expect(isAdjustedFromSource(state())).toBe(true);
    });

    it('flips true after assigning thrusters to a new direction', () => {
      state().seedFromDesign(src(), 'ship.sbc');
      state().addThruster('left', ION);
      expect(isAdjustedFromSource(state())).toBe(true);
    });

    it('does NOT flip when only a goal changes (goals are excluded)', () => {
      state().seedFromDesign(src(), 'ship.sbc');
      state().setDirectionGoal('up', 3.5);
      expect(isAdjustedFromSource(state())).toBe(false);
    });

    it('does NOT flip when only the load-state toggle changes', () => {
      state().seedFromDesign(src(), 'ship.sbc');
      state().setGoalLoadState('empty');
      expect(isAdjustedFromSource(state())).toBe(false);
    });

    it('resetToSource is a no-op when nothing was seeded', () => {
      state().addBlock('large-large-cargo-container');
      state().resetToSource();
      expect(state().fixedBlocks.map((b) => b.id)).toContain('large-large-cargo-container');
      expect(state().sourceDesign).toBeNull();
    });

    it('reset() clears the source snapshot and skipped diagnostics', () => {
      state().seedFromDesign(
        seedDesign([
          { definition: cockpit, quantity: 1 },
          { definition: moddedBlock, quantity: 2 },
        ]),
        'ship.sbc',
      );
      expect(state().sourceDesign).not.toBeNull();
      expect(state().lastSeedSkipped.length).toBeGreaterThan(0);
      state().reset();
      const s = state();
      expect(s.sourceDesign).toBeNull();
      expect(s.sourceName).toBeNull();
      expect(s.lastSeedSkipped).toEqual([]);
    });
  });
});
