import { describe, it, expect } from 'vitest';
import type { BuildCost } from './build-cost';
import { manufacturingThroughput } from './throughput';

/**
 * A synthetic {@link BuildCost} with just the fields throughput reads. Refine
 * and assemble seconds are set directly so each test isolates the fleet math
 * from the cost engine. `ore` / `components` back the per-hour rates.
 */
function cost(overrides: Partial<BuildCost> = {}): BuildCost {
  return {
    components: { 'steel-plate': 100 },
    ingots: { iron: 2100 },
    ore: { iron: 3750 },
    refineTimeSeconds: 600,
    assembleTimeSeconds: 100,
    unknownBlocks: [],
    knownBlockTypes: 1,
    totalBlockTypes: 1,
    ...overrides,
  };
}

describe('manufacturingThroughput', () => {
  it('a single machine each: wall clock is the slower stage', () => {
    const t = manufacturingThroughput(cost({ refineTimeSeconds: 600, assembleTimeSeconds: 100 }));
    expect(t.refineStageSeconds).toBe(600);
    expect(t.assembleStageSeconds).toBe(100);
    expect(t.wallClockSeconds).toBe(600);
    expect(t.bottleneck).toBe('refinery');
  });

  it('adding refineries divides the refine stage and can flip the bottleneck', () => {
    const base = cost({ refineTimeSeconds: 600, assembleTimeSeconds: 100 });
    const six = manufacturingThroughput(base, { refineryCount: 6 });
    // 600 / 6 = 100 refine vs 100 assemble → balanced.
    expect(six.refineStageSeconds).toBe(100);
    expect(six.wallClockSeconds).toBe(100);
    expect(six.bottleneck).toBe('balanced');

    const twelve = manufacturingThroughput(base, { refineryCount: 12 });
    // 600 / 12 = 50 refine vs 100 assemble → assembler-bound.
    expect(twelve.refineStageSeconds).toBe(50);
    expect(twelve.wallClockSeconds).toBe(100);
    expect(twelve.bottleneck).toBe('assembler');
  });

  it('adding assemblers divides the assemble stage', () => {
    const t = manufacturingThroughput(cost({ refineTimeSeconds: 100, assembleTimeSeconds: 200 }), {
      assemblerCount: 4,
    });
    expect(t.assembleStageSeconds).toBe(50);
    expect(t.wallClockSeconds).toBe(100);
    expect(t.bottleneck).toBe('refinery');
  });

  it('treats near-equal stages as balanced within the epsilon', () => {
    // 100 vs 101 → 1% apart, inside the 2% band.
    const t = manufacturingThroughput(cost({ refineTimeSeconds: 101, assembleTimeSeconds: 100 }));
    expect(t.bottleneck).toBe('balanced');
  });

  it('reports utilization: bottleneck stage is 1, the other proportional', () => {
    const t = manufacturingThroughput(cost({ refineTimeSeconds: 600, assembleTimeSeconds: 150 }));
    expect(t.refineryUtilization).toBeCloseTo(1, 6);
    expect(t.assemblerUtilization).toBeCloseTo(150 / 600, 6);
  });

  it('derives the balanced ratio from the two serial totals', () => {
    const t = manufacturingThroughput(cost({ refineTimeSeconds: 700, assembleTimeSeconds: 100 }));
    expect(t.balancedRatio).toBeCloseTo(7, 6);
  });

  it('suggests an integer fleet that balances the other stage', () => {
    const t = manufacturingThroughput(cost({ refineTimeSeconds: 650, assembleTimeSeconds: 100 }), {
      assemblerCount: 2,
      refineryCount: 3,
    });
    // ratio 6.5 → for 2 assemblers, ceil(2 × 6.5) = 13 refineries.
    expect(t.suggestedRefineries).toBe(13);
    // for 3 refineries, ceil(3 / 6.5) = 1 assembler.
    expect(t.suggestedAssemblers).toBe(1);
  });

  it('computes per-hour rates across each fleet', () => {
    const t = manufacturingThroughput(
      cost({
        refineTimeSeconds: 3600,
        assembleTimeSeconds: 3600,
        ore: { iron: 1000, nickel: 500 },
        components: { 'steel-plate': 40, motor: 20 },
      }),
    );
    // 1 refinery, 3600 s stage → all 1500 kg ore refined in exactly one hour.
    expect(t.orePerHour).toBeCloseTo(1500, 6);
    expect(t.componentsPerHour).toBeCloseTo(60, 6);
  });

  it('clamps zero / negative / fractional fleet counts to whole machines ≥ 1', () => {
    const t = manufacturingThroughput(cost({ refineTimeSeconds: 600, assembleTimeSeconds: 100 }), {
      refineryCount: 0,
      assemblerCount: -5,
    });
    expect(t.refineryCount).toBe(1);
    expect(t.assemblerCount).toBe(1);

    const frac = manufacturingThroughput(cost(), { refineryCount: 3.9 });
    expect(frac.refineryCount).toBe(3);
  });

  it('handles nothing-to-assemble without NaN or a divide-by-zero', () => {
    const t = manufacturingThroughput(
      cost({ assembleTimeSeconds: 0, components: {}, refineTimeSeconds: 500 }),
    );
    expect(t.balancedRatio).toBe(Infinity);
    expect(t.assembleStageSeconds).toBe(0);
    expect(t.wallClockSeconds).toBe(500);
    expect(t.bottleneck).toBe('refinery');
    expect(t.componentsPerHour).toBe(0);
    // With no components, suggesting assemblers falls back to a single machine.
    expect(t.suggestedAssemblers).toBe(1);
    expect(t.suggestedRefineries).toBe(1);
  });

  it('an empty build (no work at all) is balanced with zero wall clock', () => {
    const t = manufacturingThroughput(
      cost({ refineTimeSeconds: 0, assembleTimeSeconds: 0, ore: {}, components: {} }),
    );
    expect(t.wallClockSeconds).toBe(0);
    expect(t.bottleneck).toBe('balanced');
    expect(t.refineryUtilization).toBe(0);
    expect(t.assemblerUtilization).toBe(0);
    expect(t.orePerHour).toBe(0);
  });
});
