# Data Audit — M1 (SE v1.210.012 b0)

This is the citation log for the curated vanilla dataset. It records where every
block and planet value came from, and explicitly flags the handful of values
that could not be confirmed to full certainty. Update this file whenever a value
is corrected or a source changes.

**Target game version:** Space Engineers v1.210.012 b0 ("Prosperity", current as
of Aug 2026).

## Sources

- **Primary (current stats):** the official wiki, `spaceengineers.wiki.gg` —
  per-block pages for Atmospheric / Ion / Hydrogen Thrusters (+ Large variants),
  Cargo Container, Small/Large Reactor, Battery, Solar Panel, Hydrogen Engine,
  Wind Turbine; the hydrogen Fuel-Cost table; "Comparison of DLC Packs".
- **SubtypeIds + effectiveness-curve structure:** Keen's archived
  `CubeBlocks.sbc` (`github.com/KeenSoftwareHouse/SpaceEngineers`). These are
  design-stable constants; SubtypeIds and the planetary-influence semantics are
  unchanged even where raw thrust magnitudes were later rebalanced.
- **DLC list + release order:** Steam DLC store page + wiki DLC comparison.
- **Planets:** `spaceengineers.wiki.gg` planet pages, corroborated by the legacy
  fandom wiki.

Where the archived 2019 `.sbc` raw thrust numbers differed from the current
wiki (thrusters were buffed post-2019, ~17% on some), the **current wiki value
wins**; only SubtypeIds and effectiveness-curve fields were taken from the
archive.

## Thruster effectiveness envelopes (design constants)

| Type | minInfluence | maxInfluence | effAtMin | effAtMax | Behaviour |
|---|---|---|---|---|---|
| Ion | 0 | 1 | 1.0 | 0.3 | Full in vacuum, 30% in dense atmo |
| Atmospheric | 0.3 | 1 | 0.0 | 1.0 | Zero in vacuum, ramps up with air |
| Hydrogen | — | — | 1.0 | 1.0 | Flat 100% everywhere |

## Corrections applied vs. the original seed

| Item | Seed value | Corrected value | Note |
|---|---|---|---|
| Large Ion Thruster (large grid) mass | 3,625 kg | **43,200 kg** | Seed was badly low |
| Large Ion Thruster (large grid) thrust | 4,320,000 N | 4,320,000 N | Confirmed |
| Large Reactor (large grid) mass | 12,600 kg | **73,795 kg** | Seed was badly low |
| Large Reactor (large grid) output | 300 MW | 300 MW | Confirmed |
| Large Battery capacity | 3 MWh | 3 MWh | Confirmed |
| Large Battery mass | 3,762 kg | **3,845 kg** | Minor correction |
| Pertam gravity | 1.0 g / 9.81 | **1.20 g / 11.77 m/s²** | Seed was wrong |
| DLC enum | guessed list w/ "fields" | verified 21-entry list | No "Fields"; it's "Fieldwork" |

## Flagged / unverified values

These are in the dataset with a best-effort value but could **not** be confirmed
to full certainty. Confirm against the local game's `.sbc` files if exactness
matters, and update this table when resolved.

1. **Cockpit inventory volume** (`LargeBlockCockpit`, `SmallBlockCockpit`) —
   not published on the wiki. Using **120 L** (the common 1× default). Confirm
   via in-game or `CubeBlocks.sbc` `InventoryMaxVolume`.
2. **Hydrogen Engine SubtypeIds** (`SmallBlockHydrogenEngine`,
   `LargeBlockHydrogenEngine`) — from Keen naming convention; these blocks
   postdate the archived `.sbc` that was fetched. Stats are current-wiki.
3. **Wind Turbine SubtypeId** (`LargeBlockWindTurbine`) — same convention note.
   Output 400 kW is the quoted average-weather figure; real output varies with
   altitude/weather/obstruction.
4. **Europa atmosphere density** — wiki prints a flat "1 atm" surface label for
   all atmospheric bodies, but the game's `PlanetGeneratorDefinitions.sbc`
   `<Density>` for Europa is **0.5**, matching its "thin atmosphere" description.
   We use **0.5** because thruster effectiveness keys off that density
   multiplier. Confirm against local `PlanetGeneratorDefinitions.sbc`.

## DLC / block ownership

