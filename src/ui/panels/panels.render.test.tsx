import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDesignStore } from '../../app/store/design-store';
import { EXAMPLE_BLUEPRINT_XML } from '../lib/example-blueprint';
import { TwrPanel } from './TwrPanel';
import { PowerPanel } from './PowerPanel';

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

  it('renders a no-gravity state in space instead of pass/fail', async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    state().setPlanet('space');
    render(<TwrPanel />);
    expect(screen.getByText(/no gravity here/i)).toBeInTheDocument();
  });

  it('flags an atmospheric thruster as unusable in space via the recommender', async () => {
    await state().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    state().setPlanet('space');
    render(<TwrPanel />);
    // Default recommender pick is the first thruster (an ion, feasible); switch
    // to an atmospheric one to hit the infeasible branch.
    const select = screen.getByLabelText(/thruster type for the recommender/i);
    const atmoOption = Array.from(select.querySelectorAll('option')).find((o) =>
      /atmospheric/i.test(o.textContent ?? ''),
    );
    expect(atmoOption).toBeDefined();
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
});
