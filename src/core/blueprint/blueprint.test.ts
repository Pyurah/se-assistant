import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseBlueprint, BlueprintParseError } from './parse';
import { resolveBlock } from './resolve-block';
import { thrustDirectionFromForward, parseAxis } from './orientation';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, '__fixtures__', name), 'utf8');

describe('orientation → thrust direction', () => {
  it('parses the six SE axis names case-insensitively', () => {
    expect(parseAxis('Up')).toBe('up');
    expect(parseAxis('  down ')).toBe('down');
    expect(parseAxis('BACKWARD')).toBe('backward');
    expect(parseAxis('nonsense')).toBeUndefined();
    expect(parseAxis(undefined)).toBeUndefined();
  });

  it('pushes the grid opposite to the exhaust (Forward)', () => {
    // Exhaust points down → ship is lifted up.
    expect(thrustDirectionFromForward('Down')).toBe('up');
    expect(thrustDirectionFromForward('Up')).toBe('down');
    // Exhaust points backward → ship accelerates forward.
    expect(thrustDirectionFromForward('Backward')).toBe('forward');
    expect(thrustDirectionFromForward('Left')).toBe('right');
  });

  it('returns undefined for an unparseable forward axis', () => {
    expect(thrustDirectionFromForward('sideways')).toBeUndefined();
    expect(thrustDirectionFromForward(undefined)).toBeUndefined();
  });
});

describe('block resolver', () => {
  it('matches a known vanilla subtype', () => {
    const r = resolveBlock('LargeBlockLargeHydrogenThrust', 'MyObjectBuilder_Thrust', 'large');
    expect(r.matched).toBe(true);
    expect(r.definition.category).toBe('thruster');
    expect(r.definition.source).toBe('vanilla');
  });

  it('falls back to a blueprint-source placeholder for a modded subtype', () => {
    const r = resolveBlock('ModdedGiantThruster9000', 'MyObjectBuilder_Thrust', 'large');
    expect(r.matched).toBe(false);
    expect(r.definition.source).toBe('blueprint');
    // Never fabricate a stat-bearing category; unknown blocks are 'other'.
    expect(r.definition.category).toBe('other');
    expect(r.definition.mass).toBe(0);
    expect(r.definition.displayName).toContain('unrecognized');
  });

  it('handles an empty subtype by labelling from the xsi:type', () => {
    const r = resolveBlock('', 'MyObjectBuilder_Reactor', 'large');
    expect(r.matched).toBe(false);
    expect(r.definition.displayName).toContain('Reactor');
  });
});

describe('parseBlueprint', () => {
  const { design, report } = parseBlueprint(fixture('test-hauler.sbc'));

  it('reads the grid size and display name', () => {
    expect(design.gridSize).toBe('large');
    expect(design.name).toBe('Test Hauler');
  });

  it('counts every placed block and reports match rate', () => {
    expect(report.totalBlocks).toBe(6);
    expect(report.gridCount).toBe(1);
    // 5 vanilla + 1 modded.
    expect(report.matchedBlocks).toBe(5);
    expect(report.unrecognizedSubtypes).toEqual(['ModdedGiantThruster9000']);
  });

  it('aggregates identical blocks+direction into a quantity', () => {
    const liftThrusters = design.blocks.find(
      (b) => b.definition.subtypeId === 'LargeBlockLargeHydrogenThrust',
    );
    expect(liftThrusters?.quantity).toBe(2);
    expect(liftThrusters?.thrustDirection).toBe('up');
  });

  it('resolves distinct thrust directions from orientation', () => {
    const directions = design.blocks
      .filter((b) => b.definition.category === 'thruster' && b.definition.source === 'vanilla')
      .map((b) => b.thrustDirection);
    expect(directions).toContain('up'); // Forward=Down
    expect(directions).toContain('forward'); // Forward=Backward
  });

  it('keeps the modded block as a blueprint-source placeholder', () => {
    const modded = design.blocks.find((b) => b.definition.source === 'blueprint');
    expect(modded).toBeDefined();
    expect(modded!.definition.category).toBe('other');
  });

  it('resolves the reactor and cargo container to vanilla defs', () => {
    const reactor = design.blocks.find((b) => b.definition.category === 'reactor');
    const cargo = design.blocks.find((b) => b.definition.category === 'cargo');
    expect(reactor?.definition.source).toBe('vanilla');
    expect(cargo?.definition.source).toBe('vanilla');
  });
});

