import type { Outcome } from '@easter-workflow-builder/core';
import type { RecoverInterruptedRunsResult } from '@easter-workflow-builder/db';
import type { DatabaseContext } from '../engine-port/database-port.ts';
import type { RunSupervisor } from '../run-supervisor/run-supervisor.ts';
import type { AgentQueryRegistry } from './agent-query-registry.ts';
import { stopAndAwaitRunTree } from './stop-and-await-run-tree.ts';

/**
 * A `shutdownActiveRuns` függősége. A `runSupervisor` szándékosan csak a
 * `listActiveRuns` metódust várja (`Pick`, nem a teljes `RunSupervisor`),
 * ugyanaz az elv, mint az `InterruptRunDependencies`-nél
 * (`interrupt-run.ts`): ez a téma nem indít futást és nem old fel providert,
 * csak a MÁR futó futásokat kérdezi le. A `createEngine` (T-005-28) a saját,
 * teljes `RunSupervisor` példányát adja majd ide.
 */
export interface ShutdownActiveRunsDependencies {
  readonly database: DatabaseContext;
  readonly runSupervisor: Pick<RunSupervisor, 'listActiveRuns'>;
  readonly agentQueryRegistry: AgentQueryRegistry;
}

/**
 * A szabályos leállás teljes menete (SPEC-004 10.2 szekció, PLAN-005
 * T-005-27), a `createEngine` (T-005-28) `shutdown()` metódusának alapja.
 * `SIGINT`/`SIGTERM` esetén a hívó ezt hívja meg:
 *
 * 1. **MINDEN aktív futás lekérdezése** (`runSupervisor.listActiveRuns()`,
 *    NEM egyetlen futás fájára szűkítve, ellentétben az `interruptRun`-nal -
 *    a szabályos leállás a TELJES szervert viszi le, nem egy felhasználói
 *    kérést szolgál ki egyetlen futásra).
 * 2. **`stopAndAwaitRunTree`** (MÁR KÉSZ, T-005-26 - lásd ott) mindegyikükre:
 *    a szabályozó egyikükből sem enged több lépést indulni, minden élő
 *    agent lépés `AgentQuery`-jén lefut az `interrupt()`, és a függvény
 *    megvárja mindegyik `completion` Promise-át (10.2 szekció 1 ... 2. pont,
 *    ugyanaz a menet, mint a 9. szekció megszakításnál).
 * 3. **`database.recovery.recoverInterruptedRuns('graceful_shutdown')`**
 *    (MÁR KÉSZ `db` réteg, a `reason` paraméter a T-005-27 bővítése, lásd
 *    `packages/db` `run-recovery.ts`): EGYETLEN tranzakcióban minden
 *    `pending`/`running` futás és nem terminális lépésük `interrupted`
 *    állapotba megy, futásonként egy `run_interrupted` eseménnyel (10.2
 *    szekció 3. pont).
 *
 * **Miért NEM kell külön `interruptRunTree`-szerű, `rootRunId` szerint
 * szűkített DB primitíva.** A `stopAndAwaitRunTree` utáni 2. lépés
 * (`recoverInterruptedRuns`) semmilyen `rootRunId` szűrést nem kap: a 10.2
 * szekció szabályos leállása a szerver ÖSSZES aktív futására hat, ami
 * pontosan a `recoverInterruptedRuns` MEGLÉVŐ, teljes adatbázisra kiterjedő
 * hatóköre (10.1 szekció, ugyanaz, amit az indulási helyreállítás is hív). A
 * `cancelRunTree` (`root_run_id` szerint szűkített, `interruptRun` a T-005-26
 * óta) egy MÁSIK forgatókönyv (felhasználói megszakítás egyetlen futásra),
 * nem ennek a függvénynek a felhasználási esete. Ez pontosan a SPEC-004 10.2
 * szekció "A szabályos és a durva leállás ugyanoda érkezik ... nem kell
 * külön ágat karbantartani" mondatának a közvetlen következménye: a `db`
 * oldali zárás a startup-recovery témával AZONOS hívás, csak eltérő `reason`
 * értékkel (lásd `startup-recovery/run-startup-recovery.ts`).
 */
export async function shutdownActiveRuns(
  dependencies: ShutdownActiveRunsDependencies,
): Promise<Outcome<RecoverInterruptedRunsResult>> {
  const handles = dependencies.runSupervisor.listActiveRuns();
  await stopAndAwaitRunTree(handles, dependencies.agentQueryRegistry);
  return dependencies.database.recovery.recoverInterruptedRuns('graceful_shutdown');
}
