/**
 * Egy elindított agent futtatás kezelője (SPEC-004 3.3).
 *
 * A `messages` elemtípusa `unknown`, nem `SDKMessage`: a `db` csomag
 * `appendSdkEvent` bemenete is nyers üzenetet fogad és maga normalizál
 * (SPEC-003 9.2), tehát a motor amúgy sem szűkít, és így egyetlen sora sem
 * függ az SDK típusdefiníciójától. Amit a motornak ki kell olvasnia, azt saját
 * typeguardokkal teszi.
 *
 * Az `interrupt()` `Promise<void>` értéket ad: az SDK `Query.interrupt()`
 * visszatérési értéke (megszakítási nyugta) a porton nem megy át, mert a motor
 * nem használja, és a nyugta alakja SDK verzióhoz kötött.
 */
export interface AgentQuery {
  readonly messages: AsyncIterable<unknown>;
  interrupt(): Promise<void>;
}
