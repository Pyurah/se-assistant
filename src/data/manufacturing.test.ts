import { describe, it, expect } from 'vitest';
import {
  REFINERY_PRESETS,
  ASSEMBLER_PRESETS,
  REFINERY_MODULE_SLOTS,
  ASSEMBLER_MODULE_SLOTS,
  YIELD_MODULE_EFFECTIVENESS,
  speedModuleMultiplier,
  applyRefineryModules,
  applyAssemblerModules,
} from './manufacturing';

const refinery = REFINERY_PRESETS.find((r) => r.id === 'refinery')!;
const basicRefinery = REFINERY_PRESETS.find((r) => r.id === 'basic-refinery')!;
const assembler = ASSEMBLER_PRESETS.find((a) => a.id === 'assembler')!;
const basicAssembler = ASSEMBLER_PRESETS.find((a) => a.id === 'basic-assembler')!;

describe('module curves', () => {
  it('YIELD_MODULE_EFFECTIVENESS matches the verified 0–4 curve', () => {
    // 100% / 119% / 141% / 168% / 200% effectiveness (wiki.gg, Yield Module).
    expect(YIELD_MODULE_EFFECTIVENESS).toEqual([1.0, 1.19, 1.41, 1.68, 2.0]);
    expect(YIELD_MODULE_EFFECTIVENESS).toHaveLength(REFINERY_MODULE_SLOTS + 1);
  });

  it('speedModuleMultiplier is 1 + count (2×…5×), zero-floored', () => {
    expect(speedModuleMultiplier(0)).toBe(1);
    expect(speedModuleMultiplier(1)).toBe(2);
    expect(speedModuleMultiplier(4)).toBe(5);
    expect(speedModuleMultiplier(8)).toBe(9);
    // Negative / fractional inputs clamp sensibly.
    expect(speedModuleMultiplier(-3)).toBe(1);
    expect(speedModuleMultiplier(2.9)).toBe(3);
  });

  it('exposes the game-verified port counts', () => {
    expect(REFINERY_MODULE_SLOTS).toBe(4);
    expect(ASSEMBLER_MODULE_SLOTS).toBe(8);
  });
});

describe('applyRefineryModules', () => {
  it('multiplies material efficiency by the yield curve, leaving speed alone', () => {
    // 2 yield → 0.8 × 1.41 = 1.128; refineSpeed unchanged at 1.3.
    const upgraded = applyRefineryModules(refinery, { yield: 2, speed: 0 });
    expect(upgraded.materialEfficiency).toBeCloseTo(0.8 * 1.41, 10);
    expect(upgraded.refineSpeed).toBeCloseTo(1.3, 10);
  });

  it('doubles yield with 4 yield modules (0.8 → 1.6)', () => {
    const upgraded = applyRefineryModules(refinery, { yield: 4, speed: 0 });
    expect(upgraded.materialEfficiency).toBeCloseTo(1.6, 10);
  });

  it('multiplies refine speed by the speed curve, leaving yield alone', () => {
    // 2 speed → 1.3 × 3 = 3.9; materialEfficiency unchanged at 0.8.
    const upgraded = applyRefineryModules(refinery, { yield: 0, speed: 2 });
    expect(upgraded.refineSpeed).toBeCloseTo(3.9, 10);
    expect(upgraded.materialEfficiency).toBeCloseTo(0.8, 10);
  });

  it('applies yield and speed together', () => {
    const upgraded = applyRefineryModules(refinery, { yield: 1, speed: 3 });
    expect(upgraded.materialEfficiency).toBeCloseTo(0.8 * 1.19, 10);
    expect(upgraded.refineSpeed).toBeCloseTo(1.3 * 4, 10);
  });

  it('clamps each module count to the refinery slot maximum', () => {
    // yield 9 clamps to 4 (2.0×); speed 9 clamps to 4 (5×).
    const upgraded = applyRefineryModules(refinery, { yield: 9, speed: 9 });
    expect(upgraded.materialEfficiency).toBeCloseTo(1.6, 10);
    expect(upgraded.refineSpeed).toBeCloseTo(1.3 * 5, 10);
  });

  it('returns a Basic refinery unchanged (no module ports)', () => {
    const upgraded = applyRefineryModules(basicRefinery, { yield: 4, speed: 4 });
    expect(upgraded).toEqual(basicRefinery);
  });
});

describe('applyAssemblerModules', () => {
  it('multiplies assembly speed by the speed curve', () => {
    // 3 speed → 1.0 × 4 = 4.0.
    const upgraded = applyAssemblerModules(assembler, { speed: 3 });
    expect(upgraded.assemblySpeed).toBeCloseTo(4.0, 10);
  });

  it('clamps speed to the assembler slot maximum (8)', () => {
    const upgraded = applyAssemblerModules(assembler, { speed: 99 });
    expect(upgraded.assemblySpeed).toBeCloseTo(1.0 * 9, 10);
  });

  it('returns a Basic assembler unchanged (no module ports)', () => {
    const upgraded = applyAssemblerModules(basicAssembler, { speed: 8 });
    expect(upgraded).toEqual(basicAssembler);
  });
});
