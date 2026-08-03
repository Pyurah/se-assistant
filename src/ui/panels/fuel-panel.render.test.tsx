import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDesignStore } from '../../app/store/design-store';
import { EXAMPLE_BLUEPRINT_XML } from '../lib/example-blueprint';
import { FuelPanel } from './FuelPanel';

/**
 * A large-grid ion ship on nuclear power: ion thrusters (electric, so they draw
 * power) plus a large reactor. No hydrogen anywhere, so the panel shows only the
 * reactor/uranium section.
 */
const REACTOR_ION_BLUEPRINT = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints>
    <ShipBlueprint xsi:type="MyObjectBuilder_ShipBlueprintDefinition">
      <DisplayName>Nuclear Ion Cruiser</DisplayName>
      <CubeGrids>
        <CubeGrid>
          <SubtypeName />
          <DisplayName>Nuclear Ion Cruiser</DisplayName>
          <GridSizeEnum>Large</GridSizeEnum>
          <CubeBlocks>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
              <SubtypeName>LargeBlockLargeThrust</SubtypeName>
              <Min x="0" y="0" z="0" />
              <BlockOrientation Forward="Down" Up="Forward" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
              <SubtypeName>LargeBlockLargeThrust</SubtypeName>
              <Min x="4" y="0" z="0" />
              <BlockOrientation Forward="Down" Up="Forward" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Reactor">
              <SubtypeName>LargeBlockLargeGenerator</SubtypeName>
              <Min x="0" y="4" z="0" />
              <BlockOrientation Forward="Forward" Up="Up" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Cockpit">
              <SubtypeName>LargeBlockCockpit</SubtypeName>
              <Min x="0" y="8" z="0" />
              <BlockOrientation Forward="Forward" Up="Up" />
            </MyObjectBuilder_CubeBlock>
          </CubeBlocks>
        </CubeGrid>
      </CubeGrids>
    </ShipBlueprint>
  </ShipBlueprints>
</Definitions>`;

/**
 * A purely electric ship: ion thrusters powered by a battery and a solar panel.
 * No hydrogen, no reactor → the panel shows the "no consumable fuel" empty state.
 */
const ELECTRIC_ONLY_BLUEPRINT = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints>
    <ShipBlueprint xsi:type="MyObjectBuilder_ShipBlueprintDefinition">
      <DisplayName>Solar Ion Skiff</DisplayName>
      <CubeGrids>
        <CubeGrid>
          <SubtypeName />
          <DisplayName>Solar Ion Skiff</DisplayName>
          <GridSizeEnum>Large</GridSizeEnum>
          <CubeBlocks>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
              <SubtypeName>LargeBlockLargeThrust</SubtypeName>
              <Min x="0" y="0" z="0" />
              <BlockOrientation Forward="Down" Up="Forward" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_BatteryBlock">
              <SubtypeName>LargeBlockBatteryBlock</SubtypeName>
              <Min x="0" y="4" z="0" />
              <BlockOrientation Forward="Forward" Up="Up" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_SolarPanel">
              <SubtypeName>LargeBlockSolarPanel</SubtypeName>
              <Min x="0" y="8" z="0" />
              <BlockOrientation Forward="Forward" Up="Up" />
            </MyObjectBuilder_CubeBlock>
          </CubeBlocks>
        </CubeGrid>
      </CubeGrids>
    </ShipBlueprint>
  </ShipBlueprints>
</Definitions>`;

const state = () => useDesignStore.getState();

describe('FuelPanel rendering', () => {
  beforeEach(() => {
    state().reset();
  });

  it('shows hover time on a full tank for a hydrogen ship that can hover', async () => {
    // The bundled example is a small-grid hydrogen hauler; empty on Earthlike it
    // lifts, so it can hold a hover and reports a finite hover time.
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    state().setPlanet('earthlike');
    state().setCargoFill(0);
    render(<FuelPanel />);
    expect(screen.getByText(/hover time on a full tank/i)).toBeInTheDocument();
    expect(screen.getByText(/h2 capacity/i)).toBeInTheDocument();
    // A hydrogen hover-burn meter is present and labeled.
    expect(screen.getByRole('meter', { name: /hydrogen hover burn rate/i })).toBeInTheDocument();
    // No can't-hover alert in this state.
    expect(screen.queryByText(/can't hold a hover/i)).not.toBeInTheDocument();
  });

  it("surfaces a can't-hover warning when thrust can't lift the loaded mass", async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    state().setPlanet('earthlike');
    state().setCargoFill(1); // full
    state().setCargoDensity(7.6); // dense uranium ore — overloads the hauler
    render(<FuelPanel />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/can't hold a hover/i);
    // Full-throttle fallback duration is still surfaced.
    expect(alert).toHaveTextContent(/full throttle/i);
  });

  it('renders unlimited hover for a hydrogen ship in zero-g', async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    state().setPlanet('space');
    render(<FuelPanel />);
    expect(screen.getByText(/hover time \(zero-g\)/i)).toBeInTheDocument();
    expect(screen.getByText('unlimited')).toBeInTheDocument();
  });

  it('shows the uranium burn section for a reactor ship', async () => {
    await state().importBlueprint(REACTOR_ION_BLUEPRINT, 'reactor.sbc');
    render(<FuelPanel />);
    expect(screen.getByText(/reactor · uranium burn/i)).toBeInTheDocument();
    expect(screen.getByText(/at peak draw/i)).toBeInTheDocument();
    expect(screen.getByText(/1 kg lasts/i)).toBeInTheDocument();
    // No hydrogen section for a pure ion/nuclear ship.
    expect(screen.queryByText(/hover time/i)).not.toBeInTheDocument();
  });

  it('shows the empty "no consumable fuel" state for an electric/solar ship', async () => {
    await state().importBlueprint(ELECTRIC_ONLY_BLUEPRINT, 'electric.sbc');
    render(<FuelPanel />);
    expect(screen.getByText(/no consumable fuel/i)).toBeInTheDocument();
    expect(screen.getByText(/electric thrusters and\/or solar/i)).toBeInTheDocument();
    expect(screen.queryByText(/reactor · uranium burn/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hover time/i)).not.toBeInTheDocument();
  });
});
