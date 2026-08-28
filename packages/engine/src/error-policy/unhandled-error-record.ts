import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';

/**
 * Egy **kezeletlen** hiba, ami egy ágat elvitt (SPEC-004 8.3, 8.4). A
 * `run-supervisor` (T-005-25) minden olyan node példányra felvesz egy
 * bejegyzést, aminek a `resolveErrorRoute` `fail_run` vagy `fail_branch`
 * választ adott, **időrendben**: a lista első eleme a futás első kezeletlen
 * hibája, amiből a `workflow_run.error_kind` lesz (8.4).
 *
 * A `handled` route-tal továbbment hiba **nem** kerül a listába: azt egy
 * `error_handler` node fogadta, tehát az ág nem halt el. Ha a kezelő maga
 * bukik el (`unhandled_error_kind`, `retry_attempts_exhausted` `exhausted` él
 * nélkül), az a **kezelő** node saját kezeletlen hibája, és úgy is kerül ide.
 *
 * A bejegyzés szándékosan nem hordozza a politikát (`fail_run` vagy
 * `fail_branch`): a 8.4 szabálya mindkettőre azonos ("a futás `failed`
 * állapotban zár, ha bármely ág kezeletlen hibával halt el"), tehát a mező
 * egyetlen döntést sem befolyásolna.
 */
export interface UnhandledErrorRecord {
  readonly nodeId: string;
  readonly errorKind: EngineErrorKind;
}
