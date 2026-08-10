import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDesignStore } from '../../app/store/design-store';
import { CombatPanel } from './CombatPanel';

const state = () => useDesignStore.getState();

/** A small-grid ship with a gatling turret — a scored weapon. */
const ARMED_BLUEPRINT = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints>
    <ShipBlueprint xsi:type="MyObjectBuilder_ShipBlueprintDefinition">
      <DisplayName>Gunship</DisplayName>
      <CubeGrids>
        <CubeGrid>
          <SubtypeName />
          <DisplayName>Gunship</DisplayName>
          <GridSizeEnum>Small</GridSizeEnum>
          <CubeBlocks>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_LargeGatlingTurret">
              <SubtypeName>SmallGatlingTurret</SubtypeName>
              <Min x="0" y="0" z="0" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_SmallGatlingGun">
              <SubtypeName>SmallBlockAutocannon</SubtypeName>
              <Min x="1" y="0" z="0" />
            </MyObjectBuilder_CubeBlock>
          </CubeBlocks>
        </CubeGrid>
      </CubeGrids>
    </ShipBlueprint>
  </ShipBlueprints>
</Definitions>`;

/** A ship with only a cockpit — unarmed. */
const UNARMED_BLUEPRINT = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints>
    <ShipBlueprint xsi:type="MyObjectBuilder_ShipBlueprintDefinition">
      <DisplayName>Shuttle</DisplayName>
      <CubeGrids>
        <CubeGrid>
          <SubtypeName />
          <DisplayName>Shuttle</DisplayName>
          <GridSizeEnum>Small</GridSizeEnum>
          <CubeBlocks>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Cockpit">
              <SubtypeName>SmallBlockCockpit</SubtypeName>
              <Min x="0" y="0" z="0" />
            </MyObjectBuilder_CubeBlock>
          </CubeBlocks>
        </CubeGrid>
      </CubeGrids>
    </ShipBlueprint>
  </ShipBlueprints>
</Definitions>`;

describe('CombatPanel rendering', () => {
  beforeEach(() => {
    state().reset();
  });

  it('shows DPS totals and per-weapon rows for an armed ship', async () => {
    await state().importBlueprint(ARMED_BLUEPRINT, 'gunship.sbc');
    render(<CombatPanel />);
    expect(screen.getByText(/^Burst DPS$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Sustained DPS$/i)).toBeInTheDocument();
    // Both weapon types listed.
    expect(screen.getByText(/gatling turret/i)).toBeInTheDocument();
    expect(screen.getByText('Autocannon')).toBeInTheDocument();
  });

  it('labels the damage kind on weapon rows', async () => {
    await state().importBlueprint(ARMED_BLUEPRINT, 'gunship.sbc');
    render(<CombatPanel />);
    // Both gatling and autocannon are kinetic (HP damage).
    expect(screen.getAllByText(/kinetic/i).length).toBeGreaterThan(0);
  });

  it('always shows the no-time-to-kill caveat', async () => {
    await state().importBlueprint(ARMED_BLUEPRINT, 'gunship.sbc');
    render(<CombatPanel />);
    expect(screen.getByText(/no target-armour or time-to-kill model/i)).toBeInTheDocument();
  });

  it('shows a tidy empty state for an unarmed ship', async () => {
    await state().importBlueprint(UNARMED_BLUEPRINT, 'shuttle.sbc');
    render(<CombatPanel />);
    expect(screen.getByText(/^Unarmed$/)).toBeInTheDocument();
  });

  it('renders nothing when no design is loaded', () => {
    const { container } = render(<CombatPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});
