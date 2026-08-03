import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignStore, auditStore } from './design-store';
import { EXAMPLE_BLUEPRINT_XML } from '../../ui/lib/example-blueprint';

/** Read current store state without React. */
const state = () => useDesignStore.getState();

describe('design store', () => {
  beforeEach(() => {
    state().reset();
    state().setPlanet('earthlike');
    state().setCargoFill(0);
    state().setCargoDensity(2.0);
  });

  describe('importBlueprint', () => {
    it('parses a valid blueprint into a ready design', async () => {
      await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
      const s = state();
      expect(s.status).toBe('ready');
      expect(s.error).toBeNull();
      expect(s.design).not.toBeNull();
      expect(s.design?.name).toBe('Prospector Hauler');
      expect(s.report?.totalBlocks).toBeGreaterThan(0);
      expect(s.sourceName).toBe('example.sbc');
    });

    it('preserves the currently selected planet on import', async () => {
      state().setPlanet('mars');
      await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
      expect(state().design?.planetId).toBe('mars');
    });

    it('records the import to the audit trail as blueprint.import', async () => {
      const before = auditStore.size;
      await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
      expect(auditStore.size).toBe(before + 1);
      const last = auditStore.all().at(-1);
      expect(last?.action).toBe('blueprint.import');
      expect(last?.entityType).toBe('blueprint');
      expect(last?.metadata?.['sourceName']).toBe('example.sbc');
    });

    it('routes malformed XML to a friendly error state instead of throwing', async () => {
      await expect(
        state().importBlueprint('this is not xml at all <<<', 'bad.sbc'),
      ).resolves.toBeUndefined();
      const s = state();
      expect(s.status).toBe('error');
      expect(s.error).toBeTruthy();
      expect(s.design).toBeNull();
    });

    it('routes structurally-invalid XML to an error state', async () => {
      await state().importBlueprint('<Definitions><Nope/></Definitions>', 'bad.sbc');
      expect(state().status).toBe('error');
      expect(state().design).toBeNull();
    });
  });

  describe('planet & cargo updates', () => {
    it('setPlanet updates the id and the loaded design', async () => {
      await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
      state().setPlanet('space');
      expect(state().planetId).toBe('space');
      expect(state().design?.planetId).toBe('space');
    });

    it('setCargoFill clamps to 0..1', () => {
      state().setCargoFill(1.5);
      expect(state().cargo.fillFraction).toBe(1);
      state().setCargoFill(-0.2);
      expect(state().cargo.fillFraction).toBe(0);
    });

    it('setCargoDensity floors at 0 and flows into the design', async () => {
      await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
      state().setCargoDensity(-5);
      expect(state().cargo.densityKgPerL).toBe(0);
      state().setCargoDensity(2.7);
      expect(state().design?.cargo.densityKgPerL).toBe(2.7);
    });
  });

  describe('reset', () => {
    it('clears the design and returns to idle', async () => {
      await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
      state().reset();
      const s = state();
      expect(s.design).toBeNull();
      expect(s.report).toBeNull();
      expect(s.status).toBe('idle');
      expect(s.sourceName).toBeNull();
    });
  });
});