Every block currently in the dataset is base-game (`dlc: 'base'`). DLCs add only
stat-identical **reskins** of these base blocks (e.g. Sci-Fi thrusters, Warfare
reactors/batteries), so for the physics math the base block is sufficient. If
DLC-specific variants are added later, they share the base block's
mass/thrust/power and only differ by `dlc` tag and `displayName`.

Note: **Prototech** blocks (Prototech Thruster / Battery / Fusion Reactor / Jump
Drive) are **not** DLC — they are rare base-game endgame loot with distinct
stats, to be handled separately if the calculator ever covers them.

## Blueprint (`bp.sbc`) format — M2 verification

The parser's assumptions about the blueprint XML were verified against primary
sources: a real multi-grid grid dump (`midspace/Space-Engineers-Admin-script-mod`
prefab), SEToolbox's serialization classes for the `ShipBlueprint` envelope, and
Whiplash141's physics code for the thrust-direction rule. Confirmed:

- Structure `Definitions → ShipBlueprints → ShipBlueprint → CubeGrids → CubeGrid
  → CubeBlocks → MyObjectBuilder_CubeBlock`. The root is always `Definitions`
  (shared by all `.sbc` types); a blueprint is identified by `ShipBlueprints`.
- Block identity is the **(xsi:type, SubtypeName)** pair; `SubtypeName` equals
  the `CubeBlocks.sbc` SubtypeId. Empty `<SubtypeName/>` is real and common
  (default variant) — fall back to `xsi:type`. ✓ handled.
- **No quantity field** — one element per placed block; count occurrences.
  ✓ handled (aggregation).
- **Thrust direction = `flip(BlockOrientation.Forward)`** — the flame exits the
  Forward face, grid is pushed opposite. Confirmed against
  `Base6Directions.GetFlippedDirection`. ✓ this is what `orientation.ts` does.
  The `Up` attribute does not affect thrust bucketing.

Flagged follow-ups (robustness, not blocking):

1. **Current-version fixture** — the reviewer could not pull a verbatim v1.210
   `bp.sbc` (only a slightly older grid dump + the serialization code). Export a
   real blueprint from the local v1.210 install to lock the fixture exactly.
2. **Inventory wrapper** — older schema nests `<Inventory>` directly in a block;
   newer versions may wrap it in `<ComponentContainer> → <Components>`. We don't
   read inventory contents yet (capacity comes from our dataset), so this is
   moot until "as-saved cargo mass" is added.
3. **`<Id>` attribute-vs-element form** — some serializations write
   `<Id Type=".." Subtype=".."/>`, others `<Id><TypeId/>..</Id>`. We read the
   grid `DisplayName`, not `<Id>`, so this doesn't affect parsing today.
4. **Subgrid thrust frames** — see the KNOWN APPROXIMATION note in `parse.ts`:
   subgrid thrust is bucketed in each grid's local axes without rotating into
   the main frame. Fine for main-grid thrusters; a future enhancement for
   rotated rotor/hinge-mounted thrusters.

## Functional / utility blocks (estimator dataset)

Added for the requirement-estimator's block palette. Sourced from the current
wiki, with SubtypeIds and key fields cross-checked against Keen's
`CubeBlocks.sbc`.

Confirmed authoritatively (`.sbc`):
- **Gyroscope** `ForceMagnitude` (= max torque, N·m): small `SmallBlockGyro`
  448,000; large `LargeBlockGyro` 33,600,000 (exactly 75×). Power fixed and
  negligible (0.6 W / 30 W). These drive the gyro-count heuristic.
- **Camera** `RequiredPowerInput` 0.00003 MW = 30 W. SubtypeIds
  `SmallCameraBlock` / `LargeCameraBlock` (NOT `…BlockCameraBlock`).

SubtypeId corrections captured in the dataset:
- Drill: `SmallBlockDrill` / `LargeBlockDrill` (TypeId `Drill`, not `ShipDrill`).
- Small connector: `ConnectorMedium` (NOT `ConnectorSmall`, which is a separate
  ejector). Large connector: `Connector`.
- Interior Light naming is inverted: large-grid = `SmallLight`, small-grid =
  `SmallBlockSmallLight`.
- Small ore detector: `SmallBlockOreDetector` (not `SmallOreDetector`).

