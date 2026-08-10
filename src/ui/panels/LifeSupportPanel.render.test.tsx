import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDesignStore } from '../../app/store/design-store';
import { LifeSupportPanel } from './LifeSupportPanel';

const state = () => useDesignStore.getState();

/** A large-grid ship with an O2/H2 generator and two oxygen tanks — full life support. */
const CREWED_BLUEPRINT = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints>
    <ShipBlueprint xsi:type="MyObjectBuilder_ShipBlueprintDefinition">
      <DisplayName>Crewed Rig</DisplayName>
      <CubeGrids>
        <CubeGrid>
          <SubtypeName />
          <DisplayName>Crewed Rig</DisplayName>
          <GridSizeEnum>Large</GridSizeEnum>
          <CubeBlocks>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_OxygenGenerator">
              <SubtypeName>OxygenGenerator</SubtypeName>
              <Min x="0" y="0" z="0" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_OxygenTank">
              <SubtypeName>OxygenTankSmall</SubtypeName>
              <Min x="1" y="0" z="0" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_OxygenTank">
              <SubtypeName>OxygenTankSmall</SubtypeName>
              <Min x="2" y="0" z="0" />
            </MyObjectBuilder_CubeBlock>
          </CubeBlocks>
        </CubeGrid>
      </CubeGrids>
    </ShipBlueprint>
  </ShipBlueprints>
</Definitions>`;

/** A ship with only a cockpit — no gas hardware at all. */
const NO_LIFE_SUPPORT_BLUEPRINT = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints>
    <ShipBlueprint xsi:type="MyObjectBuilder_ShipBlueprintDefinition">
      <DisplayName>Bare Rig</DisplayName>
      <CubeGrids>
        <CubeGrid>
          <SubtypeName />
          <DisplayName>Bare Rig</DisplayName>
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

describe('LifeSupportPanel rendering', () => {
  beforeEach(() => {
    state().reset();
  });

  it('reports that generation covers a default crew of 1', async () => {
    await state().importBlueprint(CREWED_BLUEPRINT, 'crewed.sbc');
    render(<LifeSupportPanel />);
    // A large generator (250 L/s O₂) easily covers one crew member.
    expect(screen.getByText(/generation covers the crew/i)).toBeInTheDocument();
    // Headline supports value: 250 / 0.063 = 3,968 crew.
    expect(screen.getByText('3,968')).toBeInTheDocument();
  });

  it('shows the stored-oxygen capacity from the two tanks', async () => {
    await state().importBlueprint(CREWED_BLUEPRINT, 'crewed.sbc');
    render(<LifeSupportPanel />);
    // 2 × 50,000 L = 100,000 L → formatted as "100 kL".
    expect(screen.getByText('100 kL')).toBeInTheDocument();
  });

  it('shows a tidy empty state for a ship with no gas hardware', async () => {
    await state().importBlueprint(NO_LIFE_SUPPORT_BLUEPRINT, 'bare.sbc');
    render(<LifeSupportPanel />);
    expect(screen.getByText(/no life-support hardware/i)).toBeInTheDocument();
  });

  it('renders nothing when no design is loaded', () => {
    const { container } = render(<LifeSupportPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});
