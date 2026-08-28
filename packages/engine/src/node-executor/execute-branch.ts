import { isString } from '@easter-workflow-builder/typeguards';
import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { RunContext } from '../run-context/run-context.ts';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import { beginStepRun } from './begin-step-run.ts';
import { emitEngineEvent } from './emit-engine-event.ts';
import { finishStepRunFailed } from './finish-step-run-failed.ts';
import { finishStepRunSucceeded } from './finish-step-run-succeeded.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';
import type { NodeExecutionOutcome } from './node-executor-outcome.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

type BranchNodeConfig = Extract<ExecutableNodeConfig, { readonly type: 'branch' }>;

/**
 * A `branch` node bemenete (SPEC-004 5. szekció 3. sora). Az
 * `availableBranchKeys` a node ténylegesen bekötött, `on_error`-tól
 * különböző kimenő éleinek `branch_key` értéke (a hívó, a `run-supervisor`
 * adja át, az `ExecutableGraph.outgoingEdges`-ből): ez **nem** ugyanaz, mint
 * a `config.branches[].key` lista, mert a 4.7 validáció csak azt garantálja,
 * hogy minden ÉL kulcsa szerepel a `branches[]` listában, a fordítottját nem
 * (egy konfigurált branch opcióhoz nem biztos, hogy tartozik él). A
 * `branch_no_matching_edge` hiba pontosan ez ellen véd: a döntést a tényleges
 * élekhez, nem a config listához méri.
 *
 * Ezért ez a téma **nem** kapja meg a teljes `ExecutableGraph`-ot: a
 * `branch_no_matching_edge` eldöntéséhez elég a kulcsok listája, a
 * `selectedBranchKey` (a kimenet mezője) pedig elég a hívónak ahhoz, hogy a
 * gráf éleiből levezesse a `live`/`dead` jelöléseket.
 */
export interface ExecuteBranchInput {
  readonly instance: NodeExecutionInstance;
  readonly config: BranchNodeConfig;
  readonly runContext: RunContext;
  readonly availableBranchKeys: readonly string[];
}

interface BranchTarget {
  readonly key: string;
  readonly usedDefault: boolean;
}

/**
 * A kiértékelt kifejezés eredményét a bekötött élekhez illeszti (SPEC-004
 * 5. szekció 3. sora). Ha az eredmény nem string, az sosem illeszkedhet
 * kulcshoz - ez nem külön hibaeset, hanem "nincs egyezés", ugyanúgy, mintha
 * egy string eredmény nem szerepelne az élek között; a spec csak azt mondja
 * ki, hogy az eredmény "várhatóan string", nem nevez meg külön hibaosztályt a
 * típuseltérésre.
 */
function resolveBranchTarget(
  evaluated: unknown,
  config: BranchNodeConfig,
  availableBranchKeys: readonly string[],
): BranchTarget | undefined {
  if (isString(evaluated) && availableBranchKeys.includes(evaluated)) {
    return { key: evaluated, usedDefault: false };
  }
  if (config.defaultBranchKey !== null && availableBranchKeys.includes(config.defaultBranchKey)) {
    return { key: config.defaultBranchKey, usedDefault: true };
  }
  return undefined;
}

/**
 * A záró hibaág: egyetlen hívási pont mindkét saját hibaosztálynak
 * (`expression_evaluation_failed`, `branch_no_matching_edge`), hogy a
 * `finishStepRunFailed` esetleges DB hibája ne duplikálódjon két külön,
 * egyenként tesztelendő ágba.
 */
function failBranch(
  runId: string,
  stepRunId: string,
  startedAtMs: number,
  errorKind: 'expression_evaluation_failed' | 'branch_no_matching_edge',
  errorMessage: string,
  ports: NodeExecutorPorts,
): Outcome<NodeExecutionOutcome> {
  const failed = finishStepRunFailed({ runId, stepRunId, startedAtMs, errorKind, errorMessage }, ports);
  if (failed.kind === 'error') {
    return failed;
  }
  return { kind: 'ok', value: { kind: 'failed', stepRun: failed.value, errorKind, errorMessage } };
}

/**
 * A `branch` node végrehajtója: determinisztikus elágazás, NEM AI (SPEC-004
 * 5. szekció 3. sora). Kiértékeli az `expression`-t, az eredményt a bekötött
 * kimenő élek `branch_key` értékéhez illeszti - egyezés hiányában az
 * `defaultBranchKey`-t használja, ha az is illeszkedik egy élhez -, és
 * `branch_taken` eseményt ír. A `branch` node kimenete erre a témára szűkítve
 * `null`: a node nem transzformál adatot, csak dönt (értelmezési döntés, a
 * spec nem nevez meg kimenetet a `branch` sorra).
 */
export function executeBranch(input: ExecuteBranchInput, ports: NodeExecutorPorts): Outcome<NodeExecutionOutcome> {
  const { instance, config, runContext, availableBranchKeys } = input;
  const nodeId = instance.instance.nodeId;

  /* eslint-disable unicorn/no-null -- a `branch` node nem agent lépés, nincs modellje, session módja, strukturált kimenet stratégiája vagy al-workflow futása (SPEC-003 9.2) */
  const began = beginStepRun(
    {
      runId: instance.runId,
      nodeId,
      nodeType: 'branch',
      parentStepRunId: instance.parentStepRunId,
      iteration: instance.iteration,
      attempt: instance.attempt,
      providerId: instance.providerId,
      modelId: null,
      sessionMode: null,
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    },
    ports,
  );
  /* eslint-enable unicorn/no-null */
  if (began.kind === 'error') {
    return began;
  }
  const stepRunId = began.value.stepRun.id;
  const { runId } = instance;
  const { startedAtMs } = began.value;

  const evaluated = ports.expressionEvaluator.evaluate(config.expression, runContext);
  if (evaluated.kind === 'error') {
    const errorMessage = formatEngineErrorMessage(
      'expression_evaluation_failed',
      `A(z) "${nodeId}" branch node "${config.expression}" kifejezésének kiértékelése sikertelen: ${evaluated.message}`,
    );
    return failBranch(runId, stepRunId, startedAtMs, 'expression_evaluation_failed', errorMessage, ports);
  }

  const target = resolveBranchTarget(evaluated.value, config, availableBranchKeys);
  if (target === undefined) {
    const errorMessage = formatEngineErrorMessage(
      'branch_no_matching_edge',
      `A(z) "${nodeId}" branch node kiértékelt kulcsa nem illeszkedik egyetlen kimenő élhez sem, és nincs használható alapértelmezett ág`,
    );
    return failBranch(runId, stepRunId, startedAtMs, 'branch_no_matching_edge', errorMessage, ports);
  }

  /* eslint-disable-next-line unicorn/no-null -- a `branch` node kimenete szándékosan `null` (lásd a fájl doksiját); vezérlést hordoz, adatot nem */
  const finished = finishStepRunSucceeded({ runId, stepRunId, startedAtMs, output: null }, ports);
  if (finished.kind === 'error') {
    return finished;
  }

  /* eslint-disable-next-line unicorn/no-null -- a `BranchTakenPayload.branchKey` `null`, ha a `branch` node az alapértelmezett élre lépett (`branch-taken-payload.ts` szerződése) */
  const branchKey = target.usedDefault ? null : target.key;
  const emitted = emitEngineEvent(
    { kind: 'branch_taken', runId, stepRunId, payload: { branchKey, usedDefault: target.usedDefault } },
    ports,
  );
  if (emitted.kind === 'error') {
    return emitted;
  }

  return { kind: 'ok', value: { kind: 'succeeded', stepRun: finished.value, selectedBranchKey: target.key } };
}
