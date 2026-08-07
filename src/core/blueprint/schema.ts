/**
 * Zod schema for the raw, parsed blueprint XML tree.
 *
 * This validates the *shape* of the object `fast-xml-parser` produces from a
 * `bp.sbc` — the boundary between untrusted file input and our typed engine.
 * It is deliberately lenient: real blueprints carry dozens of fields we ignore,
 * single vs. multiple children collapse to object-or-array, and older exports
 * omit elements. We validate only what the parser needs and pass the rest
 * through, so a slightly unusual (but valid) blueprint still imports.
 *
 * Parser config assumed by this schema:
 *   - attributes prefixed with `@_` (e.g. `@_Forward`, `@_xsi:type`)
 *   - `isArray` NOT forced, so a lone child is an object and many are an array
 *     (helpers below normalize with `toArray`)
 */

import { z } from 'zod';

/** A value that may be a single item or an array of items → always an array. */
export function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** `<BlockOrientation Forward="Up" Up="Right" />` → attributes only. */
const orientationSchema = z
  .object({
    '@_Forward': z.string().optional(),
    '@_Up': z.string().optional(),
  })
  .passthrough();

/** One `<MyObjectBuilder_CubeBlock xsi:type="…">`. */
const cubeBlockSchema = z
  .object({
    '@_xsi:type': z.string().optional(),
    // Empty `<SubtypeName/>` parses to '' (string) or {} depending on options;
    // accept string, number (rare), or empty object → coerced later.
    SubtypeName: z.union([z.string(), z.number(), z.object({}).passthrough()]).optional(),
    BlockOrientation: orientationSchema.optional(),
    // Present (`true`) on the cockpit the player flagged as the main cockpit;
    // its orientation defines the ship's forward/up for pilot-relative thrust.
    IsMainCockpit: z.union([z.boolean(), z.string()]).optional(),
    Min: z
      .object({ '@_x': z.coerce.number(), '@_y': z.coerce.number(), '@_z': z.coerce.number() })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough();

/** `<CubeGrid>` — a single grid within the blueprint. */
const cubeGridSchema = z
  .object({
    DisplayName: z.union([z.string(), z.number(), z.object({}).passthrough()]).optional(),
    GridSizeEnum: z.string().optional(),
    CubeBlocks: z
      .object({
        MyObjectBuilder_CubeBlock: z
          .union([cubeBlockSchema, z.array(cubeBlockSchema)])
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/** Full `Definitions → ShipBlueprints → ShipBlueprint → CubeGrids → CubeGrid`. */
export const blueprintFileSchema = z
  .object({
    Definitions: z
      .object({
        ShipBlueprints: z
          .object({
            ShipBlueprint: z
              .object({
                CubeGrids: z
                  .object({
                    CubeGrid: z.union([cubeGridSchema, z.array(cubeGridSchema)]),
                  })
                  .passthrough(),
              })
              .passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export type ParsedBlueprintFile = z.infer<typeof blueprintFileSchema>;
export type ParsedCubeGrid = z.infer<typeof cubeGridSchema>;
export type ParsedCubeBlock = z.infer<typeof cubeBlockSchema>;

/** Coerce a SubtypeName field (string | number | empty-object) to a string. */
export function subtypeNameToString(v: ParsedCubeBlock['SubtypeName']): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return ''; // empty `<SubtypeName/>` → empty string
}
