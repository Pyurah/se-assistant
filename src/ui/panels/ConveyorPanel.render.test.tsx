import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDesignStore } from '../../app/store/design-store';
import { EXAMPLE_BLUEPRINT_XML } from '../lib/example-blueprint';
import { ConveyorPanel } from './ConveyorPanel';

const state = () => useDesignStore.getState();

/** A ship with a large-port block AND a large conveyor line — the feedable case. */
const FEEDABLE_BLUEPRINT = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints>
    <ShipBlueprint xsi:type="MyObjectBuilder_ShipBlueprintDefinition">
      <DisplayName>Feedable Rig</DisplayName>
      <CubeGrids>
        <CubeGrid>
          <SubtypeName />
          <DisplayName>Feedable Rig</DisplayName>
          <GridSizeEnum>Large</GridSizeEnum>
          <CubeBlocks>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Refinery">
              <SubtypeName>LargeRefinery</SubtypeName>
              <Min x="0" y="0" z="0" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Conveyor">
              <SubtypeName>ConveyorTube</SubtypeName>
              <Min x="1" y="0" z="0" />
            </MyObjectBuilder_CubeBlock>
          </CubeBlocks>
        </CubeGrid>
      </CubeGrids>
    </ShipBlueprint>
  </ShipBlueprints>
</Definitions>`;

/** A ship whose only blocks are armor + cockpit — nothing needs a large port. */
const NO_LARGEPORT_BLUEPRINT = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints>
    <ShipBlueprint xsi:type="MyObjectBuilder_ShipBlueprintDefinition">
      <DisplayName>Plain Rig</DisplayName>
      <CubeGrids>
        <CubeGrid>
          <SubtypeName />
          <DisplayName>Plain Rig</DisplayName>
          <GridSizeEnum>Large</GridSizeEnum>
          <CubeBlocks>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Cockpit">
              <SubtypeName>LargeBlockCockpit</SubtypeName>
              <Min x="0" y="0" z="0" />
            </MyObjectBuilder_CubeBlock>
          </CubeBlocks>
        </CubeGrid>
      </CubeGrids>
    </ShipBlueprint>
  </ShipBlueprints>
</Definitions>`;

describe('ConveyorPanel rendering', () => {
  beforeEach(() => {
    state().reset();
  });

  it('warns when large-port blocks have no large conveyor line (example ship)', async () => {
    // The bundled example ship has large cargo containers but no conveyor pieces.
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    render(<ConveyorPanel />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no large-port conveyor line/i);
    // The large-port block is listed with its reason.
    expect(screen.getByText(/bulk storage/i)).toBeInTheDocument();
  });

  it('confirms feedability when a large conveyor line is present', async () => {
    await state().importBlueprint(FEEDABLE_BLUEPRINT, 'feedable.sbc');
    render(<ConveyorPanel />);
    expect(screen.getByText(/large conveyor line present/i)).toBeInTheDocument();
    expect(screen.getByText(/^Production$/)).toBeInTheDocument();
  });

  it('always shows the presence-not-connectivity caveat', async () => {
    await state().importBlueprint(FEEDABLE_BLUEPRINT, 'feedable.sbc');
    render(<ConveyorPanel />);
    expect(screen.getByText(/not a routed-connectivity solve/i)).toBeInTheDocument();
  });

  it('shows a tidy empty state when nothing needs a large port', async () => {
    await state().importBlueprint(NO_LARGEPORT_BLUEPRINT, 'plain.sbc');
    render(<ConveyorPanel />);
    expect(screen.getByText(/no large-port blocks/i)).toBeInTheDocument();
  });

  it('renders nothing when no design is loaded', () => {
    const { container } = render(<ConveyorPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});
