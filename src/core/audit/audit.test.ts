import { describe, it, expect } from 'vitest';
import { AuditLogger, InMemoryAuditStore } from './audit';
import { Logger } from '../logger';

function silentLogger(): Logger {
  return new Logger({ level: 'fatal', sinks: [() => {}] });
}

describe('InMemoryAuditStore', () => {
  it('is append-only and preserves insertion order', () => {
    const store = new InMemoryAuditStore();
    store.append({
      id: 'a',
      timestamp: '2026-01-01T00:00:00.000Z',
      userId: 'local-user',
      action: 'design.create',
      entityType: 'design',
      entityId: 'd1',
    });
    store.append({
      id: 'b',
      timestamp: '2026-01-01T00:00:01.000Z',
      userId: 'local-user',
      action: 'block.add',
      entityType: 'block',
      entityId: 'blk1',
    });

    expect(store.size).toBe(2);
    expect(store.all().map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('returns copies so callers cannot mutate the trail', () => {
    const store = new InMemoryAuditStore();
    store.append({
      id: 'a',
      timestamp: '2026-01-01T00:00:00.000Z',
      userId: 'local-user',
      action: 'design.create',
      entityType: 'design',
    });

    store.all().pop();
    expect(store.size).toBe(1);
  });

  it('filters events by entity', () => {
    const store = new InMemoryAuditStore();
    store.append({
      id: 'a',
      timestamp: '2026-01-01T00:00:00.000Z',
      userId: 'local-user',
      action: 'design.create',
      entityType: 'design',
      entityId: 'd1',
    });
    store.append({
      id: 'b',
      timestamp: '2026-01-01T00:00:01.000Z',
      userId: 'local-user',
      action: 'design.rename',
      entityType: 'design',
      entityId: 'd2',
    });

    expect(store.forEntity('design', 'd1').map((e) => e.id)).toEqual(['a']);
  });
});

describe('AuditLogger', () => {
  it('records a well-formed, timestamped event with an id and default user', async () => {
    const store = new InMemoryAuditStore();
    const audit = new AuditLogger(store, silentLogger());

    const event = await audit.record({
      action: 'blueprint.import',
      entityType: 'blueprint',
      metadata: { filename: 'miner.sbc', blockCount: 214 },
    });

    expect(event.id).toMatch(/^audit_/);
    expect(event.userId).toBe('local-user');
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(event.metadata).toEqual({ filename: 'miner.sbc', blockCount: 214 });
    expect(store.all()).toContainEqual(event);
  });

  it('captures before/after state for updates', async () => {
    const store = new InMemoryAuditStore();
    const audit = new AuditLogger(store, silentLogger());

    const event = await audit.record({
      action: 'block.quantity.change',
      entityType: 'block',
      entityId: 'ion-large',
      before: { quantity: 4 },
      after: { quantity: 6 },
    });

    expect(event.before).toEqual({ quantity: 4 });
    expect(event.after).toEqual({ quantity: 6 });
  });
});
