/**
 * Shared blueprint file-read + parse helper for the UI.
 *
 * Both the Analyze import screen and the Estimate-mode "seed from a blueprint"
 * dropzone need the same drag/drop → read text → `parseBlueprint` flow. This
 * centralizes it so the two entry points can't drift. It returns the parsed
 * design + report (or a friendly error), leaving each caller to decide what to
 * do with it (populate the design store, or seed the estimator directly).
 *
 * File bytes never leave the browser — the read is a local `File.text()`.
 */
import { parseBlueprint, BlueprintParseError, logger, type ParseResult } from '@core';

const log = logger.child({ module: 'blueprint-import' });

/** Outcome of reading + parsing a dropped/picked file. */
export type BlueprintReadResult =
  | { readonly ok: true; readonly result: ParseResult; readonly fileName: string }
  | { readonly ok: false; readonly error: string; readonly fileName: string };

const FRIENDLY_FALLBACK =
  'Something went wrong reading that file. Make sure it is an exported .sbc blueprint.';

/**
 * Read a blueprint file and parse it. Never throws — a read or parse failure
 * resolves to `{ ok: false, error }` with a user-facing message.
 *
 * @param file     the dropped/picked file
 * @param planetId the planet to evaluate the parsed design against
 */
export async function readBlueprintFile(
  file: File,
  planetId: string,
): Promise<BlueprintReadResult> {
  let text: string;
  try {
    text = await file.text();
  } catch (err) {
    log.error('failed to read blueprint file', {
      fileName: file.name,
      err,
      ai: {
        actionable: true,
        suggestion: 'Ask the user to re-select the file; it may have been moved or locked.',
        severity_reason: 'Cannot import a file whose bytes are unreadable.',
      },
    });
    return { ok: false, error: FRIENDLY_FALLBACK, fileName: file.name };
  }

  try {
    const result = parseBlueprint(text, { planetId });
    return { ok: true, result, fileName: file.name };
  } catch (err) {
    const error = err instanceof BlueprintParseError ? err.message : FRIENDLY_FALLBACK;
    log.error('failed to parse blueprint file', {
      fileName: file.name,
      err,
      ai: {
        actionable: true,
        suggestion: 'Surface the friendly message; let the user pick a different file.',
        severity_reason: 'A failed parse leaves the user with no design to work from.',
      },
    });
    return { ok: false, error, fileName: file.name };
  }
}
