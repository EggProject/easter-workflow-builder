/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
 * A `GET /api/approvals` válaszainak sora: a hívások sorban kapják a
 * `responses` elemeit, az utolsó ismétlődik (`use-live-step-runs.spec.tsx`
 * mintája).
 */
function createApprovalsFetch(
  responses: readonly (readonly PendingApproval[] | Error)[],
  urls: string[],
): FetchFunction {
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

  it('runId nélkül nem kér', async () => {
    const urls: string[] = [];
    await render(undefined, createApprovalsFetch([[]], urls));

    expect(urls).toEqual([]);
    expect(latest?.approvals).toEqual([]);
    expect(latest?.isLoading).toBe(false);
    expect(latest?.failureMessage).toBeUndefined();
    expect(typeof latest?.reload).toBe('function');
  });

  it('csatoláskor betölti a listát, a SAJÁT runId értékére szűrve', async () => {
    const urls: string[] = [];
    await render('r-1', createApprovalsFetch([[APPROVAL_R1, APPROVAL_R2]], urls));

    expect(urls).toEqual(['/api/approvals']);
    expect(latest?.approvals).toEqual([APPROVAL_R1]);
    expect(latest?.isLoading).toBe(false);
    expect(latest?.failureMessage).toBeUndefined();
  });

  it('hibás betöltésre üzenetet ad, a korábbi lista pedig a helyén marad', async () => {
    const urls: string[] = [];
    await render('r-1', createApprovalsFetch([[APPROVAL_R1], new Error('kapcsolat megszakadt')], urls));
    expect(latest?.approvals).toEqual([APPROVAL_R1]);

    act(() => {
      latest?.reload();
    });
    await flush();

    expect(urls).toEqual(['/api/approvals', '/api/approvals']);
    expect(latest?.approvals).toEqual([APPROVAL_R1]);
    expect(latest?.failureMessage).toBe('A szerver nem érhető el.');
  });

  it('a reload új betöltést indít, ami felülírja a korábbi listát', async () => {
    const urls: string[] = [];
    await render('r-1', createApprovalsFetch([[APPROVAL_R1], []], urls));
    expect(latest?.approvals).toEqual([APPROVAL_R1]);

    act(() => {
      latest?.reload();
    });
    await flush();

    expect(urls).toEqual(['/api/approvals', '/api/approvals']);
    expect(latest?.approvals).toEqual([]);
  });

  it('másik futásra váltáskor a régi futás listája azonnal eltűnik, még az új betöltés előtt', async () => {
    const urls: string[] = [];
    const pendingFetch: FetchFunction = (input) => {
      urls.push(new URL(input).pathname);
      return new Promise<Response>(() => {
        // szándékosan sosem oldódik fel: a váltás utáni, betöltés előtti
        // állapot a megfigyelés tárgya (`use-live-step-runs.spec.tsx` mintája)
      });
    };
    await render('r-1', createApprovalsFetch([[APPROVAL_R1]], urls));
    expect(latest?.approvals).toEqual([APPROVAL_R1]);

    await render('r-2', pendingFetch);

    expect(urls).toEqual(['/api/approvals', '/api/approvals']);
    expect(latest?.approvals).toEqual([]);
  });
});
