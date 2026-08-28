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
 */
export interface NodeExecutionInstance {
  readonly runId: string;
  readonly instance: StepInstanceReference;
  readonly parentStepRunId: string | null;
  readonly iteration: number;
  readonly attempt: number;
  readonly providerId: ProviderId;
}
