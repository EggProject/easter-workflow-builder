import type { Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext } from '../engine-port/database-port.ts';
import type { ApprovalWaitRegistry } from '../node-executor/approval-wait-registry.ts';
import type { RunSupervisor } from '../run-supervisor/run-supervisor.ts';
import type { AgentQueryRegistry } from './agent-query-registry.ts';
import { stopAndAwaitRunTree } from './stop-and-await-run-tree.ts';

/**
 * Az `interruptRun` függősége. A `runSupervisor` szándékosan csak a
 * `listActiveRuns` metódust várja (`Pick`, nem a teljes `RunSupervisor`): ez
 * a téma nem indít futást és nem old fel providert, csak a MÁR futó
 * futásokat kérdezi le, ugyanaz az elv, mint az `agent-step` téma
 * `EngineDependencies` újrahasználásánál (`.claude/CLAUDE.md` "Minimum kód").
 * A `createEngine` (T-005-28) a saját, teljes `RunSupervisor` példányát adja
 * majd ide, adapter nélkül, mert az triviálisan illeszkedik erre a
 * szűkebb felületre.
 *
 * Az `approvalRegistry` a T-005-31 óta kötelező mező: a `stopAndAwaitRunTree`
 * ezen zárja le a fa várakozó `human_approval` lépéseit, ami nélkül egy
 * korlátlan várakozású jóváhagyáson álló futás megszakítása sosem fejeződne
 * be (AC-51, lásd `stop-and-await-run-tree.ts` 2. pontját).
 */
export interface InterruptRunDependencies {
  readonly database: DatabaseContext;
  readonly runSupervisor: Pick<RunSupervisor, 'listActiveRuns'>;
  readonly agentQueryRegistry: AgentQueryRegistry;
  readonly approvalRegistry: ApprovalWaitRegistry;
}

/**
 * Az `interruptRun` eredménye: a fa gyökere és a ténylegesen megszakított
 * futások azonosítója (`RunRecovery.cancelRunTree` visszaadott listája). A
 * SPEC-004 3.1 szekció `Engine.interruptRun` szignatúrája a `InterruptSummary`
 * nevet használja - ennek a végleges alakját és a `createEngine` felület felé
 * történő illesztését a T-005-28 végzi el, ez a téma a benne rejlő
 * ADATOKAT már mind előállítja.
 */
export interface InterruptRunResult {
  readonly rootRunId: string;
  readonly cancelledRunIds: readonly string[];
}

/**
 * A felhasználói megszakítás teljes menete (SPEC-004 9. szekció, PLAN-005
 * T-005-26). A cél futás `runId`-ját kapja, és a **teljes fáján** (a
 * `rootRunId` szerint azonos gyökerű futásokon, az al-workflow futásokat is
 * beleértve) végzi el a hat pontot:
 *
 * 1. **A cél futás beolvasása** (`database.runs.getRun`): innen jön a
 *    `rootRunId`, amivel a fa többi tagja azonosítható. Ismeretlen `runId`-ra
 *    a `not_found` hiba változatlanul, `Outcome` hibaágként megy tovább -
 *    ugyanaz a minta, mint a `collectRunInputs`-nál.
 * 2. **A fa aktív kézikönyveinek kiválasztása**: a `RunSupervisor.listActiveRuns()`
 *    listáját a `rootRunId` szerint szűkíti (9. szekció 3. pont, a
 *    `run-supervisor` CLAUDE.md "Amit a T-005-26 ebből használ" bekezdése).
 * 3. **`requestStop()` és `interrupt()` minden érintett futáson és élő
 *    `AgentQuery`-n**, majd a `completion` Promise-ok megvárása - ez a
 *    `stopAndAwaitRunTree` közös menete (9. szekció 2 ... 4. pont). A
 *    beérkezett üzenetek beírása és a hely felszabadítása a meglévő
 *    `runAgentStep`/`agent-node-lifecycle` `finally` ágain magától
 *    megtörténik, ezt a függvény nem ismétli meg.
 * 4. **A DB oldali zárás egy tranzakcióban** (`database.recovery.cancelRunTree`,
 *    9. szekció 5. pont): a fa minden nem terminális futása `cancelled`, a
 *    nem terminális lépéseik szintén, futásonként egy `run_finished` esemény
 *    `status: 'cancelled'`-lel.
 *
 * **A `pending` állapotú futás külön ág NÉLKÜL megszakad.** A SPEC-004 9.
 * szekció "Megszakítás indulás előtt" bekezdése szerint a `pending ->
 * cancelled` átmenet közvetlen, mert nincs mit megszakítani SDK oldalon. Ezt
 * a `cancelRunTree` `WHERE status IN ('pending', 'running')` feltétele
 * ÖNMAGÁBAN lefedi (`packages/db` `run-recovery.ts`): egy `pending` futásnak
 * nincs aktív kézikönyve (a `run-supervisor` a `startRun`/`startChildRun`
 * szinkron menetében `markRunRunning`-gal együtt regisztrálja), tehát a 2.
 * pont üres listát ad rá, a `stopAndAwaitRunTree` azonnal visszatér, és a 4.
 * pont önmagában cancelled-be viszi a sort. Egy külön "ha pending" kódág itt
 * SOSEM futna le ténylegesen eltérő módon, tehát a 100 százalékos, kizárás
 * nélküli lefedettségi küszöb (`.claude/CLAUDE.md` 5. szekció) miatt nem is
 * íródik meg.
 *
 * **Már teljesen terminális fára nem hiba, hanem üres `cancelledRunIds`.** Ha
 * a cél futás és a fa minden tagja időközben magától befejeződött, a
 * `cancelRunTree` semmit nem talál a `WHERE status IN (...)` feltétellel,
 * ezért üres listát ad - ez a "nincs mit megszakítani" legitim, nem hibás
 * kimenete (`RunRecovery.cancelRunTree` doksija).
 *
 * **A `Query.close()` metódust ez a téma sem hívja** (O-2 nyitott kérdés,
 * SPEC-004 9. szekció "A `Query.close()` metódust nem hívjuk" bekezdése): a
 * folyam lezárását kizárólag a generátor kimerítése végzi, a
 * `stopAndAwaitRunTree` csak `interrupt()`-et hív.
 */
export async function interruptRun(
  runId: string,
  dependencies: InterruptRunDependencies,
): Promise<Outcome<InterruptRunResult>> {
  const target = dependencies.database.runs.getRun(runId);
  if (target.kind === 'error') {
    return target;
  }
  const rootRunId = target.value.rootRunId;

  const treeHandles = dependencies.runSupervisor.listActiveRuns().filter((handle) => handle.rootRunId === rootRunId);
  await stopAndAwaitRunTree(treeHandles, dependencies.agentQueryRegistry, dependencies.approvalRegistry);

  const cancelled = dependencies.database.recovery.cancelRunTree(rootRunId);
  if (cancelled.kind === 'error') {
    return cancelled;
  }

  return { kind: 'ok', value: { rootRunId, cancelledRunIds: cancelled.value.cancelledRunIds } };
}
