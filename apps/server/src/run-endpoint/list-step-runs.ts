import type { DatabaseContext, StepRunRecord } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

/**
 * A `db` réteg `StepRunRecord`-ja a drótszintű `StepRunRecord` alakra
 * (SPEC-005 4.2 B táblázat 13. sora). A `Date` mezők egész milliszekundum
 * lesznek; a `nodeType`/`sessionMode`/`structuredOutputStrategy` a `db`
 * oldalon raw string (nincs hozzá bejegyzett domain guard,
 * `packages/db` CLAUDE.md), a kimenő oldalon nem validálunk (SPEC-006 5.2),
 * ezért a mezők változatlanul, szűkítés nélkül mennek ki.
 */
function toWireStepRun(record: StepRunRecord) {
  return {
    id: record.id,
    runId: record.runId,
    nodeId: record.nodeId,
    nodeType: record.nodeType,
    parentStepRunId: record.parentStepRunId,
    iteration: record.iteration,
    attempt: record.attempt,
    status: record.status,
    providerId: record.providerId,
    modelId: record.modelId,
    sessionMode: record.sessionMode,
    sdkSessionId: record.sdkSessionId,
    resumedFromSessionId: record.resumedFromSessionId,
    forkedSession: record.forkedSession,
    structuredOutputStrategy: record.structuredOutputStrategy,
    output: record.output,
    resultSubtype: record.resultSubtype,
    numTurns: record.numTurns,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    cacheReadInputTokens: record.cacheReadInputTokens,
    cacheCreationInputTokens: record.cacheCreationInputTokens,
    subWorkflowRunId: record.subWorkflowRunId,
    errorKind: record.errorKind,
    errorMessage: record.errorMessage,
    // eslint-disable-next-line unicorn/no-null -- a StepRunRecord.startedAtMs/finishedAtMs mezője valódi Date | null
    startedAtMs: record.startedAtMs === null ? null : record.startedAtMs.getTime(),
    // eslint-disable-next-line unicorn/no-null -- lásd fent
    finishedAtMs: record.finishedAtMs === null ? null : record.finishedAtMs.getTime(),
    createdAtMs: record.createdAtMs.getTime(),
  };
}

/**
 * `GET /api/runs/{runId}/steps` (SPEC-005 4.2 B táblázat 13. sora). A
 * `stepRuns.listStepRuns` önmagában nem hibázna ismeretlen `runId`-ra (üres
 * listát adna), ezért a kezelő előbb `runs.getRun`-nal ellenőriz, a spec
 * által elvárt `not_found` hibaágért - ugyanaz a minta, mint a
 * `workflow-endpoint/replace-workflow-graph.ts`-ben.
 */
export function createListStepRunsHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const runId = context.parameters['runId'] ?? '';
    const run = database.runs.getRun(runId);
    if (run.kind === 'error') {
      return Promise.resolve(run);
    }

    const listed = database.stepRuns.listStepRuns(runId);
    if (listed.kind === 'error') {
      return Promise.resolve(listed);
    }

    return Promise.resolve({
      kind: 'ok',
      value: { status: 200, body: listed.value.map((record) => toWireStepRun(record)) },
    });
  };
}
