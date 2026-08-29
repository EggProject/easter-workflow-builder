import type { ApprovalDecision } from '@easter-workflow-builder/db';
import type { ApprovalWaitSignal } from './approval-wait-signal.ts';

/**
 * A `human_approval` node döntésre várásának regisztere (SPEC-004 5.8
 * szekció, PLAN-005 T-005-22). A tényleges döntést a `decideApproval` motor
 * művelet (`engine-port/create-engine.ts`) hívja: az a `db`
 * `approvals.decideApproval(...)`-t saját tranzakcióban futtatja (a `step_run`
 * `waiting_approval -> succeeded`/`rejected` átmenetével együtt, lásd
 * `human-approval-repository.ts`), és **csak ez után** hívja meg ennek a
 * regiszternek a `notifyDecided`-jét.
 *
 * **Miért egyetlen, a hívó (`node-executor`, majd a `run-supervisor`) által
 * példányosított, lezárásban élő állapot, nem globális modulszintű
 * `Map`.** Ugyanaz az indok, mint a `concurrency-gate` témánál
 * (`create-concurrency-gate.ts` doksija): a regiszter **minden futás által
 * osztott**, egyetlen objektum kell legyen (egy `decideApproval` hívás nem
 * tudja, melyik futásból jött a várakozó), tehát az állapotot egy `create*`
 * factory adja vissza, amit a hívó egyetlen példányban hoz létre és oszt meg
 * a `execute-human-approval` végrehajtó és a `decideApproval` motor
 * művelet között. Egy modulszintű mutable változó ugyanezt tenné, de
 * tesztelhetetlenül: két teszt egymás állapotát látná.
 *
 * **Miért tudja a regiszter a `runId` értékét is.** Egy korlátlan várakozású
 * (`timeoutMs: null`) `human_approval` lépésnek nincs `AgentQuery`-je, amin
 * `interrupt()`-et lehetne hívni, tehát a megszakítás és a szabályos leállás
 * (9. szekció, 10.2 szekció) enélkül ÖRÖKRE megállna a `completion` Promise
 * várakozásában. A `cancelWaitingForRunIds` ezt oldja fel, és ahhoz futásonként
 * kell tudni, mely várakozók tartoznak a megszakítandó fához - pontosan
 * ugyanaz a minta, mint az `AgentQueryRegistry.listForRunIds` esetén
 * (`run-interrupt/agent-query-registry.ts`).
 */
export interface ApprovalWaitRegistry {
  /**
   * Regisztrál egy várakozót a `stepRunId`-ra, és egy `Promise`-t ad vissza,
   * ami akkor teljesül, amikor egy jövőbeli `notifyDecided` (döntés) vagy
   * `cancelWaitingForRunIds` (megszakítás) hívás ugyanerre a lépés futásra
   * megérkezik. Ugyanarra a `stepRunId`-ra ismételt hívás a korábbi várakozót
   * lecseréli (a hívó, `execute-human-approval.ts`, `stepRunId`-onként
   * pontosan egyszer hívja, tehát ez a gyakorlatban nem fordul elő).
   */
  waitForDecision(runId: string, stepRunId: string): Promise<ApprovalWaitSignal>;

  /**
   * A `decideApproval` motor művelet hívja, MIUTÁN a `db`
   * `approvals.decideApproval(...)` tranzakciója sikeresen lezárult: a
   * `stepRunId`-ra regisztrált várakozó `Promise`-át feloldja a `decision`
   * értékkel, és törli a bejegyzést. Ismeretlen `stepRunId`-ra (nincs
   * regisztrált várakozó, mert már feloldódott, mert `cancelWait` törölte
   * lejáratkor, vagy mert `cancelWaitingForRunIds` zárta le megszakításkor)
   * csendben nem tesz semmit: ez nem programhiba, hanem a `Promise.race`
   * verseny normális kimenete, amikor a döntés csak azután érkezik meg, hogy
   * az időkorlát vagy a megszakítás már lezárta a lépést.
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

  /**
   * A megadott `runId` HALMAZHOZ tartozó MINDEN várakozót lezár, `interrupted`
   * jelzéssel oldva fel a `Promise`-t (SPEC-004 9. szekció 2 ... 5. pont, 10.2
   * szekció). A `run-interrupt` téma `stopAndAwaitRunTree` menete hívja, a
   * `requestStop()` után, még a `completion` Promise-ok megvárása ELŐTT:
   * enélkül egy korlátlan várakozású `human_approval` lépésen álló futás
   * `completion` Promise-a sosem teljesülne, tehát a megszakítás és a
   * szabályos leállás is örökre megállna.
   *
   * A `runIds` szándékosan `ReadonlySet`, nem tömb, ugyanabból az okból, mint
   * az `AgentQueryRegistry.listForRunIds` esetén: a hívó egy fa (vagy a teljes
   * aktív lista) `runId`-jait gyűjti össze, ahol a halmaz jelentése a pontos
   * illeszkedés a feladathoz.
   */
  cancelWaitingForRunIds(runIds: ReadonlySet<string>): void;
}

// Egy regisztrált várakozó: a futása (a megszakítás szűréséhez) és a
// `Promise` feloldó függvénye.
interface ApprovalWaiter {
  readonly runId: string;
  readonly resolve: (signal: ApprovalWaitSignal) => void;
}

// A megszakítás jelzése konstans, mert nincs változó mezője: minden lezárt
// várakozó UGYANAZT az értéket kapja.
const INTERRUPTED: ApprovalWaitSignal = { kind: 'interrupted' };

/**
 * A regiszter létrehozása. Belső állapota egy `stepRunId -> ApprovalWaiter`
 * `Map`, ugyanaz a lezárásban élő, szinkron mintát követő szerkezet, mint a
 * `concurrency-gate` témában (`create-concurrency-gate.ts`), azzal a
 * különbséggel, hogy itt a felület maga `Promise`-t ad vissza: a
 * `human_approval` várakozás nem szinkron visszahívás, mert a hívó
 * (`execute-human-approval.ts`) `Promise.race`-ben áll az időkorlát
 * `sleep`-jével, ami már eleve `Promise` alapú (`ClockPort.sleep`).
 */
export function createApprovalWaitRegistry(): ApprovalWaitRegistry {
  const waiters = new Map<string, ApprovalWaiter>();

  function waitForDecision(runId: string, stepRunId: string): Promise<ApprovalWaitSignal> {
    return new Promise<ApprovalWaitSignal>((resolve) => {
      waiters.set(stepRunId, { runId, resolve });
    });
  }

  function notifyDecided(stepRunId: string, decision: ApprovalDecision): void {
    const waiter = waiters.get(stepRunId);
    if (waiter === undefined) {
      return;
    }
    waiters.delete(stepRunId);
    waiter.resolve({ kind: 'decided', decision });
  }

  function cancelWait(stepRunId: string): void {
    waiters.delete(stepRunId);
  }

  function cancelWaitingForRunIds(runIds: ReadonlySet<string>): void {
    for (const [stepRunId, waiter] of waiters) {
      if (!runIds.has(waiter.runId)) {
        continue;
      }
      waiters.delete(stepRunId);
      waiter.resolve(INTERRUPTED);
    }
  }

  return { waitForDecision, notifyDecided, cancelWait, cancelWaitingForRunIds };
}
