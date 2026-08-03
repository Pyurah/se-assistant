/**
 * Parse a Space Engineers exported blueprint (`bp.sbc`) into a {@link ShipDesign}.
 *
 * Pipeline: XML text → `fast-xml-parser` → Zod-validated tree → resolve each
 * block against the curated dataset → aggregate identical blocks into
 * quantities → emit a `ShipDesign` plus a diagnostics {@link BlueprintReport}.
 *
 * Design choices:
 *   - Multi-grid blueprints (subgrids on rotors/pistons) are supported; blocks
 *     from every `CubeGrid` are merged. The primary grid's size and name label
 *     the design. Mixed grid sizes are reported, not silently flattened.
 *   - Unrecognized (modded) subtypes are kept as `source: 'blueprint'`
 *     placeholders (see `resolveBlock`) and counted in the report, never
 *     dropped.
 *   - Thruster orientation is resolved to a thrust {@link Direction} via
 *     `flip(BlockOrientation.Forward)` — the flame exits the block's Forward
 *     face, so the grid is pushed the opposite way (verified against the game's
 *     `Base6Directions.GetFlippedDirection`). A thruster whose orientation
 *     can't be parsed is flagged and left without a direction (excluded from
 *     directional TWR rather than mis-attributed).
 *
 * KNOWN APPROXIMATION (subgrid thrust frames): each subgrid defines its thrust
 * in its OWN local frame, which may be rotated relative to the main grid via
 * that grid's `PositionAndOrientation`. This parser buckets every grid's thrust
 * by its own local axes without rotating subgrid vectors into the main frame —
 * i.e. it assumes subgrids are axis-aligned with the main grid. That holds for
 * the common case (thrusters on the main grid) but can misattribute directional
 * thrust for thrusters mounted on a rotated rotor/hinge subgrid. `mixedGridSizes`
 * and `gridCount > 1` in the report signal when this approximation is in play.
 * Proper frame rotation is a future enhancement.
 */

import { XMLParser } from 'fast-xml-parser';
import { logger } from '../logger';
import type { ShipDesign, DesignBlock, Vec3 } from '../types';
import type { GridSize, Direction } from '../../data/schema';
import {
  blueprintFileSchema,
  toArray,
  subtypeNameToString,
  type ParsedCubeGrid,
  type ParsedCubeBlock,
} from './schema';
import { resolveBlock } from './resolve-block';
import { thrustDirectionFromForward } from './orientation';

const log = logger.child({ module: 'blueprint-parser' });

/** Diagnostics surfaced alongside a parsed design. */
export interface BlueprintReport {
  /** Number of `CubeGrid` elements in the blueprint (>1 = has subgrids). */
  readonly gridCount: number;
  /** Total placed blocks read across all grids. */
  readonly totalBlocks: number;
  /** Blocks whose subtype matched the curated dataset. */
  readonly matchedBlocks: number;
  /** Distinct unrecognized subtypes (modded / unknown), for user display. */
  readonly unrecognizedSubtypes: readonly string[];
  /** Thrusters whose orientation could not be parsed (excluded from directional TWR). */
  readonly unorientedThrusters: number;
  /** True when grids of different sizes were merged. */
  readonly mixedGridSizes: boolean;
}

export interface ParseResult {
  readonly design: ShipDesign;
  readonly report: BlueprintReport;
}

/** Thrown when the input is not a recognizable ship blueprint. */
export class BlueprintParseError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'BlueprintParseError';
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Keep xsi:type etc. as plain attribute names (no namespace stripping) so
  // `@_xsi:type` is addressable.
  removeNSPrefix: false,
  parseAttributeValue: false,
  trimValues: true,
});

/** Coerce a DisplayName field (string | number | empty object) to a string. */
function displayNameToString(v: ParsedCubeGrid['DisplayName'], fallback: string): string {
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  if (typeof v === 'number') return String(v);
  return fallback;
}

/** Normalize `GridSizeEnum` ("Small"/"Large") to our {@link GridSize}. */
function gridSizeFromEnum(raw: string | undefined): GridSize {
  return raw?.trim().toLowerCase() === 'small' ? 'small' : 'large';
}

/**
 * Parse blueprint XML text into a {@link ShipDesign} and diagnostics.
 *
 * @param xml       raw `bp.sbc` file contents
 * @param options   optional design id/planet defaults
 * @throws BlueprintParseError when the XML is malformed or not a ship blueprint
 */
