/**
 * A `run_interrupted` esemény payloadja (SPEC-004 13. szekció táblázat,
 * `run_interrupted` sor): indulási helyreállításkor vagy szabályos leálláskor
 * íródik (14.3, 54. kritérium).
 */
export interface RunInterruptedPayload {
  readonly reason: 'startup_recovery' | 'graceful_shutdown';
}
