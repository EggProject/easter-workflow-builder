import type { RunDetail, StepRunRecord } from '@easter-workflow-builder/protocol';
import type { ProbeSummary } from './probe-summary.ts';
import type { RunFinishedObservation } from './wait-for-run-finished.ts';

/**
 * A futás és a lépés futás rekordjából, plusz a stream megfigyeléséből (szöveg hossz, az `init` skilljei és MCP állapotai) a
 * próba összegzése. A hibaosztály a
 * futás, hiányában a lépés `errorKind` mezője (SPEC-012 5.1 4. lépés).
 */
export function summarizeRun(
  providerId: string,
  run: RunDetail,
  stepRuns: readonly StepRunRecord[],
  finished: RunFinishedObservation,
): ProbeSummary {
  const step = stepRuns.find((candidate) => candidate.nodeType === 'agent_step');
  return {
    providerId,
    runStatus: run.status,
    stepStatus: step?.status,
    resultSubtype: step?.resultSubtype ?? undefined,
    numTurns: step?.numTurns ?? undefined,
    outputTextLength: finished.resultTextLength,
    errorClass: run.errorKind ?? step?.errorKind ?? undefined,
    initPluginSkills: finished.initPluginSkills,
    initMcpServers: finished.initMcpServers,
  };
}
