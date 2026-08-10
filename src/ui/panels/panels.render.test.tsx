import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignStore } from '../../app/store/design-store';
import { EXAMPLE_BLUEPRINT_XML } from '../lib/example-blueprint';
import { CARGO_ITEMS_BY_ID, itemDensity } from '@data';
import { TwrPanel } from './TwrPanel';
import { PowerPanel } from './PowerPanel';
import { CargoControl } from './CargoControl';

/**
 * A minimal ion-thruster blueprint with no power source: peak draw is huge and
 * generation/battery are zero, so `powerSummary` reports a brownout. Used to
 * exercise the PowerPanel's brownout branch deterministically.
 */
const UNPOWERED_ION_BLUEPRINT = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints>
    <ShipBlueprint xsi:type="MyObjectBuilder_ShipBlueprintDefinition">
      <DisplayName>Powerless Drifter</DisplayName>
      <CubeGrids>
        <CubeGrid>
          <SubtypeName />
          <DisplayName>Powerless Drifter</DisplayName>
          <GridSizeEnum>Large</GridSizeEnum>
          <CubeBlocks>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
              <SubtypeName>LargeBlockLargeThrust</SubtypeName>
              <Min x="0" y="0" z="0" />
              <BlockOrientation Forward="Down" Up="Forward" />
            </MyObjectBuilder_CubeBlock>
          </CubeBlocks>
        </CubeGrid>
      </CubeGrids>
    </ShipBlueprint>
  </ShipBlueprints>
</Definitions>`;

/**
 * A battery-powered ion ship: enough battery discharge to cover the thruster
 * draw, and no reactor. Exercises the PowerPanel's battery-only supply branch
 * (must NOT report a "0 W generation" brownout).
 */
const BATTERY_ION_BLUEPRINT = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ShipBlueprints>
    <ShipBlueprint xsi:type="MyObjectBuilder_ShipBlueprintDefinition">
      <DisplayName>Battery Skiff</DisplayName>
      <CubeGrids>
        <CubeGrid>
          <SubtypeName />
          <DisplayName>Battery Skiff</DisplayName>
          <GridSizeEnum>Large</GridSizeEnum>
          <CubeBlocks>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
              <SubtypeName>LargeBlockLargeThrust</SubtypeName>
              <Min x="0" y="0" z="0" />
              <BlockOrientation Forward="Down" Up="Forward" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_BatteryBlock">
              <SubtypeName>LargeBlockBatteryBlock</SubtypeName>
              <Min x="1" y="0" z="0" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_BatteryBlock">
              <SubtypeName>LargeBlockBatteryBlock</SubtypeName>
              <Min x="2" y="0" z="0" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_BatteryBlock">
              <SubtypeName>LargeBlockBatteryBlock</SubtypeName>
              <Min x="3" y="0" z="0" />
            </MyObjectBuilder_CubeBlock>
          </CubeBlocks>
        </CubeGrid>
      </CubeGrids>
    </ShipBlueprint>
  </ShipBlueprints>
</Definitions>`;

const state = () => useDesignStore.getState();

