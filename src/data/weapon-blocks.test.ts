import { describe, it, expect } from 'vitest';
import { WEAPON_BLOCKS } from './weapon-blocks';
import { GENERATED_BLOCKS } from './generated-blocks';
import { WEAPON_STATS } from './weapons';
import { BLOCKS_BY_SUBTYPE } from './all-blocks';

const GENERATED_BY_SUBTYPE = new Map(GENERATED_BLOCKS.map((b) => [b.subtypeId, b]));

describe('curated weapon blocks', () => {
  it('covers every weapon that has curated firing stats', () => {
    const blockSubtypes = new Set(WEAPON_BLOCKS.map((b) => b.subtypeId));
    for (const w of WEAPON_STATS) {
      expect(blockSubtypes.has(w.subtypeId), `no weapon block for ${w.subtypeId}`).toBe(true);
    }
    // 1:1 with the firing-stats set — no orphan blocks either.
    expect(WEAPON_BLOCKS.length).toBe(WEAPON_STATS.length);
  });

  it('are all vanilla-source weapon-category blocks', () => {
    for (const b of WEAPON_BLOCKS) {
      expect(b.source, b.subtypeId).toBe('vanilla');
      expect(b.category, b.subtypeId).toBe('weapon');
    }
  });

  it('have unique ids and subtype ids', () => {
    expect(new Set(WEAPON_BLOCKS.map((b) => b.id)).size).toBe(WEAPON_BLOCKS.length);
    expect(new Set(WEAPON_BLOCKS.map((b) => b.subtypeId)).size).toBe(WEAPON_BLOCKS.length);
  });

  // TRUSTWORTHINESS INVARIANT: because the curated entry wins the all-blocks
  // merge on a SubtypeId conflict, its mass/gridSize/dlc/cellCount MUST match the
  // generated catalogue exactly — otherwise an imported ship's mass would
  // silently change when we added the curated weapon.
  it('match the generated catalogue verbatim (mass, gridSize, dlc, cellCount)', () => {
    for (const b of WEAPON_BLOCKS) {
      const gen = GENERATED_BY_SUBTYPE.get(b.subtypeId);
      expect(gen, `generated block missing for ${b.subtypeId}`).toBeDefined();
      expect(b.mass, `${b.subtypeId} mass`).toBe(gen!.mass);
      expect(b.gridSize, `${b.subtypeId} gridSize`).toBe(gen!.gridSize);
      expect(b.dlc, `${b.subtypeId} dlc`).toBe(gen!.dlc);
      expect(b.cellCount, `${b.subtypeId} cellCount`).toBe(gen!.cellCount);
    }
  });

  it('win the merge so each resolves to the curated (vanilla) entry', () => {
    for (const b of WEAPON_BLOCKS) {
      const resolved = BLOCKS_BY_SUBTYPE[b.subtypeId];
      expect(resolved?.source, b.subtypeId).toBe('vanilla');
      expect(resolved?.category, b.subtypeId).toBe('weapon');
    }
  });
});
