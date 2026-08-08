import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useDesignStore } from '../../app/store/design-store';
import { EXAMPLE_BLUEPRINT_XML } from '../lib/example-blueprint';
import { BuildCostPanel } from './BuildCostPanel';

/**
 * A ship with one recognized block (steel-plate armor) and one modded block the
 * dataset has no recipe for — exercises both the ore readout and the
 * "cost unknown" diagnostics branch deterministically.
 */
const MIXED_BLUEPRINT = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints>
    <ShipBlueprint xsi:type="MyObjectBuilder_ShipBlueprintDefinition">
      <DisplayName>Mixed Rig</DisplayName>
      <CubeGrids>
        <CubeGrid>
          <SubtypeName />
          <DisplayName>Mixed Rig</DisplayName>
          <GridSizeEnum>Large</GridSizeEnum>
          <CubeBlocks>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_CubeBlock">
              <SubtypeName>LargeBlockArmorBlock</SubtypeName>
              <Min x="0" y="0" z="0" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
              <SubtypeName>SomeExoticModdedThruster</SubtypeName>
              <Min x="1" y="0" z="0" />
              <BlockOrientation Forward="Down" Up="Forward" />
            </MyObjectBuilder_CubeBlock>
          </CubeBlocks>
        </CubeGrid>
      </CubeGrids>
    </ShipBlueprint>
  </ShipBlueprints>
</Definitions>`;

const state = () => useDesignStore.getState();

/** A ship whose only block is a modded subtype — no known recipe at all. */
const ALL_MODDED_BLUEPRINT = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints>
    <ShipBlueprint xsi:type="MyObjectBuilder_ShipBlueprintDefinition">
      <DisplayName>Modded Rig</DisplayName>
      <CubeGrids>
        <CubeGrid>
          <SubtypeName />
          <DisplayName>Modded Rig</DisplayName>
          <GridSizeEnum>Large</GridSizeEnum>
          <CubeBlocks>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_CubeBlock">
              <SubtypeName>TotallyModdedBlock</SubtypeName>
              <Min x="0" y="0" z="0" />
            </MyObjectBuilder_CubeBlock>
          </CubeBlocks>
        </CubeGrid>
      </CubeGrids>
    </ShipBlueprint>
  </ShipBlueprints>
</Definitions>`;

describe('BuildCostPanel rendering', () => {
  beforeEach(() => {
    state().reset();
  });

  it('renders headline ore / ingot / refine-time stats for a real ship', async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    render(<BuildCostPanel />);
    expect(screen.getByText(/raw ore/i)).toBeInTheDocument();
    expect(screen.getByText(/ingots/i)).toBeInTheDocument();
    expect(screen.getByText(/refine time/i)).toBeInTheDocument();
  });

  it('lists modded blocks as cost-unknown instead of silently costing them', async () => {
    await state().importBlueprint(MIXED_BLUEPRINT, 'mixed.sbc');
    render(<BuildCostPanel />);
    // 1 of 2 block types is recognized (armor); the modded thruster is flagged.
    expect(screen.getByText(/cost known for 1 of 2 block types/i)).toBeInTheDocument();
  });

  it('changing the refinery preset recomputes the ore total', async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    render(<BuildCostPanel />);

    const oreStat = screen.getByText(/raw ore/i).parentElement!;
    const before = within(oreStat).getByText(/kg|t|kt/).textContent;

    // Basic Refinery has lower material efficiency → more ore for the same ship.
    fireEvent.click(screen.getByRole('radio', { name: /basic refinery/i }));
    const after = within(oreStat).getByText(/kg|t|kt/).textContent;

    expect(after).not.toBe(before);
  });

  it('renders nothing when no design is loaded', () => {
    const { container } = render(<BuildCostPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the throughput headline (build time + bottleneck) for a real ship', async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    render(<BuildCostPanel />);
    expect(screen.getByText(/build time/i)).toBeInTheDocument();
    expect(screen.getByText(/bottleneck/i)).toBeInTheDocument();
    // Refining dominates a real ship at 1 refinery / 1 assembler.
    expect(screen.getByText(/refinery-bound/i)).toBeInTheDocument();
  });

  it('adding refineries lowers the build time', async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    render(<BuildCostPanel />);

    const buildTimeStat = screen.getByText(/build time/i).parentElement!;
    const before = within(buildTimeStat).getByText(/\d+.*(s|min|h)/).textContent;

    // Bump refineries several times — the refine stage (the bottleneck) shrinks.
    const inc = screen.getByRole('button', { name: /increase refinery count/i });
    for (let i = 0; i < 5; i += 1) fireEvent.click(inc);
    const after = within(buildTimeStat).getByText(/\d+.*(s|min|h)/).textContent;

    expect(after).not.toBe(before);
  });

  it('omits the throughput section when every block is unknown', async () => {
    await state().importBlueprint(ALL_MODDED_BLUEPRINT, 'modded.sbc');
    render(<BuildCostPanel />);
    // The panel still renders (unknown-blocks warning) but has no throughput readout.
    expect(screen.queryByText(/build time/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /increase refinery count/i })).not.toBeInTheDocument();
  });
});
