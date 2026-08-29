import type { ActiveRunHandle } from '../run-supervisor/active-run-registry.ts';
import type { AgentQueryRegistry } from './agent-query-registry.ts';

/**
 * A megszakítás (SPEC-004 9. szekció 2 ... 4. pont) ÉS a szabályos leállás
 * (10.2 szekció 1 ... 2. pont) KÖZÖS menete, PLAN-005 T-005-26. A hívó adja
 * meg, MELYIK futásokra vonatkozik: az `interruptRun` egy futás fájára
 * szűkíti (`ActiveRunHandle.rootRunId` szerint), a jövőbeli `shutdown`
 * (T-005-28) a `RunSupervisor.listActiveRuns()` TELJES listáját adja majd.
 *
 * Három lépés, ebben a sorrendben:
 *
 * 1. `requestStop()` minden kapott kézikönyvön: a szabályozó ezekből a
 *    futásokból többé nem enged induló lépést (9. szekció 2. pont, 10.2
 *    szekció 1. pont). Ez memóriabeli, szinkron jelzés - nem vár semmire.
 * 2. `interrupt()` minden élő `AgentQuery`-n, amit a kapott futások
 *    `runId`-jai alapján az `agentQueryRegistry` ismer (9. szekció 3. pont,
 *    10.2 szekció 2. pont). Az üzenetfolyam kimerítése és a beérkezett
 *    üzenetek beírása ETTŐL a ponttól a `runAgentStep` meglévő ciklusában
 *    magától megtörténik (SPEC-004 9. szekció 4. pont) - ez a függvény nem
 *    avatkozik bele, csak a jelzést adja.
 * 3. Minden kapott kézikönyv `completion` Promise-ának megvárása: ez akkor
 *    teljesül, amikor a `run-supervisor` léptető hurka kilép, mert nincs
 *    több futtatható vagy folyamatban lévő példány (`advance-run.ts`
 *    `runSchedulingLoop`). A `completion` SOSEM utasít el (`ActiveRunHandle`
 *    doksija), tehát ez a várakozás nem igényel hibaágat.
 *
 * A DB oldali zárás (a futás és a nem terminális lépések állapotváltása,
 * `run_finished`/`run_interrupted` esemény) ETTŐL A FÜGGVÉNYTŐL KÜLÖN,
 * témánként eltérő módon történik (`interrupt-run.ts` a `cancelRunTree`
 * primitívvel, a jövőbeli `shutdown` a MÁR KÉSZ `recoverInterruptedRuns`
 * primitívvel) - lásd `interrupt-run.ts` doksiját.
 */
export async function stopAndAwaitRunTree(
  handles: readonly ActiveRunHandle[],
  agentQueryRegistry: AgentQueryRegistry,
): Promise<void> {
  for (const handle of handles) {
    handle.requestStop();
  }

  const runIds = new Set(handles.map((handle) => handle.runId));
  const liveQueries = agentQueryRegistry.listForRunIds(runIds);
  await Promise.all(liveQueries.map((query) => query.interrupt()));

  await Promise.all(handles.map((handle) => handle.completion));
}
