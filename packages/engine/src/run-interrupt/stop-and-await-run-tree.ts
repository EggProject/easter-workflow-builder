import type { ConcurrencyGate } from '../concurrency-gate/concurrency-gate.ts';
import type { ApprovalWaitRegistry } from '../node-executor/approval-wait-registry.ts';
import type { ActiveRunHandle } from '../run-supervisor/active-run-registry.ts';
import type { AgentQueryRegistry } from './agent-query-registry.ts';
import { interruptLiveAgentQueries } from './interrupt-live-agent-queries.ts';

/**
 * A megszakítás (SPEC-004 9. szekció 2 ... 4. pont) ÉS a szabályos leállás
 * (10.2 szekció 1 ... 2. pont) KÖZÖS menete, PLAN-005 T-005-26. A hívó adja
 * meg, MELYIK futásokra vonatkozik: az `interruptRun` egy futás fájára
 * szűkíti (`ActiveRunHandle.rootRunId` szerint), a `shutdownActiveRuns` a
 * `RunSupervisor.listActiveRuns()` TELJES listáját adja.
 *
 * Öt lépés, ebben a sorrendben:
 *
 * 1. `requestStop()` minden kapott kézikönyvön: a léptető hurok ezekből a
 *    futásokból többé nem indít új példányt (9. szekció 2. pont, 10.2
 *    szekció 1. pont). Ez memóriabeli, szinkron jelzés - nem vár semmire.
 * 2. **A szabályozó sorában álló agent lépések elutasítása**
 *    (`concurrencyGate.denyWaitingForRunIds`, 9. szekció 2. pont, "a sorban
 *    álló lépései kiesnek"): a már elindított, de helyet még nem kapott
 *    példányt az 1. pont nem éri el, mert az csak az ÚJ példányt tartja
 *    vissza. Enélkül a 3. és 4. pont után felszabaduló helyet megkapná, és
 *    `interrupt()` nélkül, teljes hosszában végigfutna, az 5. pont
 *    várakozása pedig kivárná (mérve, `docs/research/2026-09-23-megszakitas-leallas-meres.md`
 *    7. szekció). Az elutasított lépés `interrupted` eredménnyel tér vissza,
 *    a sora `pending` marad, és a hívó DB oldali zárása viszi tovább.
 *    Szinkron, nem vár semmire.
 * 3. **A várakozó `human_approval` lépések lezárása** (T-005-31, AC-51): a
 *    `approvalRegistry.cancelWaitingForRunIds(...)` `interrupted` jelzéssel
 *    oldja fel minden érintett futás döntésre váró lépését. Enélkül egy
 *    korlátlan várakozású (`timeoutMs: null`) jóváhagyáson álló futás
 *    `completion` Promise-a SOSEM teljesülne, tehát a lenti 5. lépés örökre
 *    megállna: annak a lépésnek nincs `AgentQuery`-je, amin `interrupt()`-et
 *    lehetne hívni. Szinkron, nem vár semmire.
 * 4. `interrupt()` minden élő `AgentQuery`-n, amit a kapott futások
 *    `runId`-jai alapján az `agentQueryRegistry` ismer (9. szekció 3. pont,
 *    10.2 szekció 2. pont), a közös `interruptLiveAgentQueries` primitívvel.
 *    Az üzenetfolyam kimerítése és a beérkezett üzenetek beírása ETTŐL a
 *    ponttól a `runAgentStep` meglévő ciklusában magától megtörténik
 *    (SPEC-004 9. szekció 4. pont) - ez a függvény nem avatkozik bele, csak a
 *    jelzést adja.
 * 5. Minden kapott kézikönyv `completion` Promise-ának megvárása: ez akkor
 *    teljesül, amikor a `run-supervisor` léptető hurka kilép, mert nincs
 *    több futtatható vagy folyamatban lévő példány (`advance-run.ts`
 *    `runSchedulingLoop`). A `completion` SOSEM utasít el (`ActiveRunHandle`
 *    doksija), tehát ez a várakozás nem igényel hibaágat.
 *
 * A DB oldali zárás (a futás és a nem terminális lépések állapotváltása,
 * `run_finished`/`run_interrupted` esemény) ETTŐL A FÜGGVÉNYTŐL KÜLÖN,
 * témánként eltérő módon történik (`interrupt-run.ts` a `cancelRunTree`
 * primitívvel, a `shutdown-active-runs.ts` a `recoverInterruptedRuns`
 * primitívvel) - lásd `interrupt-run.ts` doksiját.
 */
export async function stopAndAwaitRunTree(
  handles: readonly ActiveRunHandle[],
  agentQueryRegistry: AgentQueryRegistry,
  approvalRegistry: ApprovalWaitRegistry,
  concurrencyGate: Pick<ConcurrencyGate, 'denyWaitingForRunIds'>,
): Promise<void> {
  for (const handle of handles) {
    handle.requestStop();
  }

  const runIds = new Set(handles.map((handle) => handle.runId));
  concurrencyGate.denyWaitingForRunIds(runIds);
  approvalRegistry.cancelWaitingForRunIds(runIds);
  await interruptLiveAgentQueries(runIds, agentQueryRegistry);

  await Promise.all(handles.map((handle) => handle.completion));
}
