import type { Outcome } from '@easter-workflow-builder/core';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';

/**
 * A providerenkénti, **minden futásra közös** párhuzamossági szabályozó
 * felülete (SPEC-004 7.1): egy szabályozó providerenként, ami minden futás
 * minden ágára együtt érvényes, és a sora szigorúan érkezési sorrendben
 * (FIFO) ürül.
 *
 * **Egy hely egy teljes agent lépés életciklusa**, nem egy HTTP kérés
 * (7.1 harmadik pont): a hely a `query()` indításától a lépés terminális
 * állapotáig foglalt. A szabályozó ebből semmit nem lát: a hívó
 * (`node-executor`) kér helyet a futtatás előtt, és **minden ágon**, a
 * hibaágon és a megszakításon is felszabadítja (5.2 1. és 10. pont, 9. szekció 6. pont). A szabályozónak nincs tudomása node típusról sem: hogy a
 * `human_approval` és a `sub_workflow` lépés nem foglal helyet (7.2), az a
 * hívó döntése, ami egyszerűen nem hív `requestSlot` műveletet.
 *
 * **A kiosztás szinkron, nem Promise.** A `requestSlot` az `onGranted`
 * visszahívást vagy azonnal, még a saját visszatérése előtt hívja meg (van
 * szabad hely), vagy később, egy `releaseSlot` hívás **belsejéből**, szintén
 * szinkron módon. Két oka van:
 *
 * 1. A determinizmus követelménye (SPEC-004 14.2): a szabályozó tesztje így
 *    egyetlen időzítőt, mikrotask ürítést és valós időt sem használ, a
 *    kiosztás sorrendje közvetlenül megfigyelhető.
 * 2. A hívó oldalon egy sor a teljes áthidalás egy `await` pontig:
 *    `await new Promise<boolean>((resolve) => { gate.requestSlot(providerId, runId, stepRunId, () => resolve(true), () => resolve(false)); })`.
 *    A Promise az `agent-step` réteg fogalma, nem a szabályozóé.
 *
 * A visszahívás előtt a szabályozó belső nyilvántartása már frissült, tehát
 * az `onGranted` törzse biztonságosan hívhat újabb `requestSlot` vagy
 * `releaseSlot` műveletet.
 *
 * **Az elutasítás két úton jön, mindkettő az `onDenied` visszahívással**,
 * szintén szinkron, és az `onGranted` utána soha nem fut le a kérésre:
 *
 * - a megszakított futások sorban álló kérései (`denyWaitingForRunIds`,
 *   SPEC-004 9. szekció 2. pont, "a sorban álló lépései kiesnek");
 * - a lezárt szabályozó minden várakozója és minden új kérése (`close`,
 *   SPEC-004 10.2 1. pont).
 */
export interface ConcurrencyGate {
  /**
   * Hely kérése egy providerre. A `requestId` a hívó által adott, futás
   * közben egyedi azonosító (éles futásban a `step_run` sor azonosítója); a
   * szabályozó nem generál azonosítót, mert az az `idGenerator` port dolga
   * (SPEC-004 3.2). A `runId` a kérő lépés futása: csak a
   * `denyWaitingForRunIds` olvassa, a kiosztás sorrendjére nincs hatása.
   */
  requestSlot(
    providerId: ProviderId,
    runId: string,
    requestId: string,
    onGranted: () => void,
    onDenied: () => void,
  ): void;

  /**
   * A `requestId` hely vagy várakozó bejegyzés felszabadítása. Foglalt hely
   * esetén a felszabaduló helyet azonnal megkapja az adott provider sorának
   * legelső várakozója, ha van. Még sorban álló (helyet nem kapott) kérésre a
   * bejegyzés kiesik a sorból, és a visszahívása soha nem fut le. A motor ezt
   * az ágat nem használja: a megszakítás a `denyWaitingForRunIds` úton megy,
   * mert a várakozó hívónak visszahívás kell, különben örökre várna.
   *
   * Ismeretlen azonosítóra `unknown_concurrency_slot` hibaág. Lásd a téma
   * indoklását a `packages/engine/CLAUDE.md` fájlban.
   */
  releaseSlot(requestId: string): Outcome<void>;

  /**
   * A megadott futások MINDEN sorban álló, helyet még nem kapott kérése
   * kiesik a sorból, és érkezési sorrendben `onDenied` visszahívást kap
   * (SPEC-004 9. szekció 2. pont). A megszakítás közös menete
   * (`stopAndAwaitRunTree`) hívja, a futás fájának minden `runId`-jával, még
   * a `completion` megvárása előtt: enélkül egy sorban álló lépés a megszakítás
   * után felszabaduló helyet megkapná, és `interrupt()` nélkül végigfutna.
   * A már kiosztott helyek érintetlenek, azokat a futó lépés a saját
   * `finally` ágán szabadítja fel; más futás várakozója sem változik.
   */
  denyWaitingForRunIds(runIds: ReadonlySet<string>): void;

  /**
   * A szabályozó végleges lezárása a szabályos leálláskor (SPEC-004 10.2 1.
   * pont). A sorban álló kérések azonnal, érkezési sorrendben `onDenied`
   * visszahívást kapnak és kiesnek a sorból; a lezárás után érkező kérés
   * ugyanígy. A már kiosztott helyek foglaltak maradnak, és a `releaseSlot`
   * változatlanul felszabadítja őket, csak a felszabaduló helyet nem kapja meg
   * senki. Visszanyitás nincs: a leálló motor nem indul újra.
   */
  close(): void;

  /**
   * A providerhez tartozó, jelenleg foglalt helyek száma.
   */
  occupiedSlotCount(providerId: ProviderId): number;

  /**
   * A providerre várakozó, helyet még nem kapott kérések száma.
   */
  waitingRequestCount(providerId: ProviderId): number;
}
