import type { Outcome } from '@easter-workflow-builder/core';
import type { EngineEvent } from '../engine-event/engine-event.ts';
import { writeEngineEvent } from '../engine-event/write-engine-event.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

/**
 * Egy motor esemény kiadásának egyetlen útja a node-executor rétegben: előbb
 * a `db` felé (`writeEngineEvent`), utána az élő nézetnek
 * (`eventPublisher.publish`). A sorrend kötött (SPEC-004 5.2 6. pont elve,
 * ugyanaz az indok, mint az SDK üzeneteknél: újracsatlakozáskor a kliens az
 * adatbázisból pótol, tehát nem kaphat élőben olyan eseményt, ami még nincs a
 * naplóban). Ha az írás hibázik, a publikálás el sem indul.
 */
export function emitEngineEvent(event: EngineEvent, ports: NodeExecutorPorts): Outcome<void> {
  const written = writeEngineEvent(event, { database: ports.database, clock: ports.clock });
  if (written.kind === 'error') {
    return written;
  }

  ports.eventPublisher.publish(event);

  return { kind: 'ok', value: undefined };
}