Flagged power values (community-sourced; wiki does not list them and they're not
in the `.sbc` — power is code-driven). Used as best-effort; verify in-game
(place block → Info tab) if precision matters:
1. **Drill / welder / grinder** — 2 kW while OPERATING, ~0 idle. We store 2 kW
   (worst case for power budgeting) and mark `variableDraw`.
2. **Sensor** — ~100 W (near-zero; wiki lists none).
3. **Programmable block** — ~500 W (wiki confirms it draws power, no figure).
4. **Ore detector** — ~2 kW (wiki lists none).
5. **Beacon / antenna** — draw scales with broadcast range; we store the MAX
   (beacon ~20 kW, antenna 200 kW) and mark `variableDraw`. Beacon max is
   wiki-inconsistent; verify in-game.
6. **Event Controller** (Automatons DLC) — SubtypeId `EventControllerLarge` /
   `…Small` could NOT be authoritatively confirmed (block postdates the archived
   `.sbc`); mass/power from the wiki. Verify the SubtypeId if blueprint-matching
   Event Controllers matters.
7. **Light masses** — wiki infoboxes round to 0 kg (display rounding, not truly
   zero). We store small nonzero placeholders (1–3 kg); refine from `.sbc` if
   exact light mass ever matters.

## Fuel & flight-time data (M5)

Added for the fuel/flight-time engine (`src/core/engine/fuel.ts`). All from the
current wiki; several cross-checked against the fuel-cost tables.

Confirmed:
- **Hydrogen thruster fuel** (L/s at max thrust): small-grid small 80.33, small-
  grid large 385.6, large-grid small 803.34, large-grid large 4820.05 — all
  match the wiki fuel-cost table exactly (these were already in the dataset from
  M1; M5 verified them).
- **Hydrogen tank capacity** (L): 4 distinct blocks — `SmallHydrogenTankSmall`
  15,000; `SmallHydrogenTank` 500,000; `LargeHydrogenTankSmall` 1,000,000;
  `LargeHydrogenTank` 15,000,000.
- **Hydrogen engine**: 500 kW / 5 MW output confirmed; fuel 50 / 500 L/s at max.
- **Reactor uranium**: **1 MWh per 1 kg Uranium Ingot**, uniform across sizes
  (`URANIUM_WH_PER_KG = 1_000_000`). Burn rate kg/h = load_W / 1e6. This is the
  load-bearing constant and it's solid.
- **O2/H2 generator**: H2 output 100 / 500 L/s (small/large); 20 L H2 per kg ice.
  Key modeling insight: generation is negligible vs. thruster burn (one large
  generator = 500 L/s vs. one large H2 thruster = 4,820 L/s), so flight time is
  **tank-capacity-bound**, not generation-bound. The engine treats it that way.
- **Stored hydrogen adds no ship mass** in SE — only the empty tank block mass
  counts. Simplifies flight-time (no fuel-burn-lightens-ship feedback).

Flagged (community-sourced / not in game files this session; verify if precision
matters): the tank/tiny-tank SubtypeId strings, the ~10% thruster idle fuel
floor at low throttle (we model burn as linear with thrust — accurate near full
throttle, slightly optimistic for low-throttle station-keeping), and the O2/H2
generator ice-conversion rate.

## Motion & stability approximations (M6)

The motion engine (`src/core/engine/motion.ts`) is pure physics; the constants
are the grid cell sizes (`GRID_CELL_SIZE_M`: large 2.5 m, small 0.5 m — long-
established). Two deliberate approximations, surfaced in the UI:

1. **Stopping distance ignores per-axis gravity.** Net deceleration is
   braking-thrust / mass. Exact per-axis gravity needs the ship's orientation to
   the planet, which isn't tracked. Accurate in space and for horizontal motion;
   slightly optimistic braking a climb, pessimistic braking a descent.
2. **Turn rate uses a solid-cube moment of inertia.** Exact inertia needs the
   full mass distribution and rotation axis. We approximate the ship as a
   uniform cube (side from the bounding box when geometry is present, else a
   block-count cube root) and use I = (1/6)·m·s². Good for relative comparison
   and ballpark feel, not exact degrees/sec — labeled an estimate.

Center-of-mass and thrust-center alignment are exact given block positions;
they return `null` (UI: "import a blueprint") for position-less designs like the
estimator's.

## Battery variants (v0.9.0)

Five battery blocks, all wiki-confirmed for mass/capacity/I-O:
- `SmallBlockSmallBatteryBlock` — Small Battery, small grid: 146.4 kg, **50 kWh**,
  200 kW in/out. The compact variant (was missing pre-0.9.0).
