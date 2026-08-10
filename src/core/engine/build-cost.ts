/**
 * Build-cost calculation for a ship design.
 *
 * Answers "what does it take to build this ship?" by walking the manufacturing
 * chain in reverse: blocks → components → ingots → raw ore.
 *
 *   1. Each design block contributes its `<Components>` list × quantity.
 *   2. Each component contributes its ingot recipe × count (÷ the world's
 *      Assembler-Efficiency multiplier, which cheapens ingot cost).
 *   3. Each ingot total is refined back to raw ore via the ore→ingot yield
 *      (÷ the refinery's MaterialEfficiency).
 *
 * Time estimates (refine + assemble) use the chosen refinery/assembler speed
 * multipliers. Refine time is the headline "how long to gather" number; a full
 * ship is refinery-bound far more than assembler-bound.
 *
 * Honesty over false precision (project principle): a block with no recipe in
 * the dataset is reported in `unknownBlocks`, never silently costed as zero. A
 * consumer can then say "cost known for N of M block types" rather than
 * implying a complete bill of materials.
 *
 * PURE — no React, no DOM. Consumes only a {@link ShipDesign} and the pure
 * manufacturing dataset.
 */

import type { ShipDesign } from '../types';
import {
  BLOCK_COST_ALIASES,
  COMPONENT_RECIPES,
  REFINE_RECIPES,
  DEFAULT_REFINERY,
  DEFAULT_ASSEMBLER,
  DEFAULT_ASSEMBLER_EFFICIENCY,
  type ComponentId,
  type Metal,
  type BlockComponentCost,
  type RefineryPreset,
  type AssemblerPreset,
} from '../../data/manufacturing';
import { ALL_BLOCK_COSTS } from '../../data/all-block-costs';

/** Tunable manufacturing settings; every field defaults to the Realistic 1× world. */
export interface BuildCostOptions {
  /** Refinery whose speed/efficiency shapes ore totals + refine time. */
  readonly refinery?: RefineryPreset;
  /** Assembler whose speed shapes assemble time. */
  readonly assembler?: AssemblerPreset;
  /**
   * World Assembler-Efficiency multiplier (x1 Realistic / x3 / x10). Divides
   * every component's ingot cost. Clamped to ≥ 1.
   */
  readonly assemblerEfficiency?: number;
}

/** A block the dataset has no recipe for — surfaced, never costed as zero. */
export interface UnknownBlock {
  readonly subtypeId: string;
  readonly displayName: string;
  readonly quantity: number;
}

/** The full bill of materials + time estimate for a design. */
export interface BuildCost {
  /** Total count of each component across every recognized block. */
  readonly components: Partial<Record<ComponentId, number>>;
  /** Effective ingot totals (kg), after the Assembler-Efficiency divisor. */
  readonly ingots: Partial<Record<Metal, number>>;
  /** Raw ore totals (kg), after the refinery's MaterialEfficiency. */
  readonly ore: Partial<Record<Metal, number>>;
  /** Seconds to refine all ore at the chosen refinery speed. */
  readonly refineTimeSeconds: number;
  /** Seconds to assemble all components at the chosen assembler speed. */
  readonly assembleTimeSeconds: number;
  /** Blocks with no recipe in the dataset (modded, or not yet transcribed). */
  readonly unknownBlocks: readonly UnknownBlock[];
  /** Count of design block-types whose cost is known / total block-types. */
  readonly knownBlockTypes: number;
  readonly totalBlockTypes: number;
}

/** Resolve a block's component recipe, following reskin/variant aliases. */
function recipeFor(subtypeId: string): BlockComponentCost | undefined {
  return ALL_BLOCK_COSTS[subtypeId] ?? ALL_BLOCK_COSTS[BLOCK_COST_ALIASES[subtypeId] ?? ''];
}

/**
 * Total each component across the whole design. Blocks with no recipe are
 * collected into `unknownBlocks` instead of contributing zero.
 */
function componentTotals(design: ShipDesign): {
  components: Partial<Record<ComponentId, number>>;
  unknownBlocks: UnknownBlock[];
  knownBlockTypes: number;
} {
  const components: Partial<Record<ComponentId, number>> = {};
  const unknownBlocks: UnknownBlock[] = [];
  let knownBlockTypes = 0;

  for (const b of design.blocks) {
    const recipe = recipeFor(b.definition.subtypeId);
    if (!recipe) {
      unknownBlocks.push({
        subtypeId: b.definition.subtypeId,
        displayName: b.definition.displayName,
        quantity: b.quantity,
      });
      continue;
    }
    knownBlockTypes += 1;
    for (const [comp, per] of Object.entries(recipe) as [ComponentId, number][]) {
      components[comp] = (components[comp] ?? 0) + per * b.quantity;
    }
  }

  return { components, unknownBlocks, knownBlockTypes };
}

