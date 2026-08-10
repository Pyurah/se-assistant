/**
 * Unit tests for the pure cost emitter — determinism, key sorting, and
 * exactOptionalPropertyTypes-safety (no `undefined` tokens in output).
 */

import { describe, expect, it } from 'vitest';
import { emitCostModule, type GeneratedCost } from './emit';

const THRUSTER: GeneratedCost = {
  subtypeId: 'SmallBlockSmallAtmosphericThrust',
  cost: { motor: 18, construction: 22, 'steel-plate': 3, 'large-tube': 1, 'metal-grid': 1 },
};

const ARMOR: GeneratedCost = {
  subtypeId: 'SmallHeavyBlockArmorBlock',
  cost: { 'steel-plate': 150, 'metal-grid': 50 },
};

describe('emitCostModule', () => {
  it('produces a DO-NOT-EDIT banner, the import, and the export', () => {
    const out = emitCostModule([THRUSTER], 'v1.210.012 b0');
    expect(out).toContain('GENERATED FILE — DO NOT EDIT BY HAND');
    expect(out).toContain("import type { BlockComponentCost } from './manufacturing';");
    expect(out).toContain(
      'export const GENERATED_BLOCK_COSTS: Readonly<Record<string, BlockComponentCost>> = {',
    );
    expect(out).toContain('v1.210.012 b0');
  });

  it('never emits a literal `undefined`', () => {
    const out = emitCostModule([ARMOR, THRUSTER], 'build');
    expect(out).not.toMatch(/\bundefined\b/);
  });

  it('is deterministic and sorted by block subtypeId', () => {
    const a = emitCostModule([THRUSTER, ARMOR], 'build');
    const b = emitCostModule([ARMOR, THRUSTER], 'build');
    expect(a).toBe(b);
    // "SmallB" < "SmallH", so the thruster block entry comes first.
    expect(a.indexOf('SmallBlockSmallAtmosphericThrust')).toBeLessThan(
      a.indexOf('SmallHeavyBlockArmorBlock'),
    );
  });

  it('sorts component keys within a cost for stable diffs', () => {
    const out = emitCostModule([THRUSTER], 'build');
    // construction < large-tube < metal-grid < motor < steel-plate (alpha order).
    const entry = out.slice(out.indexOf('SmallBlockSmallAtmosphericThrust'));
    expect(entry.indexOf('construction')).toBeLessThan(entry.indexOf('large-tube'));
    expect(entry.indexOf('large-tube')).toBeLessThan(entry.indexOf('metal-grid'));
    expect(entry.indexOf('metal-grid')).toBeLessThan(entry.indexOf('motor'));
    expect(entry.indexOf('motor')).toBeLessThan(entry.indexOf('steel-plate'));
  });

  it('keys entries by the game SubtypeId and preserves counts', () => {
    const out = emitCostModule([ARMOR], 'build');
    expect(out).toContain('"SmallHeavyBlockArmorBlock":');
    expect(out).toContain('"steel-plate":150');
    expect(out).toContain('"metal-grid":50');
  });
});
