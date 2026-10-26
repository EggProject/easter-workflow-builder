import type { RunDetail, StepRunRecord } from '@easter-workflow-builder/protocol';
import type { ProbeSummary } from './probe-summary.ts';

/**
 * A futás és a lépés futás rekordjából, plusz a streamen mért szöveg hosszból a
 * próba összegzése. A hibaosztály a
 * futás, hiányában a lépés `errorKind` mezője (SPEC-012 5.1 4. lépés).
 */
export function summarizeRun(
  providerId: string,
  run: RunDetail,
  stepRuns: readonly StepRunRecord[],
  outputTextLength: number | undefined,
): ProbeSummary {
  const step = stepRuns.find((candidate) => candidate.nodeType === 'agent_step');
  return {
    providerId,
    runStatus: run.status,
    stepStatus: step?.status,
    resultSubtype: step?.resultSubtype ?? undefined,
    numTurns: step?.numTurns ?? undefined,
    outputTextLength,
    errorClass: run.errorKind ?? step?.errorKind ?? undefined,
  };
}
