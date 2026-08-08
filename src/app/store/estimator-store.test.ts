import { describe, it, expect, beforeEach } from 'vitest';
import { useEstimatorStore, GRID_DEFAULTS } from './estimator-store';
import { useEstimate } from '../hooks/use-estimate';
import { renderHook } from '@testing-library/react';

/** Read current store state without React. */
const state = () => useEstimatorStore.getState();

describe('estimator store', () => {
  beforeEach(() => {
    state().reset();
  });

  describe('grid size', () => {
    it('defaults to large grid with matching default block choices', () => {
      const s = state();
      expect(s.gridSize).toBe('large');
      expect(s.thrusterId).toBe(GRID_DEFAULTS.large.thrusterId);
      expect(s.powerBlockId).toBe(GRID_DEFAULTS.large.batteryId);
    });

    it('switching grid resets block choices and clears essentials', () => {
      state().addBlock('large-drill');
      expect(state().fixedBlocks).toHaveLength(1);
      state().setGridSize('small');
      const s = state();
      expect(s.gridSize).toBe('small');
      expect(s.fixedBlocks).toHaveLength(0);
      expect(s.thrusterId).toBe(GRID_DEFAULTS.small.thrusterId);
      expect(s.powerKind).toBe('battery');
      expect(s.powerBlockId).toBe(GRID_DEFAULTS.small.batteryId);
    });

    it('switching grid clears per-direction thruster overrides', () => {
      state().setDirectionalThruster('left', 'large-large-atmospheric-thruster');
      expect(state().thrusterOverrides.left).toBe('large-large-atmospheric-thruster');
      state().setGridSize('small');
      expect(state().thrusterOverrides).toEqual({});
    });
  });

  describe('per-direction thruster overrides', () => {
    it('defaults to no overrides', () => {
      expect(state().thrusterOverrides).toEqual({});
    });

    it('sets an override for a single direction', () => {
      state().setDirectionalThruster('left', 'large-large-ion-thruster');
      expect(state().thrusterOverrides).toEqual({ left: 'large-large-ion-thruster' });
    });

    it('clears an override with null (back to "same as default")', () => {
      state().setDirectionalThruster('left', 'large-large-ion-thruster');
      state().setDirectionalThruster('left', null);
      expect(state().thrusterOverrides).toEqual({});
      expect('left' in state().thrusterOverrides).toBe(false);
    });

    it('clearing an unset direction is a no-op (no key added)', () => {
      state().setDirectionalThruster('right', null);
      expect(state().thrusterOverrides).toEqual({});
    });

    it('reset clears all overrides', () => {
      state().setDirectionalThruster('up', 'large-large-hydrogen-thruster');
      state().setDirectionalThruster('down', 'large-large-ion-thruster');
      state().reset();
      expect(state().thrusterOverrides).toEqual({});
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

  describe('config updates & clamping', () => {
    it('clamps targetTwr to a sane floor', () => {
      state().setTargetTwr(-3);
      expect(state().targetTwr).toBe(0.1);
      state().setTargetTwr(3.5);
      expect(state().targetTwr).toBe(3.5);
    });

    it('clamps lateral thrust fraction and cargo fill to 0..1', () => {
      state().setLateralThrustFraction(1.9);
      expect(state().lateralThrustFraction).toBe(1);
      state().setCargoFill(-0.5);
      expect(state().cargo.fillFraction).toBe(0);
    });

    it('setPower switches kind and block together', () => {
      state().setPower('producer', 'large-large-reactor');
      const s = state();
      expect(s.powerKind).toBe('producer');
      expect(s.powerBlockId).toBe('large-large-reactor');
    });

    it('floors cargo density and runtime target at 0', () => {
      state().setCargoDensity(-2);
      expect(state().cargo.densityKgPerL).toBe(0);
      state().setRuntimeTargetHours(-1);
      expect(state().runtimeTargetHours).toBe(0);
    });
  });

  describe('resolves ids into a live Estimate via useEstimate', () => {
    it('returns null-ish empty state before any essentials are added', () => {
      const { result } = renderHook(() => useEstimate());
      expect(result.current).not.toBeNull();
      expect(result.current?.isEmpty).toBe(true);
    });

    it('produces thruster / power / gyro counts once essentials exist', () => {
      state().addBlock('large-large-cargo-container');
      state().setQuantity('large-large-cargo-container', 2);
      state().setPlanet('earthlike');
      const { result } = renderHook(() => useEstimate());
      const r = result.current;
      expect(r).not.toBeNull();
      expect(r?.isEmpty).toBe(false);
      expect(r?.essentialsCount).toBe(2);
      // A cargo hauler on Earthlike needs lift thrusters, power, and gyros.
      expect(r?.estimate.thrusters.up).toBeGreaterThan(0);
      expect(r?.estimate.powerCount).toBeGreaterThan(0);
      expect(r?.estimate.gyroCount).toBeGreaterThan(0);
      expect(r?.estimate.totalThrusters).toBeGreaterThanOrEqual(r!.estimate.thrusters.up);
    });

    it('surfaces an infeasibility warning for atmospheric thrusters in space', () => {
      state().addBlock('large-large-cargo-container');
      state().setPlanet('space');
      state().setThruster('large-large-atmospheric-thruster');
      const { result } = renderHook(() => useEstimate());
      const r = result.current;
      expect(r?.estimate.warnings.length).toBeGreaterThan(0);
      expect(r?.estimate.warnings.join(' ')).toMatch(/thrust/i);
    });

    it('flows a per-direction override into the resolved thrusters + directional TWR', () => {
      state().addBlock('large-large-cargo-container');
      state().setPlanet('earthlike');
      // Base = atmospheric everywhere; pin the sides to ion.
      state().setThruster('large-large-atmospheric-thruster');
      state().setDirectionalThruster('left', 'large-large-ion-thruster');
      state().setDirectionalThruster('right', 'large-large-ion-thruster');
      const { result } = renderHook(() => useEstimate());
      const r = result.current;
      expect(r).not.toBeNull();
      // The override reaches the resolved per-direction thruster types.
      expect(r?.thrusters.up.id).toBe('large-large-atmospheric-thruster');
      expect(r?.thrusters.left.id).toBe('large-large-ion-thruster');
      expect(r?.thrusters.right.id).toBe('large-large-ion-thruster');
      // Directional TWR (empty + loaded) is exposed for the readout.
      expect(r?.directional.loaded.up).toBeGreaterThan(0);
      expect(r?.directional.empty.up).toBeGreaterThanOrEqual(r!.directional.loaded.up);
    });

    it('exposes ranked thruster-type suggestions per direction', () => {
      state().addBlock('large-large-cargo-container');
      state().setPlanet('earthlike');
      const { result } = renderHook(() => useEstimate());
      const r = result.current;
      expect(r).not.toBeNull();
      // Three types ranked for the lift axis, best feasible pick first.
      const up = r!.suggestions.up;
      expect(up).toHaveLength(3);
      expect(up[0]!.feasible).toBe(true);
      expect(Number.isFinite(up[0]!.countNeeded)).toBe(true);
      expect(up[0]!.countNeeded).toBeGreaterThan(0);
      // In dense air, atmospheric is feasible and ion reads "weak".
      const ion = up.find((s) => s.thrusterType === 'ion')!;
      expect(ion.note).toBe('weak in dense air');
    });

    it('ranks atmospheric last (infeasible) in vacuum', () => {
      state().addBlock('large-large-cargo-container');
      state().setPlanet('moon'); // vacuum + gravity
      const { result } = renderHook(() => useEstimate());
      const up = result.current!.suggestions.up;
      const atmo = up.find((s) => s.thrusterType === 'atmospheric')!;
      expect(atmo.feasible).toBe(false);
      expect(atmo.countNeeded).toBe(Infinity);
      // Infeasible type sorts after every feasible one.
      expect(up[up.length - 1]!.thrusterType).toBe('atmospheric');
    });
  });
});
