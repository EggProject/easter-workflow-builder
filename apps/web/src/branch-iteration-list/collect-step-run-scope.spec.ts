/* eslint-disable unicorn/no-null -- a szintetikus StepRunRecord fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { StepRunRecord } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { collectStepRunScope } from './collect-step-run-scope.ts';

const BASE_STEP_RUN: StepRunRecord = {
  id: 's-1',
  runId: 'r-1',
  nodeId: 'n-fan',
  nodeType: 'fan_out',
  parentStepRunId: null,
  iteration: 0,
  attempt: 1,
  status: 'succeeded',
  providerId: 'minimax',
  modelId: null,
  sessionMode: null,
  sdkSessionId: null,
  resumedFromSessionId: null,
  forkedSession: false,
  structuredOutputStrategy: null,
  output: null,
  resultSubtype: null,
  numTurns: null,
  inputTokens: null,
  outputTokens: null,
  cacheReadInputTokens: null,
  cacheCreationInputTokens: null,
  subWorkflowRunId: null,
  errorKind: null,
  errorMessage: null,
  startedAtMs: 10,
  finishedAtMs: 20,
  createdAtMs: 10,
};

function stepRun(overrides: Partial<StepRunRecord>): StepRunRecord {
  return { ...BASE_STEP_RUN, ...overrides };
}

/**
 * Egy szétosztás (`s-fan`) két ága (`s-a`, `s-b`), az egyik ágban egy
 * ciklus (`s-b` a ciklus lépés futása), aminek a törzsében egy lépés fut
 * (`s-b-body`). Mellette egy hatókörön kívüli lépés (`s-other`) és a
 * szétosztás után futó `join` (`s-join`), ami a hatókört leveszi.
 */
const STEP_RUNS: readonly StepRunRecord[] = [
  stepRun({ id: 's-fan', nodeId: 'n-fan' }),
  stepRun({ id: 's-a', nodeId: 'n-a', parentStepRunId: 's-fan' }),
  stepRun({ id: 's-b', nodeId: 'n-loop', parentStepRunId: 's-fan' }),
  stepRun({ id: 's-b-body', nodeId: 'n-body', parentStepRunId: 's-b', iteration: 1 }),
  stepRun({ id: 's-other', nodeId: 'n-other' }),
  stepRun({ id: 's-join', nodeId: 'n-join' }),
];

describe('collectStepRunScope', () => {
  it('a gyökér lépés futásokat és minden leszármazottjukat adja, a beágyazott hatókörrel együtt', () => {
    expect([...collectStepRunScope(['s-fan'], STEP_RUNS)]).toEqual(['s-fan', 's-a', 's-b', 's-b-body']);
  });

  it('egy belső lépés futásból indulva csak az ő ágát adja', () => {
    expect([...collectStepRunScope(['s-b'], STEP_RUNS)]).toEqual(['s-b', 's-b-body']);
  });

  it('leszármazott nélküli gyökérre csak a gyökeret adja', () => {
    expect([...collectStepRunScope(['s-a'], STEP_RUNS)]).toEqual(['s-a']);
  });

  it('több gyökérre mindegyik hatókörét összegyűjti', () => {
    expect([...collectStepRunScope(['s-a', 's-other'], STEP_RUNS)]).toEqual(['s-a', 's-other']);
  });

  it('gyökér nélkül üres halmazt ad', () => {
    expect(collectStepRunScope([], STEP_RUNS).size).toBe(0);
  });
});
