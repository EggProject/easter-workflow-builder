import type { ConcurrencyGate } from '../concurrency-gate/concurrency-gate.ts';
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import type { ApprovalWaitRegistry } from './approval-wait-registry.ts';
import type { ChildWorkflowRunner } from './child-workflow-runner.ts';

/**
 * A diszpécser (`executeNode`) **minden lehetséges** függősége egyetlen
 * objektumban: minden ág csak a szükséges részhalmazt adja tovább.
 *
 * A T-005-20 `NodeExecutorPorts` hat portja ennek a `ports` mezőjében áll,
 * kibővítve: az `EngineDependencies` a teljes kilenc portot hordozza
 * (SPEC-004 3.2), ami szerkezetileg bővebb, mint a `NodeExecutorPorts`, tehát
 * a hat portot váró végrehajtók (`executeStart`, `executeBranch`,
 * `executeFanOut`, `executeLoop`, `executeJoinMerge`, `executeHumanApproval`,
 * `executeSubWorkflow`, `executeErrorHandler`) változtatás nélkül megkapják,
 * a kilencet váró kettő (`executeAgentStep`, `executeJoinAiSynthesis`) pedig
 * szintén. Egy külön, szűkített típus itt csak ugyanazokat a mezőket írná le
 * új néven (`.claude/CLAUDE.md` 5. szekció, "Minimum kód").
 *
 * A másik három mező **motoron belüli** függőség, nem a kilenc befecskendezett
 * port egyike (SPEC-004 3.2 lista zárt):
 *
 * - `concurrencyGate`: a providerenkénti, minden futásra közös szabályozó
 *   (7. szekció). Egyetlen példány, a hívó hozza létre
 *   (`createConcurrencyGate`); csak az `agent_step` és a `join`
 *   `ai_synthesis` ág adja tovább, mert a 7.2 táblázat szerint a többi
 *   node típus nem foglal helyet.
 * - `approvalRegistry`: a `human_approval` döntésre várásának regisztere
 *   (5.8), szintén egyetlen, megosztott példány
 *   (`createApprovalWaitRegistry`), amit a jövőbeli `decideApproval` motor
 *   művelet (T-005-28) is ugyanígy kap meg.
 * - `childWorkflowRunner`: az al-workflow indítás és megvárás képessége
 *   (5.9), amit a `run-supervisor` (T-005-25) **önmagára hivatkozva** tölt
 *   ki - ez oldja fel a `node-executor` és a `run-supervisor` közti kört
 *   (`child-workflow-runner.ts`).
 */
export interface NodeExecutorDependencies {
  readonly ports: EngineDependencies;
  readonly concurrencyGate: ConcurrencyGate;
  readonly approvalRegistry: ApprovalWaitRegistry;
  readonly childWorkflowRunner: ChildWorkflowRunner;
}
