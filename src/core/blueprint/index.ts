/**
 * Blueprint import — public surface.
 *
 * Parse an exported Space Engineers `bp.sbc` into a typed {@link ShipDesign}
 * the calc engine can analyze, plus a diagnostics report.
 */
export { parseBlueprint, BlueprintParseError } from './parse';
export type { ParseResult, BlueprintReport } from './parse';
export { resolveBlock } from './resolve-block';
export type { ResolvedBlock } from './resolve-block';
export { thrustDirectionFromForward, parseAxis } from './orientation';
