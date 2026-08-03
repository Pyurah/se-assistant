import { Logger, type LogLevel, consoleJsonSink } from './logger';

export * from './logger';

/**
 * Resolve the log level. In the browser build, Vite inlines `import.meta.env`.
 * We read it defensively so the module also works in plain Node (tests, a
 * future headless build) where `import.meta.env` is undefined.
 */
function resolveLevel(): LogLevel {
  const env = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> })
    .env;
  const fromEnv = env?.['VITE_LOG_LEVEL'];
  const isDev = env?.['DEV'] === true || env?.['MODE'] === 'development';
  const validLevels: readonly LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
  if (typeof fromEnv === 'string' && validLevels.includes(fromEnv as LogLevel)) {
    return fromEnv as LogLevel;
  }
  return isDev ? 'debug' : 'info';
}

/**
 * The application root logger. Create child loggers per module/feature:
 *
 *   const log = logger.child({ module: 'twr' });
 *   log.info('computed twr', { planet: 'earthlike', twr: 2.31 });
 */
export const logger = new Logger({
  level: resolveLevel(),
  bindings: { app: 'se-assistant' },
  sinks: [consoleJsonSink],
});
