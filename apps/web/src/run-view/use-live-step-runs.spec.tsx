/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { RunEventKind, StepRunRecord, StreamFrame } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SubscribeToStreamFrames } from '../stream-client/subscribe-to-stream-frames.ts';
import { useLiveStepRuns, type LiveStepRuns } from './use-live-step-runs.ts';

const API_ORIGIN = 'https://api.example.test';

const RUNNING_STEP_RUN: StepRunRecord = {
  id: 's-1',
  runId: 'r-1',
  nodeId: 'n-1',
  nodeType: 'agent_step',
  parentStepRunId: null,
  iteration: 0,
  attempt: 1,
  status: 'running',
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
  startedAtMs: 20,
  finishedAtMs: null,
  createdAtMs: 20,
};

const SUCCEEDED_STEP_RUN: StepRunRecord = { ...RUNNING_STEP_RUN, status: 'succeeded', finishedAtMs: 30 };

/**
 * A veszteségmentes keret feliratkozás teszt duplikátuma, ugyanaz a minta,
 * mint a `RunViewScreen.spec.tsx`-ben.
 */
const frameListeners = new Set<(frame: StreamFrame) => void>();

const subscribeToFrames: SubscribeToStreamFrames = (listener) => {
  frameListeners.add(listener);
  return () => {
    frameListeners.delete(listener);
  };
};

function emitFrame(frame: StreamFrame): void {
  for (const listener of frameListeners) {
    listener(frame);
  }
}

function runEventFrame(kind: RunEventKind, delivery: 'live' | 'replayed', id: number, runId = 'r-1'): StreamFrame {
  return {
    event: 'run_event',
    delivery,
    runEvent: {
      id,
      runId,
      stepRunId: 's-1',
      origin: 'engine',
      kind,
      occurredAtMs: id,
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
      payload: {},
    },
  };
}

/**
 * A `GET /api/runs/{runId}/steps` válaszainak sora: a hívások sorban kapják
 * a `responses` elemeit, az utolsó ismétlődik. A `urls` a hívások naplója.
 */
function createStepRunsFetch(responses: readonly (readonly StepRunRecord[] | Error)[], urls: string[]): FetchFunction {
  return (input) => {
    urls.push(new URL(input).pathname);
    const response = responses[Math.min(urls.length, responses.length) - 1];
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(Response.json(response));
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
  });
}

