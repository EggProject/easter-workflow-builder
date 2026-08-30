import { describe, expect, it } from 'vitest';
import type { Engine } from '@easter-workflow-builder/engine';
import type { WorkflowRunRecord } from '@easter-workflow-builder/db';
import { createRestartRunHandler } from './restart-run.ts';

function unused<TValue>(): Promise<TValue> {
  return Promise.reject(new Error('nem várt hívás'));
}

function buildFakeEngine(overrides: Partial<Engine>): Engine {
  return {
    startRun: () => unused(),
    interruptRun: () => unused(),
    decideApproval: () => unused(),
    restartRun: () => unused(),
    suggestedConcurrencyLimit: () => {
      throw new Error('nem várt hívás');
    },
    testProviderConnection: () => unused(),
    shutdown: () => unused(),
    ...overrides,
  };
}

/* eslint-disable unicorn/no-null -- a WorkflowRunRecord mezői valódi Date | null és string | null típusúak */
const RUN_RECORD: WorkflowRunRecord = {
  id: 'run-2',
  workflowId: 'wf-1',
  status: 'pending',
  input: {},
  providerId: 'claude-subscription',
  rootRunId: 'run-2',
  depth: 0,
  workflowAncestry: [],
  graphSnapshotHash: 'hash',
  persistedStreamDeltas: false,
  restartedFromRunId: 'run-1',
  createdAtMs: new Date(1000),
  startedAtMs: null,
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
};
/* eslint-enable unicorn/no-null */

describe('createRestartRunHandler', () => {
  it('sikeres esetben a motor eredményét StartedRunResponse alakra képezi', async () => {
    let seenRunId: string | undefined;
    const engine = buildFakeEngine({
      restartRun: (runId) => {
        seenRunId = runId;
        return Promise.resolve({ kind: 'ok', value: { run: RUN_RECORD } });
      },
    });
    const handler = createRestartRunHandler(engine);

    const result = await handler({ parameters: { runId: 'run-1' }, query: new URLSearchParams(), body: {} });

    expect(seenRunId).toBe('run-1');
    expect(result).toStrictEqual({ kind: 'ok', value: { status: 200, body: { runId: 'run-2', status: 'pending' } } });
  });

  it('a kérés törzs input mezője elhagyható', async () => {
    const engine = buildFakeEngine({ restartRun: () => Promise.resolve({ kind: 'ok', value: { run: RUN_RECORD } }) });
    const handler = createRestartRunHandler(engine);

    const result = await handler({ parameters: { runId: 'run-1' }, query: new URLSearchParams(), body: {} });

    expect(result.kind).toBe('ok');
  });

  it('a motor hibaágát változatlanul továbbadja', async () => {
    const engine = buildFakeEngine({
      restartRun: () => Promise.resolve({ kind: 'error', message: 'A(z) "run-1" futás nem található (not_found).' }),
    });
    const handler = createRestartRunHandler(engine);

    const result = await handler({ parameters: { runId: 'run-1' }, query: new URLSearchParams(), body: {} });

    expect(result.kind).toBe('error');
  });

  it('érvénytelen kérés törzsre invalid_request hibát ad, motor hívás nélkül', async () => {
    const engine = buildFakeEngine({});
    const handler = createRestartRunHandler(engine);

    const result = await handler({
      parameters: { runId: 'run-1' },
      query: new URLSearchParams(),
      body: { input: 'nem objektum' },
    });

    expect(result.kind).toBe('error');
  });

  it('hiányzó runId útvonal paraméterre üres stringgel hívja a motort', async () => {
    let seenRunId: string | undefined;
    const engine = buildFakeEngine({
      restartRun: (runId) => {
        seenRunId = runId;
        return Promise.resolve({ kind: 'error', message: 'A(z) "" futás nem található (not_found).' });
      },
    });
    const handler = createRestartRunHandler(engine);

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: {} });

    expect(seenRunId).toBe('');
    expect(result.kind).toBe('error');
  });
});
