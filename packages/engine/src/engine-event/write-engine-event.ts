import type { Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext } from '../engine-port/database-port.ts';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EngineEvent } from './engine-event.ts';

/**
 * A motor eredetű `run_event` sorok egyetlen írási útja: az `EngineEvent`
 * `kind` és `payload` mezőjét közvetlenül továbbadja a
 * `DatabaseContext.events.appendEngineEvent`-nek. Az `occurredAtMs` mezőt a
 * `clock` portból számítja (SPEC-004 14.2 determinizmus tábla: a motorban
 * nincs natív rendszeróra hívás). A `new Date(clock.nowMs())` konverzió itt megengedett,
 * mert a `clock.nowMs()` a determinisztikus forrás, csak az
 * `AppendEngineEventInput.occurredAtMs: Date` mező típusa miatt kell
 * `Date`-be csomagolni.
 */
export function writeEngineEvent(
  event: EngineEvent,
  ports: { readonly database: DatabaseContext; readonly clock: ClockPort },
): Outcome<{ readonly eventId: number }> {
  return ports.database.events.appendEngineEvent({
    runId: event.runId,
    stepRunId: event.stepRunId,
    kind: event.kind,
    payload: event.payload,
    occurredAtMs: new Date(ports.clock.nowMs()),
  });
}
