/**
 * Structured, AI-parseable logger for a browser SPA.
 *
 * Why not pino directly?
 * ----------------------
 * pino is built around Node streams/transports; in the browser it degrades to
 * `console`. Rather than ship that weight, this is a tiny structured logger
 * with the *same contract* the project standard requires: JSON-shaped log
 * records, real levels, correlation IDs, child loggers, and AI metadata on
 * errors. It lives in `src/core/logger`, the one place `no-console` is relaxed.
 *
 * The logger is transport-agnostic: records are formed as plain objects and
 * handed to pluggable sinks. The default sink writes structured JSON to the
 * console; a future sink could POST to a log endpoint or persist to IndexedDB.
 *
 * This module is platform-agnostic (no DOM, no React) so it works in the calc
 * engine, in web workers, and in a future Tauri build unchanged.
 */

export const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

/**
 * AI-oriented metadata attached to notable (usually error) records so an
 * automated agent can triage without a human in the loop.
 */
export interface AiMetadata {
  /** Can an automated system act on this without a human? */
  actionable: boolean;
  /** What should be done about it? */
  suggestion?: string;
  /** Why was this severity chosen? */
  severity_reason?: string;
}

export interface LogRecord {
  /** ISO-8601 timestamp. */
  time: string;
  level: LogLevel;
  levelValue: number;
  msg: string;
  /** Correlation id shared across a logical operation / request. */
  correlationId?: string;
  /** Static bindings from the (child) logger, e.g. `{ module: 'twr' }`. */
  bindings: Record<string, unknown>;
  /** Per-call structured context. */
  context?: Record<string, unknown>;
  /** Present for error/fatal records when available. */
  err?: {
    name: string;
    message: string;
    stack?: string | undefined;
  };
  ai?: AiMetadata;
}

/** A sink receives fully-formed records. Sinks must not throw. */
export type LogSink = (record: LogRecord) => void;

export interface LoggerOptions {
  level?: LogLevel;
  bindings?: Record<string, unknown>;
  correlationId?: string | undefined;
  sinks?: LogSink[];
}

/** Extra fields accepted per log call. */
export interface LogCallOptions {
  err?: unknown;
  ai?: AiMetadata;
  correlationId?: string | undefined;
  [key: string]: unknown;
}

function normalizeError(err: unknown): LogRecord['err'] {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (err === undefined) return undefined;
  const message =
    typeof err === 'string'
      ? err
      : typeof err === 'object'
        ? JSON.stringify(err)
        : // eslint-disable-next-line @typescript-eslint/no-base-to-string -- primitives only reach here
          String(err);
  return { name: 'NonError', message };
}

/**
 * Default sink: one structured JSON line per record on the appropriate console
 * method. Errors go to `console.error`, warnings to `console.warn`, else log.
 */
export const consoleJsonSink: LogSink = (record) => {
  const line = JSON.stringify(record);
  if (record.levelValue >= LOG_LEVELS.error) {
    console.error(line);
  } else if (record.levelValue >= LOG_LEVELS.warn) {
    console.warn(line);
  } else {
    console.log(line);
  }
};

export class Logger {
  private readonly level: LogLevel;
  private readonly bindings: Record<string, unknown>;
  private readonly correlationId?: string | undefined;
  private readonly sinks: LogSink[];

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.bindings = options.bindings ?? {};
    this.correlationId = options.correlationId;
    this.sinks = options.sinks ?? [consoleJsonSink];
  }

  /** Create a child logger that inherits config and adds static bindings. */
  child(bindings: Record<string, unknown>, correlationId?: string): Logger {
    return new Logger({
      level: this.level,
      bindings: { ...this.bindings, ...bindings },
      correlationId: correlationId ?? this.correlationId,
      sinks: this.sinks,
    });
  }

  private isEnabled(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private emit(level: LogLevel, msg: string, opts: LogCallOptions = {}): void {
    if (!this.isEnabled(level)) return;

    const { err, ai, correlationId, ...context } = opts;
    const record: LogRecord = {
      time: new Date().toISOString(),
      level,
      levelValue: LOG_LEVELS[level],
      msg,
      bindings: this.bindings,
    };

    const cid = correlationId ?? this.correlationId;
    if (cid !== undefined) record.correlationId = cid;
    if (Object.keys(context).length > 0) record.context = context;
    const normalizedErr = normalizeError(err);
    if (normalizedErr !== undefined) record.err = normalizedErr;
    if (ai !== undefined) record.ai = ai;

    for (const sink of this.sinks) {
      try {
        sink(record);
      } catch {
        // Sinks must never break the app. Swallow deliberately.
      }
    }
  }

  trace(msg: string, opts?: LogCallOptions): void {
    this.emit('trace', msg, opts);
  }
  debug(msg: string, opts?: LogCallOptions): void {
    this.emit('debug', msg, opts);
  }
  info(msg: string, opts?: LogCallOptions): void {
    this.emit('info', msg, opts);
  }
  warn(msg: string, opts?: LogCallOptions): void {
    this.emit('warn', msg, opts);
  }
  error(msg: string, opts?: LogCallOptions): void {
    this.emit('error', msg, opts);
  }
  fatal(msg: string, opts?: LogCallOptions): void {
    this.emit('fatal', msg, opts);
  }
}

/**
 * Generate a correlation id. Uses crypto.randomUUID when available (browsers,
 * modern Node) and falls back to a timestamped random string otherwise.
 */
export function createCorrelationId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
