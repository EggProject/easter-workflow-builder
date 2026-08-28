/**
 * Amit a motor az `eventPublisher` porton kiad minden beérkezett SDK
 * üzenetnél (SPEC-004 5.2 6. pont).
 *
 * A `message` a **nyers** SDK üzenet, ugyanaz az érték, amit az
 * `appendSdkEvent` is megkapott: a motor nem alakítja át, mert a normalizálás
 * a `db` csomag dolga (SPEC-003 9.2), a kimenő WebSocket üzenet alakja pedig a
 * `protocol` csomagé és a szerveré, amitől a motor nem függ. A `runId` és a
 * `stepRunId` azért utazik vele, mert a port maga nem tud a futásról: az élő
 * nézetnek ebből derül ki, melyik lépés folyamáról van szó.
 *
 * A delta perzisztálás kapcsolója erre a kimenetre **nincs hatással**: az
 * kizárólag az adatbázisba írást szűri, az élő nézet a motorból kapja az
 * üzenetet (F-23, SPEC-003 6.6).
 */
export interface AgentStreamMessage {
  readonly runId: string;
  readonly stepRunId: string;
  readonly message: unknown;
}
