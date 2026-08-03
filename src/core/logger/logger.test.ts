import { describe, it, expect, vi } from 'vitest';
import {
  Logger,
  LOG_LEVELS,
  createCorrelationId,
  consoleJsonSink,
  type LogRecord,
  type LogSink,
} from './logger';

/** Capture sink: collects records for assertions instead of writing anywhere. */
function captureSink(): { records: LogRecord[]; sink: LogSink } {
  const records: LogRecord[] = [];
  return { records, sink: (r) => records.push(r) };
}

describe('Logger', () => {
  it('emits a structured record with level, message, and bindings', () => {
    const { records, sink } = captureSink();
    const log = new Logger({ level: 'info', bindings: { app: 'test' }, sinks: [sink] });

    log.info('hello', { foo: 'bar' });

    expect(records).toHaveLength(1);
    const rec = records[0]!;
    expect(rec.level).toBe('info');
    expect(rec.levelValue).toBe(LOG_LEVELS.info);
    expect(rec.msg).toBe('hello');
    expect(rec.bindings).toEqual({ app: 'test' });
    expect(rec.context).toEqual({ foo: 'bar' });
    expect(rec.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('suppresses records below the configured level', () => {
    const { records, sink } = captureSink();
    const log = new Logger({ level: 'warn', sinks: [sink] });

    log.debug('ignored');
    log.info('ignored');
    log.warn('kept');
    log.error('kept');

    expect(records.map((r) => r.level)).toEqual(['warn', 'error']);
  });

  it('serializes Error objects into a structured err field', () => {
    const { records, sink } = captureSink();
    const log = new Logger({ level: 'error', sinks: [sink] });

    log.error('boom', { err: new TypeError('bad input') });

    const rec = records[0]!;
    expect(rec.err?.name).toBe('TypeError');
    expect(rec.err?.message).toBe('bad input');
    expect(rec.err?.stack).toBeTypeOf('string');
  });

  it('attaches AI metadata for automated triage on errors', () => {
    const { records, sink } = captureSink();
    const log = new Logger({ level: 'error', sinks: [sink] });

    log.error('parse failed', {
      ai: {
        actionable: true,
        suggestion: 'Reject the blueprint and prompt the user to re-export.',
        severity_reason: 'User-facing import cannot proceed without valid XML.',
      },
    });

    expect(records[0]!.ai).toEqual({
      actionable: true,
      suggestion: 'Reject the blueprint and prompt the user to re-export.',
      severity_reason: 'User-facing import cannot proceed without valid XML.',
    });
  });

  it('child loggers merge bindings and inherit sinks and level', () => {
    const { records, sink } = captureSink();
    const root = new Logger({ level: 'debug', bindings: { app: 'se' }, sinks: [sink] });
    const child = root.child({ module: 'twr' });

    child.debug('computed');

    expect(records[0]!.bindings).toEqual({ app: 'se', module: 'twr' });
  });

  it('propagates correlation ids from logger and per-call override', () => {
    const { records, sink } = captureSink();
    const log = new Logger({ level: 'info', correlationId: 'cid-root', sinks: [sink] });

    log.info('a');
    log.info('b', { correlationId: 'cid-override' });

    expect(records[0]!.correlationId).toBe('cid-root');
    expect(records[1]!.correlationId).toBe('cid-override');
  });

  it('never lets a throwing sink break logging', () => {
    const { records, sink } = captureSink();
    const throwing: LogSink = () => {
      throw new Error('sink exploded');
    };
    const log = new Logger({ level: 'info', sinks: [throwing, sink] });

    expect(() => log.info('resilient')).not.toThrow();
    expect(records).toHaveLength(1);
  });

  it('exposes all six level methods', () => {
    const { records, sink } = captureSink();
    const log = new Logger({ level: 'trace', sinks: [sink] });

    log.trace('t');
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    log.fatal('f');

    expect(records.map((r) => r.level)).toEqual([
      'trace',
      'debug',
      'info',
      'warn',
      'error',
      'fatal',
    ]);
  });

  it('serializes non-Error thrown values into a message', () => {
    const { records, sink } = captureSink();
    const log = new Logger({ level: 'error', sinks: [sink] });

    log.error('string throw', { err: 'plain string failure' });
    log.error('object throw', { err: { code: 42 } });

    expect(records[0]!.err).toEqual({ name: 'NonError', message: 'plain string failure' });
    expect(records[1]!.err).toEqual({ name: 'NonError', message: '{"code":42}' });
  });
});

describe('consoleJsonSink', () => {
  it('routes records to the console method matching their severity', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const base: Omit<LogRecord, 'level' | 'levelValue' | 'msg'> = {
      time: '2026-01-01T00:00:00.000Z',
      bindings: {},
    };

    consoleJsonSink({ ...base, level: 'info', levelValue: LOG_LEVELS.info, msg: 'i' });
    consoleJsonSink({ ...base, level: 'warn', levelValue: LOG_LEVELS.warn, msg: 'w' });
    consoleJsonSink({ ...base, level: 'error', levelValue: LOG_LEVELS.error, msg: 'e' });

    expect(logSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('createCorrelationId', () => {
  it('returns a unique non-empty string', () => {
    const a = createCorrelationId();
    const b = createCorrelationId();
    expect(a).toBeTypeOf('string');
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it('falls back to a timestamped id when crypto.randomUUID is unavailable', () => {
    const original = globalThis.crypto;
    vi.stubGlobal('crypto', undefined);
    try {
      expect(createCorrelationId()).toMatch(/^cid-/);
    } finally {
      vi.stubGlobal('crypto', original);
    }
  });
});
