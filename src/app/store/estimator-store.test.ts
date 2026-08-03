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
  });
});
