/**
 * Calculation engine — public surface.
 *
 * Pure math on a {@link ShipDesign}: mass/cargo, directional TWR with
 * environment scaling, empty-vs-loaded lift analysis, power budget, and the
 * thruster recommender. Zero DOM/React — safe for the headless/Tauri boundary.
 */
export * from './thruster';
export * from './mass';
export * from './twr';
export * from './power';
export * from './recommend';
export * from './estimate';
export * from './estimate-to-design';
export * from './design-to-estimate';
export * from './fuel';
export * from './motion';
