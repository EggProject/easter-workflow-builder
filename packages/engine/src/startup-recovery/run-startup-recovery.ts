import type { Outcome } from '@easter-workflow-builder/core';
import type { RecoverInterruptedRunsResult } from '@easter-workflow-builder/db';
import type { DatabaseContext } from '../engine-port/database-port.ts';

/**
 * A `RunRecovery.recoverInterruptedRuns()` (MÁR KÉSZ `db` réteg, T-003-24)
 * VÉKONY burkolása a motor oldalán (SPEC-004 10.1 szekció, AC-53: "a
 * `startupRecovery` téma a `RunRecovery` műveletét burkolja"). A motor a
 * `reason` paramétert szó szerint `'startup_recovery'` értékkel adja tovább:
 * ez a `db` `recoverInterruptedRuns(reason)` KÉT hívási útja közül az
 * INDULÁSI (nem a szabályos leállási, azt a `run-interrupt` téma
 * `shutdownActiveRuns` függvénye hívja `'graceful_shutdown'` értékkel, lásd
 * ott).
 *
 * **A hívó sorrendje** (SPEC-004 10.1 szekció, szó szerint): a `db` csomag
 * kapcsolat-nyitó függvénye (a migrációkat is lefuttatva), majd
 * `runStartupRecovery(database)`, MÉG MIELŐTT bármilyen hálózati kapcsolatot
 * fogadna a szerver, és csak ezután `createEngine(...)`. Ezt a sorrendet ez a
 * téma NEM tudja saját magában kikényszeríteni: a `db` port SZERKEZETILEG
 * zárja ki a fordított sorrendet, mert a motor (és minden témája, ez is) a
 * `DatabaseContext`-et KAPJA paraméterként, nem maga nyitja (a kapcsolat-nyitó
 * függvény nem szerepel a motor kilenc portja között, SPEC-004 3.2). A
 * ténylegesen betartatott, `apps/server` oldali sorrend ezen a specen KÍVÜL
 * esik (AC-53 "a `apps/server` erre épülő sorrendjét regressziós teszt őrzi"
 * fordulata egy KÉSŐBBI specifikációra mutat); ez a téma azt a garanciát
 * adja, hogy a motor MAGA soha nem nyitja meg az adatbázis kapcsolatot (lásd
 * `engine-never-opens-database.spec.ts`), tehát a sorrend megfordítására
 * nincs mód a motor kódjából.
 */
export function runStartupRecovery(database: DatabaseContext): Outcome<RecoverInterruptedRunsResult> {
  return database.recovery.recoverInterruptedRuns('startup_recovery');
}
