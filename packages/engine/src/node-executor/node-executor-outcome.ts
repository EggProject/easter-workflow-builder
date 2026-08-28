import type { ApprovalDecision, StepRunRecord } from '@easter-workflow-builder/db';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';

/**
 * Egy MÁR lezárult node példány végrehajtásának kimenete. Ez a felület, amiből
 * a `run-supervisor` (T-005-25) a `scheduling` téma `SchedulingEvent` értékét
 * építi (`advanceScheduler` bemenete, SPEC-004 4.4 ... 4.6): a node-executor
 * réteg maga **soha** nem hívja az `advanceScheduler`-t, csak egy adott,
 * futtathatónak talált node PÉLDÁNY tényleges végrehajtását végzi (DB írás +
 * esemény), és ezt a struktúrát adja vissza.
 *
 * A négy ág egy-egy `SchedulingEvent` ágnak felel meg:
 *
 * - `succeeded` -> `{ kind: 'node_completed', instance, liveEdgeIds }`. A
 *   `selectedBranchKey` a döntés: `null` azt jelenti, hogy a node NEM
 *   elágazó (a `start`, a `fan_out` sikeres kibontása utáni `join`, illetve
 *   a `join` `merge` módja) - ilyenkor a `SchedulingEvent.liveEdgeIds`-t a
 *   hívó a node **minden**, `on_error`-tól különböző kimenő éléből építi
 *   (SPEC-004 4.4 4. pont: "a legtöbb típusnál minden kimenő él `live`",
 *   `advance-scheduler.spec.ts` `completeAll` segédje ugyanezt a mintát
 *   használja). Nem `null` érték a `branch` node ténylegesen választott
 *   kulcsa - ilyenkor a hívó csak a `branchKey === selectedBranchKey` élt
 *   (éleket) jelöli `live`-nak (`advance-scheduler.spec.ts`
 *   `completeWithBranchKey` segédje). Ez a mező azért **nem** maga a
 *   `liveEdgeIds` halmaz, mert az él azonosítók a gráf tulajdonai, a
 *   node-executor téma viszont szándékosan nem kapja meg a teljes
 *   `ExecutableGraph`-ot (lásd `execute-branch.ts` dokumentációját) - a
 *   döntést a hívó fordítja le tényleges él azonosítókra.
 * - `fan_out_expanded` -> `{ kind: 'fan_out_expanded', instance, stepRunId,
 *   items }`. A `stepRun.id` adja a `stepRunId`-t.
 * - `loop_advanced` -> `{ kind: 'loop_advanced', instance, stepRunId,
 *   shouldContinue }`. A `stepRun.id` adja a `stepRunId`-t.
 * - `approval_decided` -> a `human_approval` node döntés utáni lezárása
 *   (SPEC-004 5.8, PLAN-005 T-005-22). A `decision` mező közvetlenül a
 *   `db` `ApprovalDecision` uniója (`'approved' | 'rejected'`), és a hívó
 *   (jövőbeli `run-supervisor`, T-005-25) ebből építi a `SchedulingEvent`-et:
 *   `approved` esetén ugyanaz a `node_completed` jelleg, mint egy `branch`
 *   node kiválasztott ágánál (a `branch_key` szó szerint `'approved'`, 4.2
 *   táblázat), `rejected` esetén pedig a hívónak kell eldöntenie, van-e
 *   kimenő `rejected` `branch_key` él - ha nincs, a 8.3 hibapolitika lép
 *   életbe (`error-policy` téma, T-005-24). **A node-executor réteg ezt a
 *   döntést itt sem hozza meg** (ugyanaz az elv, mint a `failed` ágnál):
 *   csak a `stepRun` rekordot (a `db` `decideApproval` már elvégezte a
 *   `waiting_approval -> succeeded`/`rejected` átmenetet, ezt a végrehajtó
 *   `getStepRun`-nal olvassa vissza) és a döntést adja vissza.
 * - `retry_scheduled` -> az `error_handler` node végrehajtója ütemezett egy
 *   újabb kísérletet (SPEC-004 8.2 4. pont). A `stepRun` az `error_handler`
 *   **saját**, `succeeded` állapotban lezárt sora, a `nextAttempt` pedig az
 *   az `attempt` sorszám, amivel a hibát adó node új `step_run` sort kap
 *   (`attempt + 1`). A vezérlés a **megismételt node** saját kimenő élein megy
 *   tovább, NEM az `error_handler` élein (8.2 5. pont), tehát ebből az ágból
 *   a hívó nem épít `SchedulingEvent`-et az `error_handler` node-ra: a
 *   megismételt példányt kell futtatnia.
 *
 *   **A sort maga a végrehajtó NEM hozza létre** (a T-005-24 óta nyitva állt
 *   szerkezeti kérdés lezárása, T-005-25). A SPEC-004 8.2 4. pontja passzív
 *   alakban fogalmaz ("a hibát adó node új `step_run` sort **kap**"), tehát
 *   nem köti ki, ki írja a sort. Ha az `error_handler` végrehajtója írná, a
 *   `run-supervisor` a megismételt példányt a szokásos `executeNode` úton
 *   futtatva a `beginStepRun`-on át **még egy** sort hozna létre ugyanarra a
 *   kísérletre. A `nextAttempt` átadásával minden kísérlethez pontosan egy
 *   sor tartozik, és az is ugyanazon a közös nyitó menten (`beginStepRun`)
 *   keletkezik, mint minden más lépés sora - node típusonként helyes
 *   `nodeType`, `modelId`, `sessionMode` és `structuredOutputStrategy`
 *   mezővel, amiket a `run-supervisor` nem tudna kitalálni.
 * - `retry_exhausted` -> minden kísérlet elfogyott (8.2 2. pont). Az
 *   `error_handler` saját sora `failed` állapotban zárt
 *   `retry_attempts_exhausted` osztállyal, és a vezérlés az `exhausted` élre
 *   megy, ha van ilyen; ha nincs, a 8.3 politika következik. Ez a
 *   megkülönböztetés azért külön ág és nem a `failed` ág, mert itt a
 *   menekülő él `branch_key` értéke `exhausted`, nem `on_error`
 *   (`resolveErrorRoute` `escapeKey` paramétere).
 * - `failed` -> a hívó dönt (8.1, 8.3 szekció, `error-policy` téma,
 *   T-005-24): van-e `on_error` él, és ha nincs, `fail_run` vagy
 *   `fail_branch` a node config `onUnhandledError` mezője szerint. A
 *   node-executor réteg ezt a döntést **nem** hozza meg, csak a `step_run`
 *   `failed` lezárását és a hibaosztályt adja vissza (SPEC-004 5. szekció
 *   "Közös szabályok", a hibapolitika a `error-policy` témáé).
 *
 * Minden ág hordozza a lezárt `stepRun` rekordot (`StepRunRecord`), mert az
 * mind a négy esetben létezik: a `begin-step-run.ts` már létrehozta és
 * `running` állapotba vitte, a végrehajtó pedig valamelyik záró
 * `markStep*`-tel lezárta.
 */
export type NodeExecutionOutcome =
  | { readonly kind: 'succeeded'; readonly stepRun: StepRunRecord; readonly selectedBranchKey: string | null }
  | { readonly kind: 'fan_out_expanded'; readonly stepRun: StepRunRecord; readonly items: readonly unknown[] }
  | { readonly kind: 'loop_advanced'; readonly stepRun: StepRunRecord; readonly shouldContinue: boolean }
  | { readonly kind: 'approval_decided'; readonly stepRun: StepRunRecord; readonly decision: ApprovalDecision }
  | { readonly kind: 'retry_scheduled'; readonly stepRun: StepRunRecord; readonly nextAttempt: number }
  | {
      readonly kind: 'retry_exhausted';
      readonly stepRun: StepRunRecord;
      readonly errorKind: 'retry_attempts_exhausted';
      readonly errorMessage: string;
    }
  | {
      readonly kind: 'failed';
      readonly stepRun: StepRunRecord;
      readonly errorKind: EngineErrorKind;
      readonly errorMessage: string;
    };
