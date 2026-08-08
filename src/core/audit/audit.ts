/**
 * Append-only audit trail for meaningful user actions.
 *
 * Even though v1 is a client-only SPA with no backend, the project standard
 * requires audit logging designed into the data model from the start — not
 * bolted on. This module defines the audit *record shape* and an append-only
 * store contract now, so later phases (save/compare designs, a sync backend,
 * a Tauri build with local persistence) can add a durable sink without
 * reshaping the data.
 *
 * Audit records are never mutated or deleted. To "undo", append a new event.
 *
 * Platform-agnostic: no DOM, no React.
 */

import type { Logger } from '../logger';

/** Business actions worth auditing. Extend as features land. */
export type AuditAction =
  | 'blueprint.import'
  | 'design.create'
  | 'design.rename'
  | 'design.delete'
  | 'block.add'
  | 'block.remove'
  | 'block.quantity.change'
  | 'block.stats.override'
  | 'planet.change'
  | 'loadout.change'
  | 'estimate.seed';

/** Entities that actions operate on. */
export type AuditEntityType = 'design' | 'block' | 'blueprint' | 'settings';

export interface AuditEvent {
  /** Unique, sortable id. */
  readonly id: string;
  /** ISO-8601 timestamp. */
  readonly timestamp: string;
  /**
   * Actor. v1 is single-user local, so this is 'local-user' by default, but
   * the field exists so multi-user/backed deployments need no schema change.
   */
  readonly userId: string;
  readonly action: AuditAction;
  readonly entityType: AuditEntityType;
  /** Id of the affected entity, when applicable. */
  readonly entityId?: string;
  /** State before the change (for updates/deletes). */
  readonly before?: unknown;
  /** State after the change (for creates/updates). */
  readonly after?: unknown;
  /** Free-form structured context (source filename, counts, etc.). */
  readonly metadata?: Record<string, unknown>;
  /** Correlation id tying this to a logical operation / log records. */
  readonly correlationId?: string;
}

export interface RecordAuditInput {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  userId?: string;
}

/**
 * Durable persistence contract. The in-memory store implements this; an
 * IndexedDB or HTTP-backed store can drop in later with no caller changes.
 */
export interface AuditSink {
  append(event: AuditEvent): void | Promise<void>;
}

function makeId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  const rand =
    c && typeof c.randomUUID === 'function' ? c.randomUUID() : Math.random().toString(36).slice(2);
  return `audit_${Date.now().toString(36)}_${rand}`;
}

/**
 * Default append-only in-memory store. Retains events for the session.
 * Reads return copies so callers cannot mutate the trail.
 */
export class InMemoryAuditStore implements AuditSink {
  private readonly events: AuditEvent[] = [];

  append(event: AuditEvent): void {
    this.events.push(event);
  }

  /** All events, oldest first. Returns a shallow copy. */
  all(): AuditEvent[] {
    return [...this.events];
  }

  /** Events for a specific entity, oldest first. */
  forEntity(entityType: AuditEntityType, entityId: string): AuditEvent[] {
    return this.events.filter((e) => e.entityType === entityType && e.entityId === entityId);
  }

  get size(): number {
    return this.events.length;
  }
}

/**
 * Records audit events to a sink and mirrors them to the structured logger so
 * they show up in the same observable stream as everything else.
 */
export class AuditLogger {
  constructor(
    private readonly sink: AuditSink,
    private readonly log: Logger,
    private readonly defaultUserId = 'local-user',
  ) {}

  async record(input: RecordAuditInput): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: makeId(),
      timestamp: new Date().toISOString(),
      userId: input.userId ?? this.defaultUserId,
      action: input.action,
      entityType: input.entityType,
      ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
      ...(input.before !== undefined ? { before: input.before } : {}),
      ...(input.after !== undefined ? { after: input.after } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
    };

    await this.sink.append(event);
    this.log.info('audit', {
      auditId: event.id,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      correlationId: event.correlationId,
    });
    return event;
  }
}