export function parseBlueprint(
  xml: string,
  options: { id?: string; planetId?: string } = {},
): ParseResult {
  let raw: unknown;
  try {
    raw = parser.parse(xml);
  } catch (err) {
    log.error('blueprint XML failed to parse', {
      error: err,
      ai: {
        actionable: true,
        suggestion: 'The file is not well-formed XML; confirm it is an exported bp.sbc.',
        severity_reason: 'Malformed input blocks all downstream parsing.',
      },
    });
    throw new BlueprintParseError('Blueprint is not well-formed XML.', err);
  }

  const validated = blueprintFileSchema.safeParse(raw);
  if (!validated.success) {
    log.error('blueprint structure not recognized', {
      error: validated.error.flatten(),
      ai: {
        actionable: true,
        suggestion: 'Expected Definitions→ShipBlueprints→ShipBlueprint→CubeGrids→CubeGrid.',
        severity_reason: 'Missing required blueprint structure; cannot extract blocks.',
      },
    });
    throw new BlueprintParseError('File does not look like a Space Engineers ship blueprint.');
  }

  const shipBp = validated.data.Definitions.ShipBlueprints.ShipBlueprint;
  const grids = toArray<ParsedCubeGrid>(shipBp.CubeGrids.CubeGrid);
  if (grids.length === 0) {
    throw new BlueprintParseError('Blueprint contains no grids.');
  }

  const primaryGridSize = gridSizeFromEnum(grids[0]!.GridSizeEnum);
  const designName = displayNameToString(grids[0]!.DisplayName, 'Imported Blueprint');

  // Aggregate identical (definition + thrust direction) blocks into quantities,
  // collecting each instance's grid-cell position for center-of-mass math.
  // Key must distinguish thrust directions so up/down thrusters don't merge.
  const aggregate = new Map<string, { block: DesignBlock; count: number; positions: Vec3[] }>();
  const unrecognized = new Set<string>();
  let totalBlocks = 0;
  let matchedBlocks = 0;
  let unorientedThrusters = 0;
  let mixedGridSizes = false;

  for (const grid of grids) {
    const gridSize = gridSizeFromEnum(grid.GridSizeEnum);
    if (gridSize !== primaryGridSize) mixedGridSizes = true;

    const blocks = toArray<ParsedCubeBlock>(grid.CubeBlocks?.MyObjectBuilder_CubeBlock);
    for (const cb of blocks) {
      totalBlocks += 1;
      const xsiType = cb['@_xsi:type'] ?? '';
      const subtype = subtypeNameToString(cb.SubtypeName);
      const { definition, matched } = resolveBlock(subtype, xsiType, gridSize);
      if (matched) matchedBlocks += 1;
      else unrecognized.add(subtype.length > 0 ? subtype : xsiType.replace(/^.*MyObjectBuilder_/, ''));

      let thrustDirection: Direction | undefined;
      if (definition.category === 'thruster') {
        thrustDirection = thrustDirectionFromForward(cb.BlockOrientation?.['@_Forward']);
        if (thrustDirection === undefined) unorientedThrusters += 1;
      }

      // Grid-cell position from <Min> (defaults to origin when absent).
      const pos: Vec3 = {
        x: cb.Min?.['@_x'] ?? 0,
        y: cb.Min?.['@_y'] ?? 0,
        z: cb.Min?.['@_z'] ?? 0,
      };

      const key = `${definition.id}|${thrustDirection ?? ''}`;
      const existing = aggregate.get(key);
      if (existing) {
        existing.count += 1;
        existing.positions.push(pos);
      } else {
        // Build conditionally: with exactOptionalPropertyTypes we omit
        // thrustDirection entirely rather than setting it to undefined.
        const block: DesignBlock =
          thrustDirection === undefined
            ? { definition, quantity: 1 }
            : { definition, quantity: 1, thrustDirection };
        aggregate.set(key, { block, count: 1, positions: [pos] });
      }
    }
  }

  const designBlocks: DesignBlock[] = [...aggregate.values()].map(({ block, count, positions }) => ({
    ...block,
    quantity: count,
    positions,
  }));

  const design: ShipDesign = {
    id: options.id ?? `bp-${designName.replace(/\s+/g, '-').toLowerCase()}`,
    name: designName,
    gridSize: primaryGridSize,
    blocks: designBlocks,
    planetId: options.planetId ?? 'earthlike',
    cargo: { fillFraction: 0, densityKgPerL: 2.0 },
  };

  const report: BlueprintReport = {
    gridCount: grids.length,
    totalBlocks,
    matchedBlocks,
    unrecognizedSubtypes: [...unrecognized],
    unorientedThrusters,
    mixedGridSizes,
  };

  log.info('blueprint parsed', {
    name: designName,
    gridSize: primaryGridSize,
    ...report,
    unrecognizedSubtypes: report.unrecognizedSubtypes.length,
  });

  return { design, report };
}