describe('useLiveStepRuns', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: LiveStepRuns | undefined;

  function HookHarness(properties: {
    readonly runId: string | undefined;
    readonly fetchFunction: FetchFunction;
    readonly serverRestartCount: number;
  }): null {
    latest = useLiveStepRuns({
      runId: properties.runId,
      subscribeToFrames,
      fetchFunction: properties.fetchFunction,
      apiOrigin: API_ORIGIN,
      serverRestartCount: properties.serverRestartCount,
    });
    return null;
  }

  function renderWithoutFlush(
    runId: string | undefined,
    fetchFunction: FetchFunction,
    serverRestartCount: number,
  ): void {
    act(() => {
      root.render(<HookHarness runId={runId} fetchFunction={fetchFunction} serverRestartCount={serverRestartCount} />);
    });
  }

  async function render(
    runId: string | undefined,
    fetchFunction: FetchFunction,
    serverRestartCount = 0,
  ): Promise<void> {
    renderWithoutFlush(runId, fetchFunction, serverRestartCount);
    await flush();
  }

  beforeEach(() => {
    frameListeners.clear();
    latest = undefined;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('runId nélkül nem kér és nem iratkozik fel', async () => {
    const urls: string[] = [];
    await render(undefined, createStepRunsFetch([[]], urls));

    expect(urls).toEqual([]);
    expect(frameListeners.size).toBe(0);
    expect(latest).toEqual({ stepRuns: undefined, failureMessage: undefined });
  });

  it('csatoláskor betölti a futás lépés futásait', async () => {
    const urls: string[] = [];
    await render('r-1', createStepRunsFetch([[RUNNING_STEP_RUN]], urls));

    expect(urls).toEqual(['/api/runs/r-1/steps']);
    expect(latest?.stepRuns).toEqual([RUNNING_STEP_RUN]);
    expect(latest?.failureMessage).toBeUndefined();
  });

  it('élő step_finished keretre újratölt, és a csomópont állapota a friss sorból jön', async () => {
    const urls: string[] = [];
    await render('r-1', createStepRunsFetch([[RUNNING_STEP_RUN], [SUCCEEDED_STEP_RUN]], urls));

    act(() => {
      emitFrame(runEventFrame('step_finished', 'live', 2));
    });
    await flush();

    expect(urls).toHaveLength(2);
    expect(latest?.stepRuns).toEqual([SUCCEEDED_STEP_RUN]);
  });

  it('a lépés futás sort nem érintő keretre nem tölt újra', async () => {
    const urls: string[] = [];
    await render('r-1', createStepRunsFetch([[RUNNING_STEP_RUN]], urls));

    act(() => {
      emitFrame(runEventFrame('sdk_assistant', 'live', 2));
      emitFrame(runEventFrame('step_started', 'live', 3, 'r-masik'));
    });
    await flush();

    expect(urls).toHaveLength(1);
  });

  it('egy löketben érkező ezer keretes pótlás pontosan EGY újratöltést ad, a replay_complete keretre', async () => {
    const urls: string[] = [];
    await render('r-1', createStepRunsFetch([[RUNNING_STEP_RUN], [SUCCEEDED_STEP_RUN]], urls));

    // Egyetlen `act` blokk: a keretek egyetlen szinkron sorozatban érkeznek,
    // pontosan úgy, ahogy a szerver a pótlást kiírja.
    act(() => {
      for (let id = 1; id <= 1000; id += 1) {
        emitFrame(runEventFrame(id % 2 === 0 ? 'step_finished' : 'step_started', 'replayed', id));
      }
      emitFrame({ event: 'replay_complete', runId: 'r-1', throughEventId: 1000 });
    });
    await flush();

    expect(urls).toHaveLength(2);
    expect(latest?.stepRuns).toEqual([SUCCEEDED_STEP_RUN]);
  });

  it('egy löketben érkező ezer élő jelző keret legfeljebb egy futó és egy utólagos kérést ad', async () => {
    const urls: string[] = [];
    await render('r-1', createStepRunsFetch([[RUNNING_STEP_RUN], [RUNNING_STEP_RUN], [SUCCEEDED_STEP_RUN]], urls));

    act(() => {
      for (let id = 1; id <= 1000; id += 1) {
        emitFrame(runEventFrame('step_started', 'live', id));
      }
    });
    await flush();

    expect(urls).toHaveLength(3);
    expect(latest?.stepRuns).toEqual([SUCCEEDED_STEP_RUN]);
  });

  it('a betöltés hibáját jelzi, egy későbbi sikeres betöltés pedig törli', async () => {
    const urls: string[] = [];
    await render('r-1', createStepRunsFetch([new Error('kapcsolat megszakadt'), [SUCCEEDED_STEP_RUN]], urls));

    expect(latest?.failureMessage).toBe('A szerver nem érhető el.');
    expect(latest?.stepRuns).toBeUndefined();

    act(() => {
      emitFrame(runEventFrame('step_finished', 'live', 2));
    });
    await flush();

    expect(latest).toEqual({ stepRuns: [SUCCEEDED_STEP_RUN], failureMessage: undefined });
  });

  it('az újratöltés hibája mellett a korábbi sorok megmaradnak', async () => {
    const urls: string[] = [];
    await render('r-1', createStepRunsFetch([[RUNNING_STEP_RUN], new Error('kapcsolat megszakadt')], urls));

    act(() => {
      emitFrame(runEventFrame('step_finished', 'live', 2));
    });
    await flush();

    expect(latest).toEqual({ stepRuns: [RUNNING_STEP_RUN], failureMessage: 'A szerver nem érhető el.' });
  });

  it('másik futásra váltáskor a régi futás késve érkező válasza eldobódik', async () => {
    const resolvers: (() => void)[] = [];
    const urls: string[] = [];
    const deferredFetch: FetchFunction = (input) => {
      const { pathname } = new URL(input);
      urls.push(pathname);
      const rows = pathname.includes('/r-1/') ? [RUNNING_STEP_RUN] : [{ ...SUCCEEDED_STEP_RUN, runId: 'r-2' }];
      return new Promise<Response>((resolve) => {
        resolvers.push(() => {
          resolve(Response.json(rows));
        });
      });
    };

    await render('r-1', deferredFetch);
    await render('r-2', deferredFetch);
    expect(urls).toEqual(['/api/runs/r-1/steps', '/api/runs/r-2/steps']);

    // Előbb az ÚJ futás válasza érkezik, utána a régié: a régi nem írhatja
    // felül.
    resolvers[1]?.();
    await flush();
    resolvers[0]?.();
    await flush();

    expect(latest?.stepRuns).toEqual([{ ...SUCCEEDED_STEP_RUN, runId: 'r-2' }]);
  });

  it('másik futásra váltáskor a régi futás sorai azonnal eltűnnek, még az új betöltés előtt', async () => {
    const urls: string[] = [];
    const pendingFetch: FetchFunction = (input) => {
      urls.push(new URL(input).pathname);
      return new Promise<Response>(() => {
        // szándékosan sosem oldódik fel: a váltás utáni, betöltés előtti
        // állapot a megfigyelés tárgya
      });
    };
    await render('r-1', createStepRunsFetch([[RUNNING_STEP_RUN]], urls));
    expect(latest?.stepRuns).toEqual([RUNNING_STEP_RUN]);

    await render('r-2', pendingFetch);

    expect(urls).toEqual(['/api/runs/r-1/steps', '/api/runs/r-2/steps']);
    expect(latest).toEqual({ stepRuns: undefined, failureMessage: undefined });
  });

  it('a serverRestartCount változására újratölt, és a korábbi sorok addig a helyükön maradnak (SPEC-005 5.2)', async () => {
    const urls: string[] = [];
    const interruptedStepRun: StepRunRecord = { ...RUNNING_STEP_RUN, status: 'interrupted', finishedAtMs: 40 };
    const fetchFunction = createStepRunsFetch([[RUNNING_STEP_RUN], [interruptedStepRun]], urls);
    await render('r-1', fetchFunction, 0);
    expect(urls).toHaveLength(1);

    // A szerver újraindult: a helyreállítás a lépést lépés szintű esemény
    // nélkül vitte `interrupted` állapotba (SPEC-004 10.1), tehát keret nem
    // jelez, csak a számláló.
    renderWithoutFlush('r-1', fetchFunction, 1);
    expect(urls).toHaveLength(2);
    expect(latest?.stepRuns).toEqual([RUNNING_STEP_RUN]);

    await flush();
    expect(latest).toEqual({ stepRuns: [interruptedStepRun], failureMessage: undefined });
  });

  it('a serverRestartCount változása után is egyetlen feliratkozó marad, és a jelző keret tovább újratölt', async () => {
    const urls: string[] = [];
    const fetchFunction = createStepRunsFetch([[RUNNING_STEP_RUN], [RUNNING_STEP_RUN], [SUCCEEDED_STEP_RUN]], urls);
    await render('r-1', fetchFunction, 0);
    await render('r-1', fetchFunction, 1);
    expect(frameListeners.size).toBe(1);

    act(() => {
      emitFrame(runEventFrame('step_finished', 'live', 2));
    });
    await flush();

    expect(urls).toHaveLength(3);
    expect(latest?.stepRuns).toEqual([SUCCEEDED_STEP_RUN]);
  });

  it('leszereléskor leiratkozik a keretekről', async () => {
    await render('r-1', createStepRunsFetch([[RUNNING_STEP_RUN]], []));
    expect(frameListeners.size).toBe(1);

    act(() => {
      root.unmount();
    });
    expect(frameListeners.size).toBe(0);
    // Az `afterEach` újra leszerelné a gyökeret: egy friss, üres gyökér
    // kerül a helyére, hogy a második `unmount` ne dobjon.
    root = createRoot(container);
  });
});
