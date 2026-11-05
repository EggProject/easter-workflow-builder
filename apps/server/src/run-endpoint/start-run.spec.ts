import { describe, expect, it } from 'vitest';
import type { Engine } from '@easter-workflow-builder/engine';
import { isGraphSnapshotHash, type GraphSnapshotHash, type WorkflowRunRecord } from '@easter-workflow-builder/db';
import { createStartRunHandler } from './start-run.ts';

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

// Egy tetszőleges, de érvényes alakú pillanatkép lenyomat a rekord fixtúrához: a
// `GraphSnapshotHash` névleges típus, tehát `as` nélkül csak a guard adhatja.
function snapshotHashOf(text: string): GraphSnapshotHash {
  if (!isGraphSnapshotHash(text)) {
    throw new Error(`a teszt lenyomata érvénytelen alakú: ${text}`);
  }
  return text;
}

const RUN_RECORD: WorkflowRunRecord = {
  id: 'run-1',
  workflowId: 'wf-1',
  status: 'running',
  input: {},
  providerId: 'claude-subscription',
  rootRunId: 'run-1',
  depth: 0,
  workflowAncestry: [],
  graphSnapshotHash: snapshotHashOf('a'.repeat(64)),
  persistedStreamDeltas: false,
  // eslint-disable-next-line unicorn/no-null -- a WorkflowRunRecord.restartedFromRunId mezője valódi string | null
  restartedFromRunId: null,
  createdAtMs: new Date(1000),
  startedAtMs: new Date(1000),
  // eslint-disable-next-line unicorn/no-null -- lásd fent
  finishedAtMs: null,
  // eslint-disable-next-line unicorn/no-null -- lásd fent
  errorKind: null,
  // eslint-disable-next-line unicorn/no-null -- lásd fent
  errorMessage: null,
};

describe('createStartRunHandler', () => {
  it('sikeres indításra a motor eredményét StartedRunResponse alakra képezi', async () => {
    let seenRequest: unknown;
    const engine = buildFakeEngine({
      startRun: (request) => {
        seenRequest = request;
        return Promise.resolve({ kind: 'ok', value: { run: RUN_RECORD } });
      },
    });
    const handler = createStartRunHandler(engine);

    const result = await handler({
      parameters: { workflowId: 'wf-1' },
      query: new URLSearchParams(),
      body: { input: { field: 'érték' } },
    });

    expect(result).toStrictEqual({ kind: 'ok', value: { status: 200, body: { runId: 'run-1', status: 'running' } } });
    expect(seenRequest).toStrictEqual({ workflowId: 'wf-1', input: { field: 'érték' } });
  });

  it('a motor hibaágát változatlanul továbbadja', async () => {
    const engine = buildFakeEngine({
      startRun: () => Promise.resolve({ kind: 'error', message: 'A(z) "wf-1" workflow nem található (not_found).' }),
    });
    const handler = createStartRunHandler(engine);

    const result = await handler({
      parameters: { workflowId: 'wf-1' },
      query: new URLSearchParams(),
      body: { input: {} },
    });

    expect(result.kind).toBe('error');
  });

  it('érvénytelen kérés törzsre invalid_request hibát ad, motor hívás nélkül', async () => {
    const engine = buildFakeEngine({});
    const handler = createStartRunHandler(engine);

    const result = await handler({
      parameters: { workflowId: 'wf-1' },
      query: new URLSearchParams(),
      body: { input: 'nem objektum' },
    });

    expect(result.kind).toBe('error');
  });

  it('hiányzó workflowId útvonal paraméterre üres stringgel hívja a motort', async () => {
    let seenRequest: unknown;
    const engine = buildFakeEngine({
      startRun: (request) => {
        seenRequest = request;
        return Promise.resolve({ kind: 'error', message: 'A(z) "" workflow nem található (not_found).' });
      },
    });
    const handler = createStartRunHandler(engine);

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: { input: {} } });

    expect(seenRequest).toStrictEqual({ workflowId: '', input: {} });
    expect(result.kind).toBe('error');
  });
});