/**
 * Convert component totals to effective ingot totals (kg), applying the
 * Assembler-Efficiency divisor, and accumulate total assemble time.
 */
function ingotTotals(
  components: Partial<Record<ComponentId, number>>,
  assembler: AssemblerPreset,
  assemblerEfficiency: number,
): { ingots: Partial<Record<Metal, number>>; assembleTimeSeconds: number } {
  const ingots: Partial<Record<Metal, number>> = {};
  let assembleTimeSeconds = 0;
  const efficiency = Math.max(1, assemblerEfficiency);

  for (const [comp, count] of Object.entries(components) as [ComponentId, number][]) {
    const recipe = COMPONENT_RECIPES[comp];
    assembleTimeSeconds += (recipe.baseTimeSeconds * count) / assembler.assemblySpeed;
    for (const [metal, kg] of Object.entries(recipe.ingots) as [Metal, number][]) {
      ingots[metal] = (ingots[metal] ?? 0) + (kg * count) / efficiency;
    }
  }

  return { ingots, assembleTimeSeconds };
}

/**
 * Refine ingot totals back to raw ore (kg) and accumulate total refine time,
 * both governed by the chosen refinery's yield/speed multipliers.
 *
 * Salvage ingots (`prototech-scrap`) have no `REFINE_RECIPES` entry — they are
 * ground from endgame blocks, never mined. Such ingots are SKIPPED here: they
 * still count toward ingot mass (they are real materials the build consumes),
 * but they contribute zero ore and zero refine time. A consumer can surface the
 * skipped salvage ingot on its own "salvaged, not mined" line.
 */
function oreTotals(
  ingots: Partial<Record<Metal, number>>,
  refinery: RefineryPreset,
): { ore: Partial<Record<Metal, number>>; refineTimeSeconds: number } {
  const ore: Partial<Record<Metal, number>> = {};
  let refineTimeSeconds = 0;

  for (const [metal, ingotKg] of Object.entries(ingots) as [Metal, number][]) {
    const recipe = REFINE_RECIPES[metal];
    if (!recipe) continue; // salvage-only ingot (no ore path) — never fabricate ore
    const effectiveYield = recipe.yieldRatio * refinery.materialEfficiency;
    const oreKg = ingotKg / effectiveYield;
    ore[metal] = (ore[metal] ?? 0) + oreKg;
    refineTimeSeconds += (oreKg * recipe.baseTimeSeconds) / refinery.refineSpeed;
  }

  return { ore, refineTimeSeconds };
}

/**
 * Compute the full build cost of a design: components, ingots, raw ore, and
 * refine/assemble time — under the given (or default Realistic-1×) settings.
 */
export function buildCost(design: ShipDesign, options: BuildCostOptions = {}): BuildCost {
  const refinery = options.refinery ?? DEFAULT_REFINERY;
  const assembler = options.assembler ?? DEFAULT_ASSEMBLER;
  const assemblerEfficiency = options.assemblerEfficiency ?? DEFAULT_ASSEMBLER_EFFICIENCY;

  const { components, unknownBlocks, knownBlockTypes } = componentTotals(design);
  const { ingots, assembleTimeSeconds } = ingotTotals(components, assembler, assemblerEfficiency);
  const { ore, refineTimeSeconds } = oreTotals(ingots, refinery);

  return {
    components,
    ingots,
    ore,
    refineTimeSeconds,
    assembleTimeSeconds,
    unknownBlocks,
    knownBlockTypes,
    totalBlockTypes: design.blocks.length,
  };
}

/** Total ingot mass (kg) across all metals — a quick headline figure. */
export function totalIngotMass(cost: BuildCost): number {
  return Object.values(cost.ingots).reduce((sum, kg) => sum + (kg ?? 0), 0);
}

/** Total raw ore mass (kg) across all metals — the "go mine this much" figure. */
export function totalOreMass(cost: BuildCost): number {
  return Object.values(cost.ore).reduce((sum, kg) => sum + (kg ?? 0), 0);
}

/** True when at least one block in the design had no recipe. */
export function hasUnknownBlocks(cost: BuildCost): boolean {
  return cost.unknownBlocks.length > 0;
}
