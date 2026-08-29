/**
 * Az `Engine.interruptRun` visszatérési értéke (SPEC-004 3.1 `Engine`
 * felület, PLAN-005 T-005-28). A `run-interrupt` téma `interruptRun` függvénye
 * (T-005-26) már előállítja a benne rejlő adatokat (`InterruptRunResult`,
 * `rootRunId` és `cancelledRunIds`); ez a fájl kizárólag a spec által
 * megnevezett `InterruptSummary` névre illeszti, új mező vagy átalakítás
 * nélkül - lásd a `run-interrupt/interrupt-run.ts` doksiját ("ennek a végleges
 * alakját és a `createEngine` felület felé történő illesztését a T-005-28
 * végzi el").
 */
export type { InterruptRunResult as InterruptSummary } from '../run-interrupt/interrupt-run.ts';
