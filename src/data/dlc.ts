import type { DlcInfo } from './schema';

/**
 * Space Engineers content packs (base game + DLCs), in release order.
 *
 * Drives the "restrict catalogue to owned DLC" filter. `addsFunctionalBlocks`
 * is false for cosmetic-only packs (armor/character skins, soundtracks) that
 * don't introduce blocks affecting thrust/mass/power math; it's true for packs
 * that add functional blocks (even if those are stat-identical reskins of base
 * blocks) so the ownership UI mirrors the store.
 *
 * VERIFIED against v1.210 via the Steam DLC page and the wiki's "Comparison of
 * DLC Packs". Note: there is no standalone "Fields" DLC — the pack is
 * "Fieldwork". The functional Prosperity *update* content (Prototech blocks) is
 * free base-game; the paid Prosperity *pack* is cosmetic/decorative only.
 */
export const DLCS: readonly DlcInfo[] = [
  { id: 'base', displayName: 'Base Game', addsFunctionalBlocks: true },
  { id: 'deluxe', displayName: 'Deluxe Edition', addsFunctionalBlocks: false },
  { id: 'decorative-1', displayName: 'Decorative Pack #1', addsFunctionalBlocks: true },
  { id: 'style', displayName: 'Style Pack', addsFunctionalBlocks: false },
  { id: 'economy', displayName: 'Economy Deluxe', addsFunctionalBlocks: true },
  { id: 'decorative-2', displayName: 'Decorative Pack #2', addsFunctionalBlocks: true },
  { id: 'frostbite', displayName: 'Frostbite', addsFunctionalBlocks: true },
  { id: 'sparks-of-the-future', displayName: 'Sparks of the Future', addsFunctionalBlocks: true },
  { id: 'wasteland', displayName: 'Wasteland', addsFunctionalBlocks: true },
  { id: 'warfare-1', displayName: 'Warfare 1: Field Engineer', addsFunctionalBlocks: true },
  { id: 'heavy-industry', displayName: 'Heavy Industry', addsFunctionalBlocks: true },
  { id: 'warfare-2', displayName: 'Warfare 2: Broadside', addsFunctionalBlocks: true },
  { id: 'automatons', displayName: 'Automatons', addsFunctionalBlocks: true },
  { id: 'decorative-3', displayName: 'Decorative Pack #3', addsFunctionalBlocks: true },
  { id: 'anniversary-10yr', displayName: '10 Year Anniversary Pack', addsFunctionalBlocks: false },
  { id: 'signal', displayName: 'Signal Pack', addsFunctionalBlocks: true },
  { id: 'contact', displayName: 'Contact Pack', addsFunctionalBlocks: true },
  { id: 'fieldwork', displayName: 'Fieldwork Pack', addsFunctionalBlocks: true },
  { id: 'core-systems', displayName: 'Core Systems Pack', addsFunctionalBlocks: true },
  { id: 'economy-2', displayName: 'Economy 2 Pack', addsFunctionalBlocks: true },
  { id: 'prosperity', displayName: 'Prosperity Pack', addsFunctionalBlocks: false },
  { id: 'scrap-race', displayName: 'Scrap Race Pack', addsFunctionalBlocks: true },
  { id: 'apex-survival', displayName: 'Apex Survival Pack', addsFunctionalBlocks: true },
] as const;

/** Convenience lookup by id. */
export const DLCS_BY_ID: Readonly<Record<string, DlcInfo>> = Object.fromEntries(
  DLCS.map((d) => [d.id, d]),
);
