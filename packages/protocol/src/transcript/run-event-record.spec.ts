/* eslint-disable unicorn/no-null -- a RunEventRecord nullázható mezői (stepRunId, sdkMessageType, ...) a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { RunEventRecordSchema } from './run-event-record.ts';

const VALID_EVENT = {
  id: 42,
  runId: 'run-1',
  stepRunId: null,
  origin: 'engine',
  kind: 'run_started',
  occurredAtMs: 1,
  sdkMessageType: null,
  sdkMessageSubtype: null,
  sdkSessionId: null,
  sdkUuid: null,
  parentToolUseId: null,
  toolName: null,
  toolUseId: null,
  inputTokens: null,
  outputTokens: null,
  cacheReadInputTokens: null,
  cacheCreationInputTokens: null,
  numTurns: null,
  payload: { workflowId: 'wf-1' },
};

describe('RunEventRecordSchema', () => {
  it('elfogadja az érvényes eseményt, tetszőleges payload alakkal', () => {
    expect(RunEventRecordSchema.safeParse(VALID_EVENT).success).toBe(true);
  });

  it('elutasítja az érvénytelen kind értéket', () => {
    expect(RunEventRecordSchema.safeParse({ ...VALID_EVENT, kind: 'unknown' }).success).toBe(false);
  });

  it('elutasítja a nem pozitív id-t (a run_event.id AUTOINCREMENT, mindig pozitív)', () => {
    expect(RunEventRecordSchema.safeParse({ ...VALID_EVENT, id: 0 }).success).toBe(false);
  });
});
