/**
 * App-mode store — which top-level workflow is active.
 *
 * The app has two independent modes: "Analyze" a finished blueprint (import a
 * `.sbc`) and "Estimate" a build from scratch (declare essentials, size the
 * rest). This tiny store holds only the active mode and persists the choice to
 * localStorage so a reload keeps the user where they were. It is deliberately
 * separate from the two feature stores (design / estimator) so switching modes
 * never touches feature state.
 */
import { create } from 'zustand';
import { logger } from '@core';

const log = logger.child({ module: 'app-mode-store' });

export type AppMode = 'analyze' | 'estimate';

const STORAGE_KEY = 'se-assistant:app-mode';

/** Read the persisted mode, defaulting to analyze. Never throws. */
function loadMode(): AppMode {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw === 'estimate' || raw === 'analyze' ? raw : 'analyze';
  } catch {
    return 'analyze';
  }
}

/** Persist the mode; a storage failure is non-fatal (private mode, quota). */
function saveMode(mode: AppMode): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, mode);
  } catch {
    log.debug('could not persist app mode', { mode });
  }
}

export interface AppModeState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

export const useAppModeStore = create<AppModeState>((set) => ({
  mode: loadMode(),
  setMode: (mode) => {
    saveMode(mode);
    set({ mode });
  },
}));