- `SmallBlockBatteryBlock` — Battery, small grid: 1040.4 kg, 1 MWh, 4 MW.
- `LargeBlockBatteryBlock` — Battery, large grid: 3845 kg, 3 MWh, 12 MW.
- `LargeBlockBatteryBlockWarfare2` / `SmallBlockBatteryBlockWarfare2` — Warfare
  Battery (Warfare 2 DLC): stat-identical reskins of the base batteries.

Flagged: the two **Warfare 2 SubtypeId strings** follow Keen's convention but
were not confirmed against a live `.sbc` this session — verify before relying on
them for blueprint matching.

## DLC-reskin & armor blocks (v0.9.1)

Added after a real DLC-built ship ("Rapier") imported with **40 of 48 blocks
unrecognized** — every one a genuine DLC/base block, not a mod. These were
sourced by reading the **installed game's own definition files** directly
(`SpaceEngineers/Content/Data/CubeBlocks/*.sbc` + `Components.sbc`), which is a
stronger primary source than the wiki. Block mass is the sum of its component
masses; the method was validated by recomputing a known block —
`SmallBlockSmallAtmosphericThrust` came out to exactly **699 kg**, matching the
existing trusted value.

| SubtypeId | Category | Grid | Mass (kg) | Key stats | DLC | Source file |
|---|---|---|---|---|---|---|
| `SmallBlockLargeFlatAtmosphericThrustDShape` | thruster (atmo) | small | 1060 | 230 kN, 1 MW | base | `CubeBlocks_Thrusters.sbc` |
| `SmallBlockSmallAtmosphericThrustSciFi` | thruster (atmo) | small | 699 | 96 kN, 0.6 MW | Sparks of the Future | `CubeBlocks_SparksOfTheFuturePack.sbc` |
| `SmallBlockModularContainer` | cargo | small | 463 | 3375 L (= Medium) | Contact | `CubeBlocks_ContactPack.sbc` |
| `SmallShipWelderReskin` | welder | small | 448.4 | 2 kW | Apex Survival | `CubeBlocks_ApexSurvivalPack.sbc` |
| `SmallShipConveyorHub` | conveyor | small | 313 | 0 W (passive) | base | `CubeBlocks_Logistics.sbc` |
| `ConveyorTubeCurvedMedium` | conveyor | small | 365 | 0 W (passive) | base | `CubeBlocks_Logistics.sbc` |
| `SmallBlockArmorBlock` | structural | small | 20 | mass only | base | `CubeBlocks_Armor.sbc` |
| `SmallBlockArmorSlope` | structural | small | 20 | mass only | base | `CubeBlocks_Armor.sbc` |

- The three reskins (`…SciFi`, `…ModularContainer`, `…WelderReskin`) are
  stat-identical to their base counterparts — only the DLC tag and model differ.
- Two new DLC packs were added to the catalogue to tag these:
  **`apex-survival`** (Apex Survival Pack) and **`scrap-race`** (Scrap Race Pack,
  catalogued for completeness). The game's DLC tokens are `ApexSurvival` /
  `ScrapRace`.
- Small-grid **light armor** is 20 kg for every shape; only the two shapes the
  Rapier uses are added. Heavy armor and large-grid armor can be added the same
  way when a ship needs them.

### Orientation fix (v0.9.1)

