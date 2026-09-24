/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalPromptCard } from './ApprovalPromptCard.tsx';

const API_ORIGIN = 'https://api.example.test';

const APPROVAL: PendingApproval = {
  id: 'a-1',
  runId: 'r-1',
  stepRunId: 's-1',
  title: 'Engedélyezed a fizetést?',
  body: 'Kérlek erősítsd meg a tranzakciót',
  payload: { amount: 100, currency: 'EUR' },
  decision: null,
  requestedAtMs: 1000,
  decidedAtMs: null,
};

/**
 * Egy kézzel feloldható válasz: a teszt a `resolve` hívásáig figyelheti a
 * `pending` fázist, majd eldöntheti, mikor érkezzen a válasz (`nincs
 * időzítő`, csak Promise ütemezés, `.claude/CLAUDE.md` 11. szekció
 * Playwright szabálya ugyanezt a szemléletet várja el unit szinten is).
 */
function createDeferredFetchFunction(): {
  readonly fetchFunction: FetchFunction;
  readonly resolve: (response: Response) => void;
  readonly urls: string[];
  readonly bodies: string[];
} {
  const urls: string[] = [];
  const bodies: string[] = [];
  const { promise, resolve } = Promise.withResolvers<Response>();
  const fetchFunction: FetchFunction = (input, init) => {
    urls.push(new URL(input).pathname);
    bodies.push(typeof init.body === 'string' ? init.body : '{}');
    return promise;
  };
  return { fetchFunction, resolve, urls, bodies };
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
  });
}

describe('ApprovalPromptCard', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onDecided = vi.fn();

  beforeEach(() => {
    onDecided.mockClear();
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

  function renderCard(fetchFunction: FetchFunction): void {
    act(() => {
      root.render(
        <ApprovalPromptCard
          approval={APPROVAL}
          apiOrigin={API_ORIGIN}
          fetchFunction={fetchFunction}
          onDecided={onDecided}
        />,
      );
    });
  }

  function buttons(): { readonly approve: HTMLButtonElement; readonly reject: HTMLButtonElement } {
    const [approve, reject] = [...container.querySelectorAll<HTMLButtonElement>('button.btn')];
    if (approve === undefined || reject === undefined) {
      throw new Error('a teszt nem talált két döntés gombot');
    }
    return { approve, reject };
  }

  it('a title, a body és a formázott payload megjelenik', () => {
    renderCard(() => Promise.reject(new Error('nincs hívás ebben a tesztben')));

    expect(container.textContent).toContain('Engedélyezed a fizetést?');
    expect(container.textContent).toContain('Kérlek erősítsd meg a tranzakciót');
    const payload = container.querySelector('pre');
    expect(payload?.textContent).toBe(JSON.stringify({ amount: 100, currency: 'EUR' }, undefined, 2));
  });

  it('a Jóváhagyás gomb megnyomásától a válaszig mindkét gomb letiltva, csak a megnyomotton spinner', async () => {
    const deferred = createDeferredFetchFunction();
    renderCard(deferred.fetchFunction);

    act(() => {
      buttons().approve.click();
    });

    expect(buttons().approve.disabled).toBe(true);
    expect(buttons().reject.disabled).toBe(true);
    expect(buttons().approve.classList.contains('is-loading')).toBe(true);
    expect(buttons().reject.classList.contains('is-loading')).toBe(false);
    expect(deferred.bodies).toEqual([JSON.stringify({ decision: 'approved' })]);

    deferred.resolve(Response.json({ ...APPROVAL, decision: 'approved', decidedAtMs: 2000 }));
    await flush();

    expect(buttons().approve.disabled).toBe(false);
    expect(buttons().reject.disabled).toBe(false);
    expect(onDecided).toHaveBeenCalledTimes(1);
  });

  it('az Elutasítás gomb megnyomásától a válaszig mindkét gomb letiltva, csak a megnyomotton spinner', async () => {
    const deferred = createDeferredFetchFunction();
    renderCard(deferred.fetchFunction);

    act(() => {
      buttons().reject.click();
    });

    expect(buttons().approve.disabled).toBe(true);
    expect(buttons().reject.disabled).toBe(true);
    expect(buttons().reject.classList.contains('is-loading')).toBe(true);
    expect(buttons().approve.classList.contains('is-loading')).toBe(false);
    expect(deferred.bodies).toEqual([JSON.stringify({ decision: 'rejected' })]);

    deferred.resolve(Response.json({ ...APPROVAL, decision: 'rejected', decidedAtMs: 2000 }));
    await flush();

    expect(buttons().approve.disabled).toBe(false);
    expect(buttons().reject.disabled).toBe(false);
    expect(onDecided).toHaveBeenCalledTimes(1);
  });

  it('a conflict hibaágra magyar üzenetet mutat, és az onDecided ekkor is meghívódik', async () => {
    const deferred = createDeferredFetchFunction();
    renderCard(deferred.fetchFunction);

    act(() => {
      buttons().approve.click();
    });
    deferred.resolve(Response.json({ code: 'conflict', message: 'a jóváhagyás már el lett döntve' }, { status: 409 }));
    await flush();

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Az elem állapota most nem engedi a műveletet.: a jóváhagyás már el lett döntve',
    );
    expect(buttons().approve.disabled).toBe(false);
    expect(onDecided).toHaveBeenCalledTimes(1);
  });

  it('a not_found hibaágra magyar üzenetet mutat', async () => {
    const deferred = createDeferredFetchFunction();
    renderCard(deferred.fetchFunction);

    act(() => {
      buttons().approve.click();
    });
    deferred.resolve(Response.json({ code: 'not_found', message: 'nincs ilyen jóváhagyás' }, { status: 404 }));
    await flush();

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'A keresett elem nem létezik, esetleg időközben törölték.: nincs ilyen jóváhagyás',
    );
  });
});
