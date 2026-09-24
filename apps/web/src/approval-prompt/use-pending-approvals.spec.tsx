/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { PendingApproval, RunEventKind, StreamFrame } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SubscribeToStreamFrames } from '../stream-client/subscribe-to-stream-frames.ts';
import { usePendingApprovals, type UsePendingApprovals } from './use-pending-approvals.ts';

const API_ORIGIN = 'https://api.example.test';

const APPROVAL_R1: PendingApproval = {
  id: 'a-1',
  runId: 'r-1',
  stepRunId: 's-1',
  title: 'Engedélyezed?',
  body: 'Kérlek erősítsd meg',
  payload: { amount: 100 },
  decision: null,
  requestedAtMs: 1000,
  decidedAtMs: null,
};

const APPROVAL_R2: PendingApproval = { ...APPROVAL_R1, id: 'a-2', runId: 'r-2', stepRunId: 's-2' };

/**
 * A veszteségmentes keret feliratkozás teszt duplikátuma, ugyanaz a minta,
 * mint a `use-live-step-runs.spec.tsx`-ben.
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

function liveFrame(kind: RunEventKind, id: number, runId = 'r-1'): StreamFrame {
  return {
    event: 'run_event',
    delivery: 'live',
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
 * A `GET /api/approvals` válaszainak sora: a hívások sorban kapják a
 * `responses` elemeit, az utolsó ismétlődik (`use-live-step-runs.spec.tsx`
 * mintája). Egy `Error` elem hálózati hibát (átmeneti), egy szám elem üres
 * törzsű HTTP hibaválaszt ad.
 */
function createApprovalsFetch(
  responses: readonly (readonly PendingApproval[] | Error | number)[],
  urls: string[],
): FetchFunction {
  return (input) => {
    urls.push(new URL(input).pathname);
    const response = responses[Math.min(urls.length, responses.length) - 1];
    if (response instanceof Error) {
      return Promise.reject(response);
    }
    if (typeof response === 'number') {
      return Promise.resolve(new Response('', { status: response, headers: { 'Content-Type': 'text/plain' } }));
    }
    return Promise.resolve(Response.json(response));
  };
}

/**
 * Kézzel feloldható válaszok: minden hívás egy saját, függő ígéretet kap, a
 * teszt dönti el, mikor érkezzen a válasz. Ebből látszik, hány kérés áll
 * EGYSZERRE folyamatban.
 */
function createDeferredApprovalsFetch(): {
  readonly fetchFunction: FetchFunction;
  readonly resolveNext: (approvals: readonly PendingApproval[]) => void;
  readonly pendingCount: () => number;
  readonly callCount: () => number;
} {
  const resolvers: ((response: Response) => void)[] = [];
  let calls = 0;
  const fetchFunction: FetchFunction = () => {
    calls += 1;
    const { promise, resolve } = Promise.withResolvers<Response>();
    resolvers.push(resolve);
    return promise;
  };
  return {
    fetchFunction,
    resolveNext: (approvals) => {
      resolvers.shift()?.(Response.json(approvals));
    },
    pendingCount: () => resolvers.length,
    callCount: () => calls,
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
  });
}

