import type { StreamFrame } from '@easter-workflow-builder/protocol';

/**
 * Az ADOTT futás lezárását jelző SSE keret-e (SPEC-004 13. szekció táblázata:
 * a `run_finished` esemény a terminális futás állapotot jelenti).
 *
 * Kizárólag a `run_event` keretet fogadja el: a `run_event_transient` keret
 * definíció szerint az, aminek nincs perzisztált sora (SPEC-005 5.4, 6.3), a
 * futás lezárása pedig mindig perzisztált esemény, ugyanabban a
 * tranzakcióban, amiben a futás sora terminálisra vált (SPEC-004 9. 5.
 * pontja). A `runId` egyezés azért kell, mert egyetlen stream kapcsolat több
 * futásra is fel lehet iratkozva (SPEC-005 5.2).
 */
export function isRunFinishedFrame(frame: StreamFrame | undefined, runId: string): boolean {
  return frame?.event === 'run_event' && frame.runEvent.kind === 'run_finished' && frame.runEvent.runId === runId;
}