The Rapier also exposed a parser bug: SE **omits** `<BlockOrientation>` entirely
when a block sits at the default identity orientation (`Forward="Forward"`). The
parser was treating a *missing* element as "unoriented" and dropping that thrust
from directional TWR. Two of the Rapier's thrusters had no orientation element
and were being silently excluded. Fixed: a missing orientation now defaults to
`Forward` (SE's identity), so it resolves to `backward` thrust; only an
orientation that is *present but has an unparseable axis* is still counted as
unoriented. Result: the Rapier now resolves **48/48 blocks, 0 unrecognized, 0
unoriented**.

### Cockpit-relative directional thrust (v0.9.2)

The Rapier further exposed a *frame-of-reference* bug. Space Engineers defines a
ship's forward / up / left by its **main cockpit's** facing, not the raw grid
axes stored in the blueprint. The parser had been bucketing thrust by grid axes,
so the Rapier — whose main cockpit faces `Forward="Right"`, `Up="Backward"` —
reported **zero forward thrust** even though two thrusters plainly provide it;
that force was landing on the grid's "right" axis.

Fix: the parser now finds the main cockpit (the `<IsMainCockpit>true` cockpit,
or the sole cockpit when only one exists), builds the pilot basis
`{forward = cockpit.Forward, up = cockpit.Up, right = forward × up}` (SE's
left-handed convention, `Base6Directions`), and rotates every thruster's
grid-frame thrust direction into it before aggregating. A ship with no cockpit
(e.g. a drone) falls back to raw grid axes, and the report carries a
`cockpitRelative` flag the block-list panel surfaces so the user knows which
frame is in play.

Verified against the game's own thrust overlay for the Rapier (screenshot,
relative to "Cockpit Rapier"): **up 920 kN, forward 460 kN, back 460 kN,
left 288 kN, right 288 kN**, and **nothing pushing down** — the four large
D-Shape thrusters provide lift (up), which the ship balances against gravity to
hover; SE's HUD labels that group by the direction the thrusters *face* (down),
whereas this tool labels by the direction the ship is *pushed* (up), matching how
the TWR/takeoff verdict reads the up-thrust bucket. All five nonzero axes match
the game exactly.

## Cargo item mass/volume (v0.10.0)

The cargo loadout control used to ask for a single "custom kg/L" density, which
confused users: the game shows every item as a **mass** (kg) *and* a **volume**
(L) — e.g. a steel plate is 20 kg / 3 L — not a density. v0.10.0 replaces that
field with an item picker (plus explicit Mass + Volume inputs for anything
custom) and derives the density the engine needs (`density = mass / volume`).

The item dataset (`src/data/cargo-items.ts`) is copied **verbatim** from the
installed game's own item definitions on **SE v1.210.012 b0**:

- **Components** — `SpaceEngineers/Content/Data/Components.sbc`, each
  `<Component>` element's `<Mass>` / `<Volume>`.
- **Ores & ingots** — `PhysicalItems.sbc`, each `<PhysicalItem>` element
  (`TypeId` `Ore` / `Ingot`).

`mass` and `volume` are stored as-authored; `density` is always derived, never
stored, so the two-field model stays the single source of truth. Load-bearing
values (guarded by data-integrity tests):

| Item | Mass (kg) | Volume (L) | Density (kg/L) |
|---|---|---|---|
| Steel Plate | 20 | 3 | 6.667 |
| Construction Comp. | 8 | 2 | 4.000 |
| Computer | 0.2 | 1 | 0.200 |
| Iron Ingot | 1 | 0.127 | 7.874 |
| Gold Ingot | 1 | 0.052 | 19.231 |
| Uranium Ingot | 1 | 0.052 | 19.231 |
| Platinum Ingot | 1 | 0.047 | 21.277 |
| All raw ores (except Scrap) | 1 | 0.37 | 2.703 |
| Scrap ore | 1 | 0.254 | 3.937 |

Notes:
- **All raw ores share one density (2.703 kg/L)** — mass 1 kg, volume 0.37 L
  uniformly. Ingots differ per metal (volume shrinks on refining), so ingot
  density varies from Magnesium (1.739) to Platinum (21.277). This is why the
  old single "Ingots = 2.0" preset was wrong.
- The picker excludes tools, plushies, and tree/environment objects (present in
  the game files but not bulk cargo). Prototech components exist in the files but
  are omitted until the calculator covers Prototech generally (see the Prototech
  note above).

## Power budget realism (v0.10.0)

Two power-budget bugs surfaced from the real Rapier data (draw read **11.63 MW**
against **0 W generation** on a battery-only ship that flies fine):