describe('usePendingApprovals', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UsePendingApprovals | undefined;

  function HookHarness(properties: {
    readonly runId: string | undefined;
    readonly fetchFunction: FetchFunction;
  }): null {
    latest = usePendingApprovals({
      runId: properties.runId,
      subscribeToFrames,
      fetchFunction: properties.fetchFunction,
      apiOrigin: API_ORIGIN,
    });
    return null;
  }

  function renderWithoutFlush(runId: string | undefined, fetchFunction: FetchFunction): void {
    act(() => {
      root.render(<HookHarness runId={runId} fetchFunction={fetchFunction} />);
    });
  }

  async function render(runId: string | undefined, fetchFunction: FetchFunction): Promise<void> {
    renderWithoutFlush(runId, fetchFunction);
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

  it('runId nélkül nem kér, nem iratkozik fel, és a reload sem kér', async () => {
    const urls: string[] = [];
    await render(undefined, createApprovalsFetch([[]], urls));

    act(() => {
      latest?.reload();
    });
    await flush();

    expect(urls).toEqual([]);
    expect(frameListeners.size).toBe(0);
    expect(latest?.approvals).toBeUndefined();
    expect(latest?.failureMessage).toBeUndefined();
  });

  it('csatoláskor betölti a listát, a SAJÁT runId értékére szűrve', async () => {
    const urls: string[] = [];
    await render('r-1', createApprovalsFetch([[APPROVAL_R1, APPROVAL_R2]], urls));

    expect(urls).toEqual(['/api/approvals']);
    expect(latest?.approvals).toEqual([APPROVAL_R1]);
    expect(latest?.failureMessage).toBeUndefined();
  });

  it('élő approval_requested keretre újratölt, oldal újratöltés nélkül megjelenik az új jóváhagyás', async () => {
    const urls: string[] = [];
    await render('r-1', createApprovalsFetch([[], [APPROVAL_R1]], urls));
    expect(latest?.approvals).toEqual([]);

    act(() => {
      emitFrame(liveFrame('approval_requested', 2));
    });
    await flush();

    expect(urls).toHaveLength(2);
    expect(latest?.approvals).toEqual([APPROVAL_R1]);
  });

  it('élő approval_decided keretre újratölt, és a lezárt jóváhagyás kikerül', async () => {
    const urls: string[] = [];
    await render('r-1', createApprovalsFetch([[APPROVAL_R1], []], urls));

    act(() => {
      emitFrame(liveFrame('approval_decided', 2));
    });
    await flush();

    expect(urls).toHaveLength(2);
    expect(latest?.approvals).toEqual([]);
  });

  it('a jóváhagyásokat nem érintő, vagy másik futás keretére nem tölt újra', async () => {
    const urls: string[] = [];
    await render('r-1', createApprovalsFetch([[APPROVAL_R1]], urls));

    act(() => {
      emitFrame(liveFrame('sdk_assistant', 2));
      emitFrame(liveFrame('approval_requested', 3, 'r-masik'));
    });
    await flush();

    expect(urls).toHaveLength(1);
  });

  it('egy löketben érkező ezer jelző keret és a reload hívás egyszerre legfeljebb EGY kérést tart folyamatban, és egyetlen utólagos kérést ad', async () => {
    const deferred = createDeferredApprovalsFetch();
    await render('r-1', deferred.fetchFunction);
    expect(deferred.callCount()).toBe(1);

    // A csatoláskori kérés még folyamatban: a löket és a döntés utáni reload
    // egyetlen utólagos kéréssé olvad össze.
    act(() => {
      for (let id = 1; id <= 1000; id += 1) {
        emitFrame(liveFrame(id % 2 === 0 ? 'step_finished' : 'approval_decided', id));
      }
      latest?.reload();
    });
    await flush();
    expect(deferred.callCount()).toBe(1);
    expect(deferred.pendingCount()).toBe(1);

    deferred.resolveNext([APPROVAL_R1]);
    await flush();
    expect(deferred.callCount()).toBe(2);
    expect(deferred.pendingCount()).toBe(1);
    expect(latest?.approvals).toEqual([APPROVAL_R1]);

    deferred.resolveNext([]);
    await flush();
    expect(deferred.callCount()).toBe(2);
    expect(deferred.pendingCount()).toBe(0);
    expect(latest?.approvals).toEqual([]);
  });

  it('nem átmeneti hibára üzenetet ad, a korábbi lista pedig a helyén marad; egy későbbi sikeres betöltés törli a hibát', async () => {
    const urls: string[] = [];
    await render('r-1', createApprovalsFetch([[APPROVAL_R1], 500, []], urls));
    expect(latest?.approvals).toEqual([APPROVAL_R1]);

    act(() => {
      latest?.reload();
    });
    await flush();

    expect(urls).toEqual(['/api/approvals', '/api/approvals']);
    expect(latest?.approvals).toEqual([APPROVAL_R1]);
    expect(latest?.failureMessage).toContain('HTTP 500');

    act(() => {
      emitFrame(liveFrame('step_finished', 2));
    });
    await flush();

    expect(latest).toMatchObject({ approvals: [], failureMessage: undefined });
  });

  it('átmeneti hiba korábbi sikeres lista mellett nem ad üzenetet, a lista a helyén marad (a szerver leállása)', async () => {
    const urls: string[] = [];
    await render('r-1', createApprovalsFetch([[APPROVAL_R1], new Error('kapcsolat megszakadt'), 502], urls));

    act(() => {
      emitFrame(liveFrame('run_interrupted', 2));
    });
    await flush();
    act(() => {
      latest?.reload();
    });
    await flush();

    expect(urls).toHaveLength(3);
    expect(latest).toMatchObject({ approvals: [APPROVAL_R1], failureMessage: undefined });
  });

  it('átmeneti hiba az első betöltésen üzenetet ad, mert nincs korábbi lista, ami helyette látszhatna', async () => {
    await render('r-1', createApprovalsFetch([new Error('kapcsolat megszakadt')], []));

    expect(latest).toMatchObject({ approvals: undefined, failureMessage: 'A szerver nem érhető el.' });
  });

  it('másik futásra váltáskor a régi futás listája azonnal eltűnik, és a késve érkező régi válasz eldobódik', async () => {
    const deferred = createDeferredApprovalsFetch();
    await render('r-1', deferred.fetchFunction);
    await render('r-2', deferred.fetchFunction);
    expect(deferred.callCount()).toBe(2);
    expect(latest?.approvals).toBeUndefined();

    // Az első (r-1) kérés válasza a váltás UTÁN érkezik: nem írhatja az r-2
    // nézetébe.
    deferred.resolveNext([APPROVAL_R1]);
    await flush();
    expect(latest?.approvals).toBeUndefined();

    deferred.resolveNext([APPROVAL_R2]);
    await flush();
    expect(latest?.approvals).toEqual([APPROVAL_R2]);
  });

  it('leszereléskor leiratkozik a keretekről, és a reload utána már nem kér', async () => {
    const urls: string[] = [];
    await render('r-1', createApprovalsFetch([[APPROVAL_R1]], urls));
    expect(frameListeners.size).toBe(1);
    const reloadAfterUnmount = latest?.reload;

    act(() => {
      root.unmount();
    });
    reloadAfterUnmount?.();
    await flush();

    expect(frameListeners.size).toBe(0);
    expect(urls).toHaveLength(1);
    // Az `afterEach` újra leszerelné a gyökeret: egy friss, üres gyökér
    // kerül a helyére, hogy a második `unmount` ne dobjon.
    root = createRoot(container);
  });
});
