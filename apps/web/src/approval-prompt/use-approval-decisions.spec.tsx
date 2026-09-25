/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApprovalDecisions, type ApprovalDecisions } from './use-approval-decisions.ts';

const API_ORIGIN = 'https://api.example.test';

const APPROVAL: PendingApproval = {
  id: 'a-1',
  runId: 'r-1',
  stepRunId: 's-1',
  title: 'Engedélyezed?',
  body: 'Kérlek erősítsd meg',
  payload: {},
  decision: null,
  requestedAtMs: 1000,
  decidedAtMs: null,
};

/**
 * Kézzel feloldható döntés válasz: a teszt a `resolve` hívásáig a `sending`
 * állapotot figyelheti. A `requests` a kérések útvonala és törzse.
 */
function createDeferredFetchFunction(): {
  readonly fetchFunction: FetchFunction;
  readonly resolve: (response: Response) => void;
  readonly requests: { readonly path: string; readonly body: unknown }[];
} {
  const requests: { readonly path: string; readonly body: unknown }[] = [];
  const { promise, resolve } = Promise.withResolvers<Response>();
  const fetchFunction: FetchFunction = (input, init) => {
    requests.push({ path: new URL(input).pathname, body: typeof init.body === 'string' ? JSON.parse(init.body) : {} });
    return promise;
  };
  return { fetchFunction, resolve, requests };
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
  });
}

describe('useApprovalDecisions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ApprovalDecisions | undefined;
  const onDecided = vi.fn();

  function HookHarness(properties: {
    readonly runId: string;
    readonly approvals: readonly PendingApproval[];
    readonly fetchFunction: FetchFunction;
  }): null {
    latest = useApprovalDecisions({
      runId: properties.runId,
      approvals: properties.approvals,
      fetchFunction: properties.fetchFunction,
      apiOrigin: API_ORIGIN,
      onDecided,
    });
    return null;
  }

  function render(runId: string, approvals: readonly PendingApproval[], fetchFunction: FetchFunction): void {
    act(() => {
      root.render(<HookHarness runId={runId} approvals={approvals} fetchFunction={fetchFunction} />);
    });
  }

  function decide(decision: 'approved' | 'rejected'): void {
    act(() => {
      latest?.decide(APPROVAL, decision);
    });
  }

  beforeEach(() => {
    onDecided.mockClear();
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

  it('döntés nélkül a lista jelenik meg, döntés állapot nélkül', () => {
    render('r-1', [APPROVAL], createDeferredFetchFunction().fetchFunction);

    expect(latest?.displayed).toEqual([{ approval: APPROVAL, progress: undefined }]);
  });

  it('a döntés POST kérést küld, a válaszig sending, a siker után decided, és a lista frissítését kéri', async () => {
    const deferred = createDeferredFetchFunction();
    render('r-1', [APPROVAL], deferred.fetchFunction);

    decide('approved');
    expect(deferred.requests).toEqual([{ path: '/api/approvals/a-1/decision', body: { decision: 'approved' } }]);
    expect(latest?.displayed[0]?.progress).toEqual({ status: 'sending', decision: 'approved' });
    expect(onDecided).not.toHaveBeenCalled();

    deferred.resolve(Response.json({ ...APPROVAL, decision: 'approved', decidedAtMs: 2000 }));
    await flush();

    expect(latest?.displayed[0]?.progress).toEqual({ status: 'decided', decision: 'approved' });
    expect(onDecided).toHaveBeenCalledTimes(1);
  });

  it('a sikeres döntés kártyája az eredménnyel együtt megmarad, amikor a friss lista már nem tartalmazza, nyugtázás nélkül, a futás váltásáig', async () => {
    const deferred = createDeferredFetchFunction();
    render('r-1', [APPROVAL], deferred.fetchFunction);
    decide('rejected');
    deferred.resolve(Response.json({ ...APPROVAL, decision: 'rejected', decidedAtMs: 2000 }));
    await flush();

    render('r-1', [], deferred.fetchFunction);
    expect(latest?.displayed).toEqual([{ approval: APPROVAL, progress: { status: 'decided', decision: 'rejected' } }]);
    render('r-1', [], deferred.fetchFunction);
    expect(latest?.displayed).toEqual([{ approval: APPROVAL, progress: { status: 'decided', decision: 'rejected' } }]);

    render('r-2', [], deferred.fetchFunction);
    expect(latest?.displayed).toEqual([]);
  });

  it('ha az újratöltés elbukik és a lista a régi, a sikeres döntés kártyája akkor sem kapcsol vissza', async () => {
    const deferred = createDeferredFetchFunction();
    render('r-1', [APPROVAL], deferred.fetchFunction);
    decide('approved');
    deferred.resolve(Response.json({ ...APPROVAL, decision: 'approved', decidedAtMs: 2000 }));
    await flush();

    // A lista nem frissült (elbukott újratöltés): a jóváhagyás még benne van.
    render('r-1', [APPROVAL], deferred.fetchFunction);
    expect(latest?.displayed).toEqual([{ approval: APPROVAL, progress: { status: 'decided', decision: 'approved' } }]);
  });

  it('a conflict után a hibaüzenet a kártyán marad, amikor a friss lista már nem tartalmazza, és a hiba végleges', async () => {
    const deferred = createDeferredFetchFunction();
    render('r-1', [APPROVAL], deferred.fetchFunction);
    decide('approved');
    deferred.resolve(Response.json({ code: 'conflict', message: 'a jóváhagyás már el lett döntve' }, { status: 409 }));
    await flush();

    render('r-1', [], deferred.fetchFunction);
    expect(latest?.displayed).toEqual([
      {
        approval: APPROVAL,
        progress: {
          status: 'failed',
          message: 'Az elem állapota most nem engedi a műveletet.: a jóváhagyás már el lett döntve',
          isFinal: true,
        },
      },
    ]);
    expect(onDecided).toHaveBeenCalledTimes(1);
  });

  it('másik futásra váltáskor az állapot törlődik, és a régi futás késve érkező válasza nem íródik be', async () => {
    const deferred = createDeferredFetchFunction();
    render('r-1', [APPROVAL], deferred.fetchFunction);
    decide('approved');

    render('r-2', [], deferred.fetchFunction);
    expect(latest?.displayed).toEqual([]);

    deferred.resolve(Response.json({ ...APPROVAL, decision: 'approved', decidedAtMs: 2000 }));
    await flush();
    expect(latest?.displayed).toEqual([]);
  });
});