describe('TwrPanel rendering', () => {
  beforeEach(() => {
    state().reset();
  });

  it('shows both lift verdicts when a design lifts off', async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    state().setPlanet('earthlike');
    state().setCargoFill(0);
    render(<TwrPanel />);
    // The example is a strong hydrogen hauler — empty and lightly-loaded it lifts.
    expect(screen.getAllByText(/lifts off/i).length).toBeGreaterThan(0);
  });

  it('tells the "lifts empty but not loaded" story for a heavy load', async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    state().setPlanet('earthlike');
    state().setCargoFill(1); // full
    state().setCargoDensity(7.6); // dense uranium ore — overloads the hauler
    render(<TwrPanel />);
    expect(screen.getByRole('alert')).toHaveTextContent(/can't take off/i);
    // Empty verdict passes, loaded verdict fails — both verdict cards are shown.
    expect(screen.getByText(/lifts off ·/i)).toBeInTheDocument();
    expect(screen.getByText(/can't lift ·/i)).toBeInTheDocument();
  });

  it('swaps TWR for directional acceleration in space', async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    state().setPlanet('space');
    render(<TwrPanel />);
    // No pass/fail verdict in vacuum — instead acceleration + time-to-top-speed.
    expect(screen.getAllByText(/directional acceleration/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/reaches 100 m\/s in/i).length).toBeGreaterThan(0);
    // The old "TWR is not applicable" placeholder is gone.
    expect(screen.queryByText(/not applicable in space/i)).not.toBeInTheDocument();
  });

  it('rescales the time-to-top-speed when the speed cap is raised', async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    state().setPlanet('space');
    render(<TwrPanel />);
    // Raise the cap to a preset; captions must now target 500 m/s.
    fireEvent.click(screen.getByRole('button', { name: '500 m/s' }));
    expect(screen.getAllByText(/reaches 500 m\/s in/i).length).toBeGreaterThan(0);
  });

  it('keeps TWR bars unchanged on a normal planet', async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    state().setPlanet('earthlike');
    render(<TwrPanel />);
    // TWR title and verdicts present; no acceleration copy.
    expect(screen.getByText(/thrust-to-weight/i)).toBeInTheDocument();
    expect(screen.queryByText(/directional acceleration/i)).not.toBeInTheDocument();
  });
});

describe('PowerPanel rendering', () => {
  beforeEach(() => {
    state().reset();
  });

  it('shows a healthy generation message when generation covers draw', async () => {
    // The example's thrusters are hydrogen (0 W draw) with a hydrogen engine —
    // generation exceeds peak draw, so no brownout.
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    render(<PowerPanel />);
    expect(screen.getByText(/generation covers peak draw/i)).toBeInTheDocument();
    expect(screen.queryByText(/brownout/i)).not.toBeInTheDocument();
  });

  it('renders a prominent brownout alert when draw exceeds generation + battery', async () => {
    await state().importBlueprint(UNPOWERED_ION_BLUEPRINT, 'drifter.sbc');
    render(<PowerPanel />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/brownout/i);
    expect(alert).toHaveTextContent(/power deficit/i);
  });

  it('treats a battery-powered ship as supplied, not a 0 W brownout', async () => {
    // 3 large batteries (36 MW out) cover one large ion thruster (33.6 MW draw)
    // with no reactor — the old code reported "generation 0 W" + brownout.
    await state().importBlueprint(BATTERY_ION_BLUEPRINT, 'skiff.sbc');
    render(<PowerPanel />);
    expect(screen.queryByText(/brownout/i)).not.toBeInTheDocument();
    expect(screen.getByText(/batteries power this ship/i)).toBeInTheDocument();
  });
});

describe('CargoControl rendering', () => {
  beforeEach(() => {
    state().reset();
  });

  it('sets the store density from a selected game item (Gold Ingot)', async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    render(<CargoControl />);
    const select = screen.getByLabelText(/cargo contents/i);
    fireEvent.change(select, { target: { value: 'ingot-gold' } });
    // Gold ingot: 1 kg / 0.052 L = 19.2308 kg/L — derived by the app.
    expect(state().cargo.densityKgPerL).toBeCloseTo(itemDensity(CARGO_ITEMS_BY_ID['ingot-gold']!), 4);
    expect(state().cargo.densityKgPerL).toBeCloseTo(19.2308, 3);
  });

  it('derives density from custom Mass and Volume fields', async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    render(<CargoControl />);
    fireEvent.change(screen.getByLabelText(/cargo contents/i), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText(/cargo mass in kilograms/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/cargo volume in liters/i), { target: { value: '250' } });
    // 500 kg / 250 L = 2.0 kg/L.
    expect(state().cargo.densityKgPerL).toBeCloseTo(2.0, 6);
  });
});
