/**
 * Design store — the single source of UI truth for the analysis screen.
 *
 * Holds the imported {@link ShipDesign}, the selected planet, the cargo
 * loadout, the last {@link BlueprintReport}, and the async import status. The
 * pure calc engine (`massSummary` / `powerSummary` / `liftAnalysis`) is NOT
 * cached here — it is cheap and derived on demand by `useAnalysis` from the
 * current design + planet, so every planet/cargo change recomputes correctly
 * with no stale state to invalidate.
 *
 * Side effects (parsing, logging, audit) live in the actions; components stay
 * declarative. Import errors are caught and surfaced as `status: 'error'` with
 * a friendly message rather than thrown.
 */
import { create } from 'zustand';
import {
  parseBlueprint,
  BlueprintParseError,
  logger,
  createCorrelationId,
  AuditLogger,
  InMemoryAuditStore,
  type ShipDesign,
  type BlueprintReport,
  type CargoLoadout,
} from '@core';

const log = logger.child({ module: 'design-store' });

/** Append-only audit trail for the session (blueprint imports, etc.). */
export const auditStore = new InMemoryAuditStore();
const audit = new AuditLogger(auditStore, logger);

/** Async status of the most recent import attempt. */
export type ImportStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DesignState {
  design: ShipDesign | null;
  report: BlueprintReport | null;
  planetId: string;
  cargo: CargoLoadout;
  status: ImportStatus;
  /** User-facing error message when `status === 'error'`. */
  error: string | null;
  /** Source label (filename or example name) of the current design. */
  sourceName: string | null;

  importBlueprint: (xml: string, sourceName: string) => Promise<void>;
  setPlanet: (planetId: string) => void;
  setCargoFill: (fillFraction: number) => void;
  setCargoDensity: (densityKgPerL: number) => void;
  reset: () => void;
}

/** Default loadout: empty ship, average ore-ish density until the user adjusts. */
const DEFAULT_CARGO: CargoLoadout = { fillFraction: 0, densityKgPerL: 2.0 };

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export const useDesignStore = create<DesignState>((set, get) => ({
  design: null,
  report: null,
  planetId: 'earthlike',
  cargo: DEFAULT_CARGO,
  status: 'idle',
  error: null,
  sourceName: null,

  importBlueprint: async (xml, sourceName) => {
    const correlationId = createCorrelationId();
    set({ status: 'loading', error: null });
    try {
      const { design, report } = parseBlueprint(xml, { planetId: get().planetId });
      // Adopt the design's cargo defaults but keep the user's chosen planet.
      set({
        design: { ...design, planetId: get().planetId, cargo: get().cargo },
        report,
        status: 'ready',
        error: null,
        sourceName,
      });
      log.info('blueprint imported into store', {
        correlationId,
        name: design.name,
        matched: report.matchedBlocks,
        total: report.totalBlocks,
      });
      // Best-effort audit trail; never let a logging failure break import.
      try {
        await audit.record({
          action: 'blueprint.import',
          entityType: 'blueprint',
          entityId: design.id,
          after: {
            name: design.name,
            gridSize: design.gridSize,
            blocks: design.blocks.length,
          },
          metadata: {
            sourceName,
            gridCount: report.gridCount,
            totalBlocks: report.totalBlocks,
            matchedBlocks: report.matchedBlocks,
            unrecognized: report.unrecognizedSubtypes.length,
          },
          correlationId,
        });
      } catch {
        /* audit sink swallows its own errors; nothing actionable here */
      }
    } catch (err) {
      const message =
        err instanceof BlueprintParseError
          ? err.message
          : 'Something went wrong reading that file. Make sure it is an exported .sbc blueprint.';
      log.error('blueprint import failed in store', {
        correlationId,
        err,
        sourceName,
        ai: {
          actionable: true,
          suggestion:
            'Surface the friendly message and let the user pick a different file or load the example.',
          severity_reason: 'A failed import leaves the user with no design to analyze.',
        },
      });
      set({ status: 'error', error: message });
    }
  },

  setPlanet: (planetId) => {
    const { design } = get();
    set({
      planetId,
      ...(design ? { design: { ...design, planetId } } : {}),
    });
  },

  setCargoFill: (fillFraction) => {
    const fill = clamp01(fillFraction);
    const cargo: CargoLoadout = { ...get().cargo, fillFraction: fill };
    const { design } = get();
    set({ cargo, ...(design ? { design: { ...design, cargo } } : {}) });
  },

  setCargoDensity: (densityKgPerL) => {
    const density = Math.max(0, densityKgPerL);
    const cargo: CargoLoadout = { ...get().cargo, densityKgPerL: density };
    const { design } = get();
    set({ cargo, ...(design ? { design: { ...design, cargo } } : {}) });
  },

  reset: () =>
    set({
      design: null,
      report: null,
      status: 'idle',
      error: null,
      sourceName: null,
      cargo: DEFAULT_CARGO,
    }),
}));
