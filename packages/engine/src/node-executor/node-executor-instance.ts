import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';

/**
 * A `step_run` sorhoz kötött, node típustól független szerkezeti adatok
 * (SPEC-004 4.3 tábla). A hívó (a `run-supervisor`, T-005-25) állítja össze,
 * mert ő ismeri az ág hatókör vermet, tehát ő tudja levezetni:
 *
 * - `parentStepRunId`: a verem tetején álló hatókör bejegyzés `stepRunId`
 *   értéke, üres veremnél `null` (4.3).
 * - `iteration`: a legfelső `loop` bejegyzés `iteration` értéke, üres
 *   veremnél és fan-out tetőn 0 (4.3) - **kivéve a `loop` node saját sorát**,
 *   ahol ez a mező a 4.6 1. pontja szerinti, a példány addigi lefutásainak
 *   számát hordozza (a `scheduling` téma `resolveLoopIteration`
 *   függvényéből). A node-executor téma egyik függvénye sem számolja ki ezt
 *   az értéket, csak felhasználja - lásd az `execute-loop.ts` dokumentációját.
 * - `attempt`: a retry kísérlet sorszáma (8.2, T-005-24 tárgya); amíg az
 *   `error_handler` node nincs bekötve, ez mindig a hívó által átadott 1.
 *
 * A `providerId` a `ValidatedRun.effectiveProviderByNodeId` már feloldott
 * értéke (11.1), amit a `step_started` esemény és a `createStepRun` hívás is
 * felhasznál.
 *
 * A `failureStopsRun` azt mondja ki, hogy a példány `failed` kimenete a 8.3
 * `fail_run` politikát váltja ki (nincs `on_error` éle, és a politika
 * `fail_run`). A hívó a `resolveErrorRoute` döntéséből számítja, ugyanabból,
 * amivel a kimenetet később feldolgozza. Csak a helyet foglaló lépés olvassa
 * (`agent-node-lifecycle.ts`): a futás sorban álló testvéreit a saját
 * helyének felszabadítása ELŐTT kell kivennie a szabályozó sorából, mert a
 * felszabaduló helyet a sor következő eleme szinkron kapja meg, még mielőtt a
 * léptető hurok a bukásról tudna.
 */
export interface NodeExecutionInstance {
  readonly runId: string;
  readonly instance: StepInstanceReference;
  readonly parentStepRunId: string | null;
  readonly iteration: number;
  readonly attempt: number;
  readonly providerId: ProviderId;
  readonly failureStopsRun: boolean;
}
