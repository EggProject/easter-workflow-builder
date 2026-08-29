/**
 * Az `Engine.shutdown` visszatérési értéke (SPEC-004 3.1 `Engine` felület,
 * 10.2 szekció, PLAN-005 T-005-28). A `run-interrupt` téma
 * `shutdownActiveRuns` függvénye (T-005-27) a `db` `RecoverInterruptedRunsResult`
 * alakját adja (`recoveredRunCount`); ez a típus a spec által megnevezett
 * `ShutdownSummary` névre illeszti ugyanazt a számot, `interruptedRunCount`
 * mezőnéven, mert a leállás szemantikája szerint a futások `interrupted`
 * állapotba kerülnek, nem "helyreállnak" (10.2 szekció "Miért `interrupted`
 * és nem `cancelled`").
 */
export interface ShutdownSummary {
  readonly interruptedRunCount: number;
}
