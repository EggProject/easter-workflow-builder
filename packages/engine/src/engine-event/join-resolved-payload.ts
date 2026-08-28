/**
 * A `join_resolved` esemény payloadja (SPEC-004 13. szekció táblázat,
 * `join_resolved` sor): egy `join` node lefutásakor íródik, a `mode`
 * mezőben a `join` konfigurációjának módjával.
 */
export interface JoinResolvedPayload {
  readonly mode: 'merge' | 'script' | 'ai_synthesis';
  readonly inputCount: number;
}
