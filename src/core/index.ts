/**
 * Calc engine — public surface.
 *
 * Platform-agnostic (pure TypeScript, zero DOM/React). This is the core that a
 * future Tauri build would wrap. It currently exports the logging & audit
 * infrastructure plus the shared domain types; the TWR / mass / power / power
 * calculation modules and the blueprint parser land in roadmap Phase 1.
 */
export * from './logger';
export * from './audit';
export * from './types';
export * from './blueprint';
export * from './engine';
