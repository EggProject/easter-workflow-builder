/* eslint-disable unicorn/no-null -- a StepRunRecord nullázható mezői (parentStepRunId, modelId, sessionMode, ...) a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { StepRunRecordSchema } from './step-run-record.ts';

const VALID_STEP_RUN = {
  id: 'step-1',
  runId: 'run-1',
  nodeId: 'node-1',
  nodeType: 'agent_step',
  parentStepRunId: null,
  iteration: 0,
  attempt: 1,
  status: 'succeeded',
  providerId: 'minimax',
  modelId: 'minimax-m3',
  sessionMode: 'isolated',
  sdkSessionId: 'sess-1',
  resumedFromSessionId: null,
  forkedSession: false,
  structuredOutputStrategy: null,
  output: { result: 'ok' },
  resultSubtype: 'success',
  numTurns: 2,
  inputTokens: 100,
  outputTokens: 50,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
  subWorkflowRunId: null,
  errorKind: null,
  errorMessage: null,
  startedAtMs: 1,
  finishedAtMs: 2,
  createdAtMs: 0,
};

describe('StepRunRecordSchema', () => {
  it('elfogadja az érvényes lépés futás rekordot', () => {
    expect(StepRunRecordSchema.safeParse(VALID_STEP_RUN).success).toBe(true);
  });

  it('elutasítja az érvénytelen sessionMode értéket', () => {
    expect(StepRunRecordSchema.safeParse({ ...VALID_STEP_RUN, sessionMode: 'other' }).success).toBe(false);
  });

  it('elutasítja az ismeretlen kulcsot', () => {
    expect(StepRunRecordSchema.safeParse({ ...VALID_STEP_RUN, extra: 1 }).success).toBe(false);
  });
});
