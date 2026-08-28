/**
 * A `fan_out_expanded` esemény payloadja (SPEC-004 13. szekció táblázat,
 * `fan_out_expanded` sor): egy `fan_out` node lefutásakor íródik, a
 * leszármaztatott példányok számával.
 */
export interface FanOutExpandedPayload {
  readonly itemCount: number;
}
