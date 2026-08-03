/**
 * A bundled example blueprint so the app is explorable without a file on hand.
 *
 * This is a real, minimal exported-blueprint XML string run through the same
 * `parseBlueprint` path a dropped file takes — no synthetic `ShipDesign`
 * shortcut — so the "load example" affordance exercises the full import flow
 * (matching, orientation, report). It is a small-grid hydrogen hauler that
 * lifts empty but struggles fully loaded on Earthlike: the tool's headline
 * insight, visible out of the box.
 */
export const EXAMPLE_BLUEPRINT_XML = `<?xml version="1.0"?>
<Definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <ShipBlueprints>
    <ShipBlueprint xsi:type="MyObjectBuilder_ShipBlueprintDefinition">
      <Id Type="MyObjectBuilder_ShipBlueprintDefinition" Subtype="Prospector Hauler" />
      <DisplayName>Prospector Hauler</DisplayName>
      <CubeGrids>
        <CubeGrid>
          <SubtypeName />
          <DisplayName>Prospector Hauler</DisplayName>
          <GridSizeEnum>Small</GridSizeEnum>
          <CubeBlocks>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
              <SubtypeName>SmallBlockLargeHydrogenThrust</SubtypeName>
              <Min x="0" y="0" z="0" />
              <BlockOrientation Forward="Down" Up="Forward" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
              <SubtypeName>SmallBlockLargeHydrogenThrust</SubtypeName>
              <Min x="2" y="0" z="0" />
              <BlockOrientation Forward="Down" Up="Forward" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
              <SubtypeName>SmallBlockSmallHydrogenThrust</SubtypeName>
              <Min x="0" y="2" z="0" />
              <BlockOrientation Forward="Up" Up="Forward" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
              <SubtypeName>SmallBlockSmallHydrogenThrust</SubtypeName>
              <Min x="0" y="4" z="0" />
              <BlockOrientation Forward="Backward" Up="Up" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
              <SubtypeName>SmallBlockSmallHydrogenThrust</SubtypeName>
              <Min x="0" y="6" z="0" />
              <BlockOrientation Forward="Forward" Up="Up" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
              <SubtypeName>SmallBlockSmallHydrogenThrust</SubtypeName>
              <Min x="2" y="6" z="0" />
              <BlockOrientation Forward="Left" Up="Up" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Thrust">
              <SubtypeName>SmallBlockSmallHydrogenThrust</SubtypeName>
              <Min x="4" y="6" z="0" />
              <BlockOrientation Forward="Right" Up="Up" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_CargoContainer">
              <SubtypeName>SmallBlockLargeContainer</SubtypeName>
              <Min x="0" y="8" z="0" />
              <BlockOrientation Forward="Forward" Up="Up" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_CargoContainer">
              <SubtypeName>SmallBlockLargeContainer</SubtypeName>
              <Min x="2" y="8" z="0" />
              <BlockOrientation Forward="Forward" Up="Up" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_BatteryBlock">
              <SubtypeName>SmallBlockBatteryBlock</SubtypeName>
              <Min x="0" y="10" z="0" />
              <BlockOrientation Forward="Forward" Up="Up" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_HydrogenEngine">
              <SubtypeName>SmallBlockHydrogenEngine</SubtypeName>
              <Min x="0" y="12" z="0" />
              <BlockOrientation Forward="Forward" Up="Up" />
            </MyObjectBuilder_CubeBlock>
            <MyObjectBuilder_CubeBlock xsi:type="MyObjectBuilder_Cockpit">
              <SubtypeName>SmallBlockCockpit</SubtypeName>
              <Min x="0" y="14" z="0" />
              <BlockOrientation Forward="Forward" Up="Up" />
            </MyObjectBuilder_CubeBlock>
          </CubeBlocks>
        </CubeGrid>
      </CubeGrids>
    </ShipBlueprint>
  </ShipBlueprints>
</Definitions>`;

/** Filename shown in the UI when the example is loaded. */
export const EXAMPLE_BLUEPRINT_NAME = 'prospector-hauler.example.sbc';
