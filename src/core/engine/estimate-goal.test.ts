import { describe, it, expect } from 'vitest';
import { STANDARD_GRAVITY } from '../../data/planets';
import { evaluateGoal } from './estimate-goal';

const EARTH_G = 9.81;

describe('evaluateGoal — planet (TWR target)', () => {
  it('reports "reached" at exactly the goal TWR', () => {
    // mass 1000 kg, gravity 9.81 → weight 9810 N. Goal TWR 2 → need 19620 N.
    const v = evaluateGoal({ goal: 2, thrust: 2 * 1000 * EARTH_G, mass: 1000, gravity: EARTH_G });
    expect(v.isSpace).toBe(false);
    expect(v.metric).toBeCloseTo(2, 6);
    expect(v.status).toBe('reached');
    expect(v.accel).toBeCloseTo(19.62, 6); // thrust / mass
    expect(v.goalAccel).toBeCloseTo(2 * EARTH_G, 6); // 19.62
  });

  it('reports "exceeded" above the goal', () => {
    const v = evaluateGoal({ goal: 2, thrust: 3 * 1000 * EARTH_G, mass: 1000, gravity: EARTH_G });
    expect(v.metric).toBeCloseTo(3, 6);
    expect(v.status).toBe('exceeded');
  });

  it('reports "short" below the goal', () => {
    const v = evaluateGoal({ goal: 2, thrust: 1 * 1000 * EARTH_G, mass: 1000, gravity: EARTH_G });
    expect(v.metric).toBeCloseTo(1, 6);
    expect(v.status).toBe('short');
  });

  it('goalAccel = goal × gravity (worked: 2 g on Earth = 19.62 m/s²)', () => {
    const v = evaluateGoal({ goal: 2, thrust: 0, mass: 1000, gravity: EARTH_G });
    expect(v.goalAccel).toBeCloseTo(19.62, 6);
  });
});

describe('evaluateGoal — space (g-multiple of acceleration)', () => {
  it('reads the goal as target acceleration in g and reports "reached"', () => {
    // Space: goal 2 → accelerate at 2 g (19.62 m/s²). mass 1000 → need 19620 N.
    const v = evaluateGoal({ goal: 2, thrust: 2 * STANDARD_GRAVITY * 1000, mass: 1000, gravity: 0 });
    expect(v.isSpace).toBe(true);
    expect(v.accel).toBeCloseTo(2 * STANDARD_GRAVITY, 6);
    expect(v.metric).toBeCloseTo(2, 6); // accel / g
    expect(v.goalAccel).toBeCloseTo(19.62, 6);
    expect(v.status).toBe('reached');
  });

  it('reports "exceeded" when acceleration clears the g-target', () => {
    const v = evaluateGoal({ goal: 2, thrust: 3 * STANDARD_GRAVITY * 1000, mass: 1000, gravity: 0 });
    expect(v.metric).toBeCloseTo(3, 6);
    expect(v.status).toBe('exceeded');
  });

  it('reports "short" when acceleration is below the g-target', () => {
    const v = evaluateGoal({ goal: 2, thrust: 1 * STANDARD_GRAVITY * 1000, mass: 1000, gravity: 0 });
    expect(v.status).toBe('short');
  });
});

describe('evaluateGoal — edge cases', () => {
  it('zero thrust is "short" against a positive goal', () => {
    const v = evaluateGoal({ goal: 1.5, thrust: 0, mass: 1000, gravity: EARTH_G });
    expect(v.metric).toBe(0);
    expect(v.status).toBe('short');
  });

  it('a non-positive goal is always "reached" (no target to miss)', () => {
    expect(evaluateGoal({ goal: 0, thrust: 0, mass: 1000, gravity: EARTH_G }).status).toBe('reached');
    expect(evaluateGoal({ goal: -1, thrust: 0, mass: 1000, gravity: 0 }).status).toBe('reached');
  });

  it('non-positive mass yields a 0 metric and is "short" against a positive goal', () => {
    const v = evaluateGoal({ goal: 2, thrust: 1000, mass: 0, gravity: EARTH_G });
    expect(v.metric).toBe(0);
    expect(v.accel).toBe(0);
    expect(v.status).toBe('short');
  });

  it('respects the epsilon boundary just below the goal', () => {
    // metric = 1.9999995 < 2 - 1e-6 = 1.999999 is false → within epsilon → reached.
    const v = evaluateGoal({
      goal: 2,
      thrust: 1.9999995 * 1000 * EARTH_G,
      mass: 1000,
      gravity: EARTH_G,
      epsilon: 1e-6,
    });
    expect(v.status).toBe('reached');
  });

  it('falls just short outside the epsilon band', () => {
    const v = evaluateGoal({
      goal: 2,
      thrust: 1.99 * 1000 * EARTH_G,
      mass: 1000,
      gravity: EARTH_G,
      epsilon: 1e-6,
    });
    expect(v.status).toBe('short');
  });
});
