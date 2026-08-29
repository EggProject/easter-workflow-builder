import { describe, expect, it } from 'vitest';
import type { Engine } from '@easter-workflow-builder/engine';
import { createInterruptRunHandler } from './interrupt-run.ts';

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

describe('createInterruptRunHandler', () => {
  it('a motor eredményét változatlanul adja vissza', async () => {
    let seenRunId: string | undefined;
    const engine = buildFakeEngine({
      interruptRun: (runId) => {
        seenRunId = runId;
        return Promise.resolve({ kind: 'ok', value: { rootRunId: 'run-1', cancelledRunIds: ['run-2'] } });
      },
    });
    const handler = createInterruptRunHandler(engine);

    const result = await handler({ parameters: { runId: 'run-1' }, query: new URLSearchParams(), body: undefined });

    expect(seenRunId).toBe('run-1');
    expect(result).toStrictEqual({
      kind: 'ok',
      value: { status: 200, body: { rootRunId: 'run-1', cancelledRunIds: ['run-2'] } },
    });
  });

  it('a motor hibaágát változatlanul továbbadja', async () => {
    const engine = buildFakeEngine({
      interruptRun: () => Promise.resolve({ kind: 'error', message: 'A(z) "run-1" futás nem található (not_found).' }),
    });
    const handler = createInterruptRunHandler(engine);

    const result = await handler({ parameters: { runId: 'run-1' }, query: new URLSearchParams(), body: undefined });

    expect(result.kind).toBe('error');
  });

  it('hiányzó runId útvonal paraméterre üres stringgel hívja a motort', async () => {
    let seenRunId: string | undefined;
    const engine = buildFakeEngine({
      interruptRun: (runId) => {
        seenRunId = runId;
        return Promise.resolve({ kind: 'error', message: 'A(z) "" futás nem található (not_found).' });
      },
    });
    const handler = createInterruptRunHandler(engine);

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });

    expect(seenRunId).toBe('');
    expect(result.kind).toBe('error');
  });
});
