import { describe, it, expect } from 'vitest';
import { BLOCKS_BY_SUBTYPE } from './all-blocks';
import {
  LARGE_PORT_BLOCKS,
  LARGE_PORT_CONVEYORS,
  requiresLargePort,
  largePortReason,
  isLargePortConveyor,
} from './conveyor-ports';

describe('conveyor-ports dataset integrity', () => {
  it('every large-port block SubtypeId resolves to a real block in the catalogue', () => {
    for (const subtypeId of LARGE_PORT_BLOCKS.keys()) {
      expect(BLOCKS_BY_SUBTYPE[subtypeId], `missing block: ${subtypeId}`).toBeDefined();
    }
  });

  it('every large-port conveyor SubtypeId resolves to a real block in the catalogue', () => {
    for (const subtypeId of LARGE_PORT_CONVEYORS) {
      expect(BLOCKS_BY_SUBTYPE[subtypeId], `missing conveyor: ${subtypeId}`).toBeDefined();
    }
  });

  it('a block is never both a large-port block and a large-port conveyor', () => {
    for (const subtypeId of LARGE_PORT_BLOCKS.keys()) {
      expect(LARGE_PORT_CONVEYORS.has(subtypeId)).toBe(false);
    }
  });

  it('helpers agree with the underlying tables', () => {
    expect(requiresLargePort('LargeRefinery')).toBe(true);
    expect(requiresLargePort('LargeBlockCockpit')).toBe(false);
    expect(largePortReason('LargeAssembler')).toBe('production');
    expect(largePortReason('LargeBlockCockpit')).toBeUndefined();
    expect(isLargePortConveyor('ConveyorTube')).toBe(true);
    expect(isLargePortConveyor('LargeRefinery')).toBe(false);
  });
});