1. **Opposing thrusters were double-counted.** `peakDraw` summed *every*
   thruster's full draw, including up-vs-down / fwd-vs-back / left-vs-right pairs
   that can never fire simultaneously. On the Rapier that roughly doubled the
   real peak and invented a brownout. Fix: bucket thruster draw by resolved
   thrust direction and count only the **larger side of each opposing pair**,
   then add all non-thruster draw. A thruster with no resolved direction is
   counted in full (can't prove it opposes anything). Verified: the Rapier's
   realistic peak (~7.83 MW) now sits under its 8.8 MW battery output.
2. **Batteries weren't counted as supply.** Generation summed only reactors /
   solar / hydrogen engines / wind, so a battery-only ship reported "0 W
   generation" and a permanent brownout. Fix: `availablePower = generation +
   batteryOutput`; a brownout is now `peakDraw > availablePower`, and a
   `batteryOnly` flag drives an honest "batteries power this ship" message
   instead of a false deficit. Battery runtime is unchanged (still the deficit
   generation alone can't cover, drained from stored Wh).

These are realism corrections to the *aggregation*, not to any block stat — no
dataset values changed.

## Grid-aware gyro sizing (v0.10.1)

The estimator's gyro-count heuristic over-recommended on small-grid ships: a
real build with 3 welders, a cockpit, and a small cargo container (≈6 t loaded)
was told to fit **3 gyros** where the actual ship flies fine on **2** (and the
math now says 1 is the minimum).

Root cause: the torque-per-kg target was a single set of constants calibrated
for the **large** grid (1 gyro per 200 t at "normal" = 168 N·m/kg, from the
33.6 MN·m large gyro), then applied unchanged to small-grid ships and divided by
the **75×-weaker** small gyro (448 kN·m). That double penalty ballooned the
count.

Fix: scale the torque-per-kg target by the square of the grid cell-size ratio,
`(cell / large_cell)²`. This follows the same moment-of-inertia model the motion
engine uses (`I = k·m·s²`): for equal block counts a small-grid ship is 5×
smaller per axis (0.5 m vs 2.5 m cells), so its inertia per kg — and thus its
torque need — is `(0.5/2.5)² = 1/25` of a large-grid ship's. The large-grid row
is unchanged (ratio = 1); the small-grid target drops to 1/25, matching real
small-grid builds where one gyro spins a light ship briskly. Still a labeled
estimate — true turn rate needs the built ship's geometry. No dataset values
changed; this is a calibration fix in `src/core/engine/estimate.ts`.

## Estimator peak-draw realism + divergence guard (v0.10.2)

Two power-sizing bugs in the requirement estimator (`src/core/engine/estimate.ts`),
both surfaced from a real small-grid mining ship (cockpit, 3 drills, connector,
ore detector) that was told it needed **4 warfare batteries** where half that
runs the real ship fine.

1. **Peak draw summed all six thruster directions.** The estimator sized power
   against `totalThrusters × maxPowerDraw` — every up/down/fwd/back/left/right
   thruster drawing full power at once. But opposing thrusters never fire
   together, exactly the realism the analyzer's `peakDraw()` already applies
   (v0.10.0). On atmospheric thrusters (600 kW each) this roughly doubled the
   electrical load and inflated the battery count. Fix: size power (and report
   `peakDraw`) against only the larger side of each opposing pair —
   `up + 2×lateral` for the estimator's symmetric lateral split — via a shared
   `peakThrusterCount()` helper mirroring `power.ts`. The reported example
   dropped from 7 → 3 batteries; peak draw 12.6 MW → 4.8 MW.

2. **No guard against a runaway mass↔count loop.** The estimator iterates
   thrusters → power → mass → thrusters to a fixed point. For a thruster type
   that can't lift the ship on the chosen planet (e.g. ion in dense atmosphere,
   where effectiveness falls to 0.3), each added thruster brings more mass than
   thrust, so the loop diverged — one probe produced **58 trillion batteries**
   before hitting the iteration cap. Fix: a `SANITY_THRUSTER_CAP` (2000) short-
   circuits the loop and returns an infeasible estimate (zero counts) with a
   clear "can't lift this ship — try a stronger thruster, lower TWR, or less
   cargo" warning, instead of astronomically large numbers.

Neither touches a block stat — both are corrections to the estimator's
*aggregation and convergence*, matching the analyzer's existing peak-draw model.

## Manufacturing data (M7 / v0.14.0)

The build-cost analysis (`src/data/manufacturing.ts` + `src/core/engine/build-cost.ts`)
introduces three new recipe tables — ore→ingot refining, component→ingot
assembly, and per-block `<Components>` lists — plus refinery/assembler
throughput presets. This is the citation log for those values.

### Sources & cross-check

- **Primary:** the official wiki, `spaceengineers.wiki.gg` — the *Refining*,
  *Assembling*, and per-component pages (Steel Plate, Construction Component,
  Motor, Computer, Reactor Component, Thruster Component, etc.), plus per-block
  "Construction" component lists.
- **Corroborating:** Keen's archived `Data/Blueprints.sbc` and `CubeBlocks.sbc`
  (`github.com/KeenSoftwareHouse/SpaceEngineers`, 2019).

**Cross-check result — high confidence.** Unlike thrust *force* (buffed ~17%
post-2019), the refining ratios and assembly recipes are **identical** between
the 2019 archive and the current wiki. Ore→ingot yields (Iron 0.7, Nickel 0.4,
Cobalt 0.3, Silicon 0.7, Silver 0.1, Gold 0.01, Platinum 0.005), the standard
Refinery multipliers (1.3× speed / 0.8× yield → 0.56 effective iron yield), and
the core component recipes (Steel Plate = 21 kg Fe; Construction = 10 kg Fe;
Metal Grid = 12 Fe / 5 Ni / 3 Co; Motor = 20 Fe / 5 Ni; Computer = 0.5 Fe /
0.2 Si) all match. Per-block component lists were transcribed from the archive's
`<Components>` blocks and spot-checked against the wiki. Where the two diverge,
the **current-game value wins** (noted per-flag below).

### Model

- **1 ore unit = 1 kg.** Ore quantities are expressed and mined in kg; the
  refine `yieldRatio` is ingot-kg per ore-kg.
- **Effective ingot yield = baseYield × refinery MaterialEfficiency.** A standard
  Refinery (0.8×) turns Iron ore at 0.7 × 0.8 = **0.56** — i.e. 21 kg of iron
  ingot needs 37.5 kg of ore. This is the documented "Realistic" behaviour.
- **Effective ingot cost = recipe ÷ Assembler-Efficiency world setting**
  (×1 Realistic / ×3 / ×10). Default ×1 = full cost.
- **Refine time = oreKg × baseTime ÷ RefineSpeed; assemble time = baseTime ÷
  AssemblySpeed.** Refine time is the headline "time to gather" metric; assembly
  time is secondary (a ship is refinery-bound, not assembler-bound).

### Flagged / unverified values

These carry a best-effort value but could **not** be confirmed to full
certainty. Confirm against the local game's `.sbc` files if exactness matters.

1. **Uranium refine ratio** — archive `0.007` (0.7%) vs current wiki `0.01`
   (1%). Using **0.7%**. Uranium is fuel, not a component input, so this does
   **not** affect any build-cost ore total; it exists in the table only for
   completeness.
2. **Stone / Gravel** — Stone refining is a multi-output recipe (Gravel + trace
   Fe/Ni/Si). Only the **Gravel path** (`0.9`, consumed via Reactor components)
   is modeled; the trace metals are unmodeled. Minor: Stone appears only in the
   Reactor Component recipe.
3. **Solar Cell recipe** — the archive lists `10 Ni / 8 Si`; solar was reworked
   and the current wiki lists **`4 Ni / 6 Si`**. Using the current value.
4. **Basic Refinery multipliers** — taken from the current wiki
   (**0.65× speed / 0.7× yield**), superseding the archive's "Blast Furnace"
   (1.6 / 0.9). Validated by the current combined iron figure (0.7 × 0.7 = 0.49).
5. **Superconductor recipe** — using `10 Fe / 2 Au`. The current game may add
   **~3 Co**; the cobalt term is omitted pending confirmation, so Superconductor
   cost is a slight *under*-estimate if the Co term is real.
6. **Assembly base times** for Metal Grid / Reactor Component / Solar Cell are
   archive placeholders (`likely`). They affect only the secondary *assemble
   time*, never ore totals.
7. **Hydrogen Engine / Wind Turbine / Survival Kit component lists** — from the
   current wiki (`likely`), not the 2019 archive (those blocks postdate it).
8. **Survival-kit refining multipliers** are unconfirmed and therefore **not**
   offered as a refinery preset (only the full Refinery and Basic Refinery are).
9. **DLC / unlisted blocks** — blocks with no `<Components>` row in the dataset
   (most lights, sensors, beacons, antennas, conveyors, landing gear,
   logic/control blocks, and DLC-exclusive blocks) are reported by the engine as
   **"cost unknown"**, never costed as zero. Reskin/variant blocks that are
   stat-identical to a base block (`*SciFi`, `*Warfare2`, `SmallShipWelderReskin`,
   `SmallBlockModularContainer`) map to the base recipe via `BLOCK_COST_ALIASES`.
