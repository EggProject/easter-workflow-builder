import type { ApprovalDecision } from '@easter-workflow-builder/db';

/**
 * A `human_approval` node döntésre várásának regisztere (SPEC-004 5.8
 * szekció, PLAN-005 T-005-22). A tényleges döntés egy **jövőbeli, külön**
 * motor művelet, a `decideApproval` (T-005-28) hívja: az a `db`
 * `approvals.decideApproval(...)`-t saját tranzakcióban futtatja (a `step_run`
 * `waiting_approval -> succeeded`/`rejected` átmenetével együtt, lásd
 * `human-approval-repository.ts`), és **csak ez után** hívja meg ennek a
 * regiszternek a `notifyDecided`-jét - ez a téma tehát csak a regiszter,
 * a hívó fél (`decideApproval`) MÉG NEM létezik ebben a lépésben.
 *
 * **Miért egyetlen, a hívó (`node-executor`, majd a `run-supervisor`) által
 * példányosított, lezárásban élő állapot, nem globális modulszintű
 * `Map`.** Ugyanaz az indok, mint a `concurrency-gate` témánál
 * (`create-concurrency-gate.ts` doksija): a regiszter **minden futás által
 * osztott**, egyetlen objektum kell legyen (egy `decideApproval` hívás nem
 * tudja, melyik futásból jött a várakozó), tehát az állapotot egy `create*`
 * factory adja vissza, amit a hívó egyetlen példányban hoz létre és oszt meg
 * a `execute-human-approval` végrehajtó és a jövőbeli `decideApproval` motor
 * művelet között. Egy modulszintű mutable változó ugyanezt tenné, de
 * tesztelhetetlenül: két teszt egymás állapotát látná.
 */
export interface ApprovalWaitRegistry {
  /**
   * Regisztrál egy várakozót a `stepRunId`-ra, és egy `Promise`-t ad vissza,
   * ami akkor teljesül, amikor egy jövőbeli `notifyDecided` hívás ugyanerre a
   * `stepRunId`-ra megérkezik. Ugyanarra a `stepRunId`-ra ismételt hívás a
   * korábbi várakozót lecseréli (a hívó, `execute-human-approval.ts`,
   * `stepRunId`-onként pontosan egyszer hívja, tehát ez a gyakorlatban nem
   * fordul elő).
   */
  waitForDecision(stepRunId: string): Promise<ApprovalDecision>;

  /**
   * A `decideApproval` motor művelet (T-005-28) hívja, MIUTÁN a `db`
   * `approvals.decideApproval(...)` tranzakciója sikeresen lezárult: a
   * `stepRunId`-ra regisztrált várakozó `Promise`-át feloldja a `decision`
   * értékkel, és törli a bejegyzést. Ismeretlen `stepRunId`-ra (nincs
   * regisztrált várakozó, mert már feloldódott, vagy `cancelWait` törölte
   * lejáratkor) csendben nem tesz semmit: ez nem programhiba, hanem a
   * `Promise.race` verseny normális kimenete, amikor a döntés csak azután
   * érkezik meg, hogy az időkorlát már lezárta a lépést.
   */
  notifyDecided(stepRunId: string, decision: ApprovalDecision): void;

  /**
   * A `stepRunId`-ra regisztrált várakozót törli, FELOLDÁS NÉLKÜL. Az
   * időkorlát versenyének vesztes ága hívja (`execute-human-approval.ts`):
   * ha a `sleep` előbb jár le, mint a döntés, a várakozó bejegyzésnek nem
   * szabad örökre a regiszterben maradnia egy sosem beérkező (vagy már
   * elkésett) döntésre várva.
   */
  cancelWait(stepRunId: string): void;
}

/**
 * A regiszter létrehozása. Belső állapota egy `stepRunId -> feloldó
 * függvény` `Map`, ugyanaz a lezárásban élő, szinkron mintát követő
 * szerkezet, mint a `concurrency-gate` témában (`create-concurrency-gate.ts`),
 * azzal a különbséggel, hogy itt a felület maga `Promise`-t ad vissza: a
 * `human_approval` várakozás nem szinkron visszahívás, mert a hívó
 * (`execute-human-approval.ts`) `Promise.race`-ben áll az időkorlát
 * `sleep`-jével, ami már eleve `Promise` alapú (`ClockPort.sleep`).
 */
export function createApprovalWaitRegistry(): ApprovalWaitRegistry {
  const waiters = new Map<string, (decision: ApprovalDecision) => void>();

  function waitForDecision(stepRunId: string): Promise<ApprovalDecision> {
    return new Promise<ApprovalDecision>((resolve) => {
      waiters.set(stepRunId, resolve);
    });
  }

  function notifyDecided(stepRunId: string, decision: ApprovalDecision): void {
    const resolve = waiters.get(stepRunId);
    if (resolve === undefined) {
      return;
    }
    waiters.delete(stepRunId);
    resolve(decision);
  }

  function cancelWait(stepRunId: string): void {
    waiters.delete(stepRunId);
  }

  return { waitForDecision, notifyDecided, cancelWait };
}