describe('parseBlueprint — multi-grid & errors', () => {
  it('merges blocks across subgrids and flags mixed grid sizes', () => {
    const xml = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints><ShipBlueprint>
    <CubeGrids>
      <CubeGrid>
        <GridSizeEnum>Large</GridSizeEnum>
        <DisplayName>Rig</DisplayName>
        <CubeBlocks>
          <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Reactor">
            <SubtypeName>LargeBlockLargeGenerator</SubtypeName>
          </MyObjectBuilder_CubeBlock>
        </CubeBlocks>
      </CubeGrid>
      <CubeGrid>
        <GridSizeEnum>Small</GridSizeEnum>
        <CubeBlocks>
          <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
            <SubtypeName>SmallBlockSmallThrust</SubtypeName>
            <BlockOrientation Forward="Down" Up="Forward" />
          </MyObjectBuilder_CubeBlock>
        </CubeBlocks>
      </CubeGrid>
    </CubeGrids>
  </ShipBlueprint></ShipBlueprints>
</Definitions>`;
    const { design, report } = parseBlueprint(xml);
    expect(report.gridCount).toBe(2);
    expect(report.totalBlocks).toBe(2);
    expect(report.mixedGridSizes).toBe(true);
    expect(design.gridSize).toBe('large'); // primary grid
    expect(design.blocks).toHaveLength(2);
  });

  it('throws BlueprintParseError on malformed XML', () => {
    expect(() => parseBlueprint('<not valid <<< xml')).toThrow(BlueprintParseError);
  });

  it('throws BlueprintParseError on XML that is not a ship blueprint', () => {
    expect(() => parseBlueprint('<?xml version="1.0"?><Something><Else/></Something>')).toThrow(
      BlueprintParseError,
    );
  });

  it('defaults a MISSING orientation to identity (Forward), not unoriented', () => {
    // SE omits <BlockOrientation> at the default identity orientation
    // (Forward="Forward"). A missing element means Forward — the thruster
    // exhausts forward and so pushes the grid backward — and must NOT be
    // dropped from directional TWR.
    const xml = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints><ShipBlueprint><CubeGrids><CubeGrid>
    <GridSizeEnum>Large</GridSizeEnum>
    <CubeBlocks>
      <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
        <SubtypeName>LargeBlockLargeThrust</SubtypeName>
      </MyObjectBuilder_CubeBlock>
    </CubeBlocks>
  </CubeGrid></CubeGrids></ShipBlueprint></ShipBlueprints>
</Definitions>`;
    const { design, report } = parseBlueprint(xml);
    expect(report.unorientedThrusters).toBe(0);
    const thruster = design.blocks.find((b) => b.definition.category === 'thruster');
    expect(thruster?.thrustDirection).toBe('backward');
  });

  it('counts a thruster with a PRESENT but unparseable orientation as unoriented', () => {
    const xml = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints><ShipBlueprint><CubeGrids><CubeGrid>
    <GridSizeEnum>Large</GridSizeEnum>
    <CubeBlocks>
      <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
        <SubtypeName>LargeBlockLargeThrust</SubtypeName>
        <BlockOrientation Forward="sideways" Up="Up" />
      </MyObjectBuilder_CubeBlock>
    </CubeBlocks>
  </CubeGrid></CubeGrids></ShipBlueprint></ShipBlueprints>
</Definitions>`;
    const { report } = parseBlueprint(xml);
    expect(report.unorientedThrusters).toBe(1);
  });
});
