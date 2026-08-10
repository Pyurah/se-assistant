/**
 * Conveyor large-port requirements — curated.
 *
 * Space Engineers has NO published conveyor *transfer rate*: in-network item
 * movement is effectively instantaneous. The only real gate is **port size** —
 * a "large" conveyor port can only connect to a large conveyor line (Conveyor
 * Tube / Conveyor / hub large variants), whereas small ports accept small OR
 * large lines. A block wired only through small tubes therefore CANNOT feed a
 * large-port block, and large items (assembled components, tools, some ores in
 * bulk) can only pass through large lines.
 *
 * Port size is NOT a clean definition-file attribute — it lives in each block's
 * mountpoints/model, not a boolean like `IsConveyorSupport`. So this table is
 * **hand-curated** from the community wiki's small-vs-large conveyor rules, and
 * every entry is flagged as curated (uncertain) per the data-audit convention.
 * It is deliberately conservative: it lists the well-established large-port
 * blocks (production, big storage, connectors/collectors, large drills) rather
 * than guessing at edge cases.
 *
 * This drives a **presence** audit (does the grid carry any large-port conveyor
 * pieces to feed these blocks?), NOT a routed-connectivity solve — the blueprint
 * gives geometry but not wire topology. That simplification is documented in
 * docs/data-audit.md alongside the stopping-distance and bottleneck caveats.
 *
 * PURE — no React, no DOM.
 */

/** Why a block needs a large conveyor port, for the audit's per-block reason. */
export type LargePortReason =
  | 'production' // refineries/assemblers pull ingots/components in bulk
  | 'bulk-storage' // large cargo containers
  | 'docking' // connectors/collectors transfer whole inventories
  | 'mining' // drills eject mined stone/ore in volume
  | 'gas'; // O2/H2 generators consume ice and output gas in bulk

/**
 * SubtypeIds of blocks that require a **large conveyor port** to move their
 * inventory. Keyed by the game SubtypeId (matches blueprint block entries).
 *
 * Sourced from the Space Engineers wiki conveyor rules for game version
 * 1.210.012. Curated/uncertain — see docs/data-audit.md. Reskin/variant
 * SubtypeIds (…Reskin, …Industrial, …Warfare2) are included where the game
 * ships them so imported ships resolve without an alias table.
 */
export const LARGE_PORT_BLOCKS: ReadonlyMap<string, LargePortReason> = new Map([
  // Production — refineries, furnaces, assemblers.
  ['LargeRefinery', 'production'],
  ['LargeRefineryIndustrial', 'production'],
  ['Blast Furnace', 'production'],
  ['LargeAssembler', 'production'],
  ['LargeAssemblerIndustrial', 'production'],
  ['BasicAssembler', 'production'],
  // Gas — O2/H2 generators (large grid moves ice/bottles through large ports).
  ['OxygenGenerator', 'gas'],
  // Bulk storage — large cargo containers.
  ['LargeBlockLargeContainer', 'bulk-storage'],
  ['SmallBlockLargeContainer', 'bulk-storage'],
  // Docking / gathering — connectors and collectors transfer full inventories.
  ['Connector', 'docking'],
  ['Collector', 'docking'],
  ['CollectorFlat', 'docking'],
  // Mining — drills eject volume; the large drill uses a large port.
  ['LargeBlockDrill', 'mining'],
  ['LargeBlockDrillReskin', 'mining'],
]);

/**
 * SubtypeIds of conveyor pieces that carry a **large** line — the plumbing that
 * can actually feed a {@link LARGE_PORT_BLOCKS} block. Small tubes/hubs are
 * intentionally excluded: they cannot connect to a large port.
 *
 * Curated from the vanilla conveyor set (base + Logistics). Uncertain entries
 * flagged in docs/data-audit.md.
 */
export const LARGE_PORT_CONVEYORS: ReadonlySet<string> = new Set([
  // Large-grid large conveyor line.
  'LargeBlockConveyor',
  'ConveyorTube',
  'ConveyorTubeCurved',
  'ConveyorTubeT',
  'ConveyorTubeDuct',
  'ConveyorFrameMedium',
  'LargeBlockConveyorPipeJunction',
  // Small-grid large conveyor line (the "big"/medium small-grid tubes — these
  // carry a large line; the plain `ConveyorTubeSmall` is small-port only and is
  // deliberately excluded).
  'SmallBlockConveyor',
  'SmallShipConveyorHub',
  'ConveyorTubeCurvedMedium',
  'ConveyorTubeMedium',
]);

/** True when a block's SubtypeId needs a large conveyor port to be fed. */
export function requiresLargePort(subtypeId: string): boolean {
  return LARGE_PORT_BLOCKS.has(subtypeId);
}

/** The curated reason a block needs a large port, or undefined if it doesn't. */
export function largePortReason(subtypeId: string): LargePortReason | undefined {
  return LARGE_PORT_BLOCKS.get(subtypeId);
}

/** True when a conveyor piece carries a large line (can feed a large port). */
export function isLargePortConveyor(subtypeId: string): boolean {
  return LARGE_PORT_CONVEYORS.has(subtypeId);
}
