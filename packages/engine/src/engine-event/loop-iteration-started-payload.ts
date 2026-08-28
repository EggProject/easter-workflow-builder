/**
 * A `loop_iteration_started` esemény payloadja (SPEC-004 13. szekció
 * táblázat, `loop_iteration_started` sor): egy `loop` node új iterációt
 * indításakor íródik.
 */
export interface LoopIterationStartedPayload {
  readonly iteration: number;
  readonly maxIterations: number;
}
