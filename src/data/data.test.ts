import { describe, it, expect } from 'vitest';
import {
  VANILLA_BLOCKS,
  VANILLA_BLOCKS_BY_ID,
  VANILLA_BLOCKS_BY_SUBTYPE,
  PLANET_PRESETS,
  PLANET_PRESETS_BY_ID,
  STANDARD_GRAVITY,
  DLCS,
  DLCS_BY_ID,
  CARGO_ITEMS,
  CARGO_ITEMS_BY_ID,
  itemDensity,
} from './index';

/**
 * Data-integrity guards. These protect the dataset's invariants as it grows
 * to full vanilla coverage in Phase 1 / M1 — catching duplicate ids, negative
 * masses, and malformed thruster envelopes at test time rather than in the UI.
 */

describe('vanilla blocks dataset', () => {
  it('has unique block ids', () => {
    const ids = VANILLA_BLOCKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique subtype ids', () => {
    const subtypes = VANILLA_BLOCKS.map((b) => b.subtypeId);
    expect(new Set(subtypes).size).toBe(subtypes.length);
  });

  it('exposes consistent id and subtype lookup maps', () => {
    for (const block of VANILLA_BLOCKS) {
      expect(VANILLA_BLOCKS_BY_ID[block.id]).toBe(block);
      expect(VANILLA_BLOCKS_BY_SUBTYPE[block.subtypeId]).toBe(block);
    }
  });

  it('has positive mass and non-negative power for every block', () => {
    for (const block of VANILLA_BLOCKS) {
      expect(block.mass, `${block.id} mass`).toBeGreaterThan(0);
      if ('maxPowerDraw' in block) {
        expect(block.maxPowerDraw, `${block.id} draw`).toBeGreaterThanOrEqual(0);
      }
      if ('maxPowerOutput' in block) {
        expect(block.maxPowerOutput, `${block.id} output`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('gives thrusters positive thrust and type-correct effectiveness envelopes', () => {
    const thrusters = VANILLA_BLOCKS.filter((b) => b.category === 'thruster');
    expect(thrusters.length).toBe(14); // 12 base (3 types x 2 grids x 2 sizes) + 2 DLC atmo variants
    for (const t of thrusters) {
      if (t.category !== 'thruster') continue;
      expect(t.maxThrust, `${t.id} thrust`).toBeGreaterThan(0);

      if (t.thrusterType === 'hydrogen') {
        // Hydrogen: no electric draw, burns fuel, flat everywhere (no envelope).
        expect(t.maxPowerDraw, `${t.id} draw`).toBe(0);
        expect(t.maxHydrogenConsumption, `${t.id} fuel`).toBeGreaterThan(0);
      } else {
        // Electric thrusters: draw power, no fuel, well-formed envelope.
        expect(t.maxPowerDraw, `${t.id} draw`).toBeGreaterThan(0);
        expect(t.maxHydrogenConsumption, `${t.id} fuel`).toBeUndefined();
        expect(t.minPlanetaryInfluence).toBeLessThanOrEqual(t.maxPlanetaryInfluence!);
      }

      if (t.thrusterType === 'ion') {
        // Best in vacuum: effectiveness falls as air density rises.
        expect(t.effectivenessAtMinInfluence!).toBeGreaterThan(t.effectivenessAtMaxInfluence!);
      }
      if (t.thrusterType === 'atmospheric') {
        // Needs air: effectiveness rises with air density.
        expect(t.effectivenessAtMinInfluence!).toBeLessThan(t.effectivenessAtMaxInfluence!);
      }
    }
  });

  it('provides full vanilla coverage across every category', () => {
    const count = (c: string) => VANILLA_BLOCKS.filter((b) => b.category === c).length;
    expect(count('thruster')).toBe(14); // +2: Sci-Fi (Sparks) & Flat D-Shape atmospheric
    expect(count('cargo')).toBe(6); // +1: Modular Cargo Container (Contact reskin)
    expect(count('reactor')).toBe(4);
    expect(count('battery')).toBe(5); // small, small-small, large + 2 Warfare 2 reskins
    expect(count('solar')).toBe(2);
    expect(count('hydrogen-engine')).toBe(2);
    expect(count('wind-turbine')).toBe(1);
    expect(count('cockpit')).toBe(2);
  });

  it('recognizes the DLC-reskin & armor subtypes that real imported ships use', () => {
    // Regression guard: these subtypes appear in real DLC-built blueprints and
    // were previously dropped as "unrecognized", corrupting mass/TWR. Each must
    // resolve to a vanilla-source definition. Stats verified against the game's
    // own definition files (see docs/data-audit.md).
    const expected: Record<string, { category: string; mass: number }> = {
      SmallBlockLargeFlatAtmosphericThrustDShape: { category: 'thruster', mass: 1060 },
      SmallBlockSmallAtmosphericThrustSciFi: { category: 'thruster', mass: 699 },
      SmallBlockModularContainer: { category: 'cargo', mass: 463 },
      SmallShipWelderReskin: { category: 'welder', mass: 448.4 },
      SmallShipConveyorHub: { category: 'conveyor', mass: 313 },
      ConveyorTubeCurvedMedium: { category: 'conveyor', mass: 365 },
      SmallBlockArmorBlock: { category: 'structural', mass: 20 },
      SmallBlockArmorSlope: { category: 'structural', mass: 20 },
    };
    for (const [subtype, want] of Object.entries(expected)) {
      const block = VANILLA_BLOCKS_BY_SUBTYPE[subtype];
      expect(block, `${subtype} must exist`).toBeDefined();
      expect(block!.source, `${subtype} source`).toBe('vanilla');
      expect(block!.category, `${subtype} category`).toBe(want.category);
      expect(block!.mass, `${subtype} mass`).toBeCloseTo(want.mass, 1);
    }
  });

  it('gives every cargo/cockpit block a positive inventory volume', () => {
    const holders = VANILLA_BLOCKS.filter(
      (b) => b.category === 'cargo' || b.category === 'cockpit',
    );
    for (const b of holders) {
      if (b.category !== 'cargo' && b.category !== 'cockpit') continue;
      expect(b.inventoryVolume, `${b.id} volume`).toBeGreaterThan(0);
    }
  });

  it('gives batteries consistent I/O rates and stored capacity', () => {
    const batteries = VANILLA_BLOCKS.filter((b) => b.category === 'battery');
    expect(batteries.length).toBeGreaterThan(0);
    for (const b of batteries) {
      if (b.category !== 'battery') continue;
      expect(b.maxPowerOutput, `${b.id} output`).toBeGreaterThan(0);
      expect(b.maxPowerInput, `${b.id} input`).toBeGreaterThan(0);
      expect(b.energyCapacity, `${b.id} capacity`).toBeGreaterThan(0);
    }
  });

  it('gives gyroscopes positive torque and defined power draw', () => {
    const gyros = VANILLA_BLOCKS.filter((b) => b.category === 'gyroscope');
    expect(gyros.length).toBe(2); // small + large grid
    for (const g of gyros) {
      if (g.category !== 'gyroscope') continue;
      expect(g.maxTorque, `${g.id} torque`).toBeGreaterThan(0);
      expect(g.powerDraw, `${g.id} draw`).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives utility/functional blocks a non-negative max power draw', () => {
    const utilityCats = new Set([
      'drill',
      'welder',
      'grinder',
      'connector',
      'conveyor',
      'light',
      'beacon',
      'antenna',
      'sensor',
      'control',
      'logic',
      'gas',
      'utility',
    ]);
    const utility = VANILLA_BLOCKS.filter((b) => utilityCats.has(b.category));
    expect(utility.length).toBeGreaterThan(0);
    for (const b of utility) {
      expect('maxPowerDraw' in b, `${b.id} has maxPowerDraw`).toBe(true);
      if ('maxPowerDraw' in b) {
        expect(b.maxPowerDraw, `${b.id} draw`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('gives hydrogen tanks a positive gas capacity and thrusters/engines fuel rates', () => {
    const tanks = VANILLA_BLOCKS.filter(
      (b) => b.category === 'gas' && 'gasCapacity' in b && typeof b.gasCapacity === 'number',
    );
    expect(tanks.length).toBeGreaterThanOrEqual(4); // 4 hydrogen tank variants
    for (const t of tanks) {
      if ('gasCapacity' in t && typeof t.gasCapacity === 'number') {
        expect(t.gasCapacity, `${t.id} capacity`).toBeGreaterThan(0);
      }
    }
    // Every hydrogen thruster carries a positive fuel-consumption rate.
    const h2Thrusters = VANILLA_BLOCKS.filter(
      (b) => b.category === 'thruster' && b.thrusterType === 'hydrogen',
    );
    expect(h2Thrusters.length).toBe(4);
    for (const t of h2Thrusters) {
      if (t.category === 'thruster') {
        expect(t.maxHydrogenConsumption, `${t.id} fuel`).toBeGreaterThan(0);
      }
    }
    // Hydrogen engines carry a consumption rate too.
    const engines = VANILLA_BLOCKS.filter((b) => b.category === 'hydrogen-engine');
    for (const e of engines) {
      if (e.category === 'hydrogen-engine') {
        expect(e.maxHydrogenConsumption, `${e.id} fuel`).toBeGreaterThan(0);
      }
    }
  });

  it('tags every block with a DLC that exists in the catalogue', () => {
    for (const block of VANILLA_BLOCKS) {
      expect(block.dlc, `${block.id} dlc`).toBeDefined();
      expect(DLCS_BY_ID[block.dlc], `${block.id} dlc "${block.dlc}" not in catalogue`).toBeDefined();
    }
  });
});

describe('DLC catalogue', () => {
  it('has unique dlc ids', () => {
    const ids = DLCS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes the DLC-free base game and the current newest DLC', () => {
    expect(DLCS_BY_ID['base']).toBeDefined();
    expect(DLCS_BY_ID['base']!.addsFunctionalBlocks).toBe(true);
    expect(DLCS_BY_ID['prosperity']).toBeDefined();
  });

  it('includes the Sparks / Contact / Apex packs used by real DLC ships', () => {
    for (const id of ['sparks-of-the-future', 'contact', 'apex-survival', 'scrap-race']) {
      expect(DLCS_BY_ID[id], `${id} must be catalogued`).toBeDefined();
    }
  });

  it('exposes a consistent lookup map', () => {
    for (const dlc of DLCS) {
      expect(DLCS_BY_ID[dlc.id]).toBe(dlc);
    }
  });
});

describe('planet presets', () => {
  it('has unique planet ids', () => {
    const ids = PLANET_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes a zero-g space preset with no atmosphere', () => {
    const space = PLANET_PRESETS_BY_ID['space'];
    expect(space).toBeDefined();
    expect(space!.surfaceGravity).toBe(0);
    expect(space!.hasAtmosphere).toBe(false);
    expect(space!.atmosphereDensity).toBe(0);
  });

  it('keeps atmosphere flags consistent with density', () => {
    for (const p of PLANET_PRESETS) {
      if (!p.hasAtmosphere) {
        expect(p.atmosphereDensity, `${p.id} density`).toBe(0);
      } else {
        expect(p.atmosphereDensity, `${p.id} density`).toBeGreaterThan(0);
      }
      expect(p.surfaceGravity, `${p.id} gravity`).toBeGreaterThanOrEqual(0);
    }
  });

  it('models Earthlike at standard gravity (1.0 g)', () => {
    expect(PLANET_PRESETS_BY_ID['earthlike']!.surfaceGravity).toBeCloseTo(STANDARD_GRAVITY, 2);
  });

  it('models Pertam as a high-g world (1.20 g), guarding the M1 correction', () => {
    // Regression guard: the seed wrongly had Pertam at 1.0 g; verified 1.20 g.
    expect(PLANET_PRESETS_BY_ID['pertam']!.surfaceGravity).toBeCloseTo(11.77, 2);
  });
});

describe('cargo items dataset', () => {
  it('has unique item ids', () => {
    const ids = CARGO_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exposes a consistent id lookup map', () => {
    expect(Object.keys(CARGO_ITEMS_BY_ID).length).toBe(CARGO_ITEMS.length);
    for (const item of CARGO_ITEMS) {
      expect(CARGO_ITEMS_BY_ID[item.id]).toBe(item);
    }
  });

  it('has positive mass and volume for every item', () => {
    for (const item of CARGO_ITEMS) {
      expect(item.mass, `${item.id} mass`).toBeGreaterThan(0);
      expect(item.volume, `${item.id} volume`).toBeGreaterThan(0);
    }
  });

  it('derives density as mass / volume', () => {
    for (const item of CARGO_ITEMS) {
      expect(itemDensity(item)).toBeCloseTo(item.mass / item.volume, 6);
    }
  });

  it('guards known-good densities from the game files (v1.210.012 b0)', () => {
    // Verbatim from Components.sbc / PhysicalItems.sbc; the load-bearing values
    // the cargo UI derives density from. See docs/data-audit.md.
    expect(itemDensity(CARGO_ITEMS_BY_ID['comp-steel-plate']!)).toBeCloseTo(6.6667, 3); // 20 / 3
    expect(itemDensity(CARGO_ITEMS_BY_ID['ore-iron']!)).toBeCloseTo(2.7027, 3); // 1 / 0.37
    expect(itemDensity(CARGO_ITEMS_BY_ID['ingot-gold']!)).toBeCloseTo(19.2308, 3); // 1 / 0.052
    expect(itemDensity(CARGO_ITEMS_BY_ID['ingot-uranium']!)).toBeCloseTo(19.2308, 3); // 1 / 0.052
    expect(itemDensity(CARGO_ITEMS_BY_ID['comp-computer']!)).toBeCloseTo(0.2, 3); // 0.2 / 1
  });

  it('keeps all raw ores at the uniform ore density (except scrap)', () => {
    for (const item of CARGO_ITEMS.filter((i) => i.category === 'ore' && i.id !== 'ore-scrap')) {
      expect(itemDensity(item), `${item.id}`).toBeCloseTo(2.7027, 3);
    }
  });
});
