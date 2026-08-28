import type { StepRunRecord } from '@easter-workflow-builder/db';
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
  | {
      readonly kind: 'failed';
      readonly stepRun: StepRunRecord;
      readonly errorKind: EngineErrorKind;
      readonly errorMessage: string;
    };
