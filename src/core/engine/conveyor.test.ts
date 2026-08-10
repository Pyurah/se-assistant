import { describe, it, expect } from 'vitest';
import { BLOCKS_BY_SUBTYPE } from '../../data/all-blocks';
import type { ShipDesign, DesignBlock } from '../types';
import { conveyorAudit, hasConveyorConcerns } from './conveyor';

/** Build a design block from a real dataset SubtypeId. */
function block(subtypeId: string, quantity: number): DesignBlock {
  const definition = BLOCKS_BY_SUBTYPE[subtypeId];
  if (!definition) throw new Error(`test setup: unknown subtypeId ${subtypeId}`);
  return { definition, quantity };
}

function ship(blocks: DesignBlock[], gridSize: 'small' | 'large' = 'large'): ShipDesign {
  return {
    id: 'c',
    name: 'Conveyor Rig',
    gridSize,
    blocks,
    planetId: 'earthlike',
    cargo: { fillFraction: 0, densityKgPerL: 2 },
  };
}

describe('conveyorAudit — large-port block detection', () => {
  it('flags a refinery + assembler as large-port blocks', () => {
    const audit = conveyorAudit(ship([block('LargeRefinery', 1), block('LargeAssembler', 2)]));
    expect(audit.largePortBlocks).toHaveLength(2);
    expect(audit.largePortBlockCount).toBe(3); // 1 refinery + 2 assemblers
    // Sorted by quantity desc: the 2 assemblers lead.
    expect(audit.largePortBlocks[0]?.subtypeId).toBe('LargeAssembler');
    expect(audit.largePortBlocks[0]?.reason).toBe('production');
  });

  it('tags each large-port block with its reason', () => {
    const audit = conveyorAudit(
      ship([block('Connector', 1), block('LargeBlockDrill', 1), block('OxygenGenerator', 1)]),
    );
    const byId = new Map(audit.largePortBlocks.map((b) => [b.subtypeId, b.reason]));
    expect(byId.get('Connector')).toBe('docking');
    expect(byId.get('LargeBlockDrill')).toBe('mining');
    expect(byId.get('OxygenGenerator')).toBe('gas');
  });

  it('does not flag ordinary blocks (armor, cockpit) as large-port', () => {
    const audit = conveyorAudit(ship([block('LargeBlockCockpit', 1)]));
    expect(audit.largePortBlocks).toHaveLength(0);
    expect(hasConveyorConcerns(audit)).toBe(false);
  });
});

describe('conveyorAudit — feedability', () => {
  it('marks a grid unfeedable when large-port blocks have no large conveyor line', () => {
    const audit = conveyorAudit(ship([block('LargeRefinery', 1)]));
    expect(audit.hasLargePortConveyors).toBe(false);
    expect(audit.unfeedable).toBe(true);
  });

  it('is feedable once a large conveyor piece is present', () => {
    const audit = conveyorAudit(ship([block('LargeRefinery', 1), block('ConveyorTube', 4)]));
    expect(audit.largePortConveyorCount).toBe(4);
    expect(audit.hasLargePortConveyors).toBe(true);
    expect(audit.unfeedable).toBe(false);
  });

  it('is never unfeedable when there are no large-port blocks at all', () => {
    const audit = conveyorAudit(ship([block('LargeBlockCockpit', 1)]));
    expect(audit.unfeedable).toBe(false);
  });

  it('counts small-grid large conveyor pieces (hub) as feeders', () => {
    const audit = conveyorAudit(
      ship([block('SmallBlockLargeContainer', 1), block('SmallShipConveyorHub', 2)], 'small'),
    );
    expect(audit.largePortConveyorCount).toBe(2);
    expect(audit.unfeedable).toBe(false);
  });
});

describe('conveyorAudit — honesty', () => {
  it('always carries the presence-not-connectivity caveat', () => {
    const audit = conveyorAudit(ship([block('LargeRefinery', 1)]));
    expect(audit.caveat).toMatch(/not a routed-connectivity solve/i);
  });
});
