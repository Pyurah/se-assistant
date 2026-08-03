/**
 * Data layer — public surface.
 *
 * Pure, serializable Space Engineers block and planet data plus the schema
 * that types it. No React, no DOM. This layer is safe to import from the calc
 * engine (`src/core`) and from any future headless/Tauri build.
 */
export * from './schema';
export * from './dlc';
export * from './planets';
export * from './blocks';
export * from './functional-blocks';
export * from './fuel-constants';
