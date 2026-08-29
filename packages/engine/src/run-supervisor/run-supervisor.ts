import type { Outcome } from '@easter-workflow-builder/core';
import type { StartRunParentContext, WorkflowRunRecord } from '@easter-workflow-builder/db';
import type { ConcurrencyGate } from '../concurrency-gate/concurrency-gate.ts';
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import type { ApprovalWaitRegistry } from '../node-executor/approval-wait-registry.ts';
import type { ChildWorkflowRunner } from '../node-executor/child-workflow-runner.ts';
import type { AgentQueryRegistry } from '../run-interrupt/agent-query-registry.ts';
import type { ActiveRunHandle } from './active-run-registry.ts';

/**
 * A futás indításának kérése (SPEC-004 4.8 menet bemenete).
 *
 * - `workflowId`: melyik workflow induljon.
 * - `input`: a futás bemenete, mező név -> érték. **Rekord, nem `unknown`**,
 *   mert a 4.8 4. lépése a `start` node `inputFields` listája ellen
 *   ellenőrzi, tehát mező szerint kell tudni olvasni; ugyanez az érték megy a
 *   `workflow_run.input` oszlopba és a `start` node kimenetébe (5. szekció 1. sora).
 * - `parent`: al-workflow hívásnál a **szülő** futás
 *   `rootRunId`/`depth`/`workflowAncestry` hármasa, változatlanul (5.9 3. pont).
 *   Gyökér futásnál hiányzik, és a `db` `startRun` vezeti le a gyökér
 *   értékeket (SPEC-003 4.8).
 * - `restartedFromRunId`: a `restartRun` motor művelet (`restart-run.ts`,
 *   PLAN-005 T-005-27) tölti ki az EREDETI futás azonosítójával, amikor egy
 *   korábbi futást indít újra a workflow **aktuális** állapotára (SPEC-004 9.
 *   szekció zárómondata, SPEC-003 27. kritérium). A `db` `startRun`
 *   változatlanul a `StartRunInput.restartedFromRunId` mezőbe írja, ami a
 *   `workflow_run.restarted_from_run_id` FK oszlopra képződik le.
 */
export interface StartRunRequest {
  readonly workflowId: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly parent?: StartRunParentContext;
  readonly restartedFromRunId?: string;
}

/**
 * A `startRun` sikeres eredménye (SPEC-004 3.1 `Engine.startRun`): a már
 * `running` állapotba vitt futás rekordja.
 *
 * **A futás ekkor még nem ért véget**, és szándékosan nem is várjuk meg: a
 * hívó (a HTTP réteg) azonnali választ vár, az előrehaladást pedig az
 * `eventPublisher` porton át az élő WebSocket nézet közvetíti (13. szekció).
 * A futás léptetése ettől kezdve háttérben megy, és a hozzá tartozó
 * `ActiveRunHandle` a `getActiveRun` hívással érhető el.
 */
export interface StartedRun {
  readonly run: WorkflowRunRecord;
}

/**
 * A `run-supervisor` téma függőségei.
 *
 * A `ports` a kilenc befecskendezett port (SPEC-004 3.2). A másik három mező
 * **motoron belüli** együttműködő, nem port:
 *
 * - `concurrencyGate`: egyetlen, minden futásra közös szabályozó (7.1). A
 *   `run-supervisor` nem hozza létre, mert a `suggestedConcurrencyLimit`
 *   motor művelet (T-005-28) ugyanezt a példányt kérdezi.
 * - `approvalRegistry`: egyetlen, minden futásra közös regiszter (5.8). A
 *   `decideApproval` motor művelet (T-005-28) ugyanezen a példányon hívja a
 *   `notifyDecided`-et.
 * - `agentQueryRegistry`: az élő `AgentQuery` objektumok nyilvántartása
 *   (9. szekció 3. pont, PLAN-005 T-005-26), szintén egyetlen, megosztott
 *   példány (`createAgentQueryRegistry`); az `interruptRun` (`run-interrupt`
 *   téma) ugyanezt a példányt kapja meg, hogy a futás fáján élő lépéseket
 *   megtalálja.
 * - `installedAgentSdkVersion`: a **telepített** Agent SDK verziója. Két
 *   helyre kell: a `validateSdkVersionMatch` ellenőrzéshez (11.3 táblázat 17. sora) és a pillanatkép dokumentum `sdkVersionPin` mezőjéhez (SPEC-003 5.1).
 *   **Miért paraméter és nem import.** A motor nem függ az Agent SDK-tól
 *   (17. szekció 58. kritérium), tehát a verziót nem kérdezheti le; az érték
 *   előállítása az összeállításé, aminek egyetlen ellenőrzött forrása a
 *   `@easter-workflow-builder/agent` csomag `INSTALLED_AGENT_SDK_VERSION`
 *   konstansa. Paraméterként a teszt mindkét ágat (egyező és eltérő verzió)
 *   közvetlenül elő tudja idézni.
 */
export interface RunSupervisorDependencies {
  readonly ports: EngineDependencies;
  readonly concurrencyGate: ConcurrencyGate;
  readonly approvalRegistry: ApprovalWaitRegistry;
  readonly agentQueryRegistry: AgentQueryRegistry;
  readonly installedAgentSdkVersion: string;
}

/**
 * A futás életciklusának vezetője (SPEC-004 4.8, 4.4 ... 4.6, 8.4).
 *
 * **A `ChildWorkflowRunner` kiterjesztése nem véletlen**: a `sub_workflow`
 * végrehajtónak pontosan az a képesség kell, amit ez a téma nyújt, és a kört
 * a rekurzió oldja fel - a `run-supervisor` **önmagát** adja át
 * `ChildWorkflowRunner`-ként a `node-executor` rétegnek
 * (`child-workflow-runner.ts` doksija).
 *
 * A `startRun` **szinkron**, mert a 4.8 menet 1 ... 7. lépése egyetlen `await`
 * pontot sem tartalmaz: a `db` csomag minden művelete szinkron
 * (`better-sqlite3`). A `SPEC-004` 3.1 szekció `Engine.startRun` szignatúrája
 * `Promise`-t ad; a burkolást a `createEngine` (T-005-28) végzi el, ahogy a
 * `startChildRun` is teszi itt.
 */
export interface RunSupervisor extends ChildWorkflowRunner {
  readonly startRun: (request: StartRunRequest) => Outcome<StartedRun>;

  /**
   * A jelenleg futó (nem terminális) futások kézikönyvei. A `run-interrupt`
   * téma (T-005-26) ebből választja ki a megszakítandó fát az azonos
   * `rootRunId` alapján (9. szekció 3. pont), a `shutdown` (T-005-28) pedig
   * ezen a listán megy végig.
   */
  readonly listActiveRuns: () => readonly ActiveRunHandle[];

  /**
   * Egy adott futás kézikönyve, vagy `undefined`, ha a futás már terminális
   * (a kézikönyv a lezáráskor kiesik a nyilvántartásból).
   */
  readonly getActiveRun: (runId: string) => ActiveRunHandle | undefined;
}
