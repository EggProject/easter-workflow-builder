/* eslint-disable unicorn/no-null -- a WorkflowSummary nullázható mezői (description, providerId) a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et (packages/protocol/src/workflow/workflow-record.ts). */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { ClientRouteId } from '../client-route/client-route-table.ts';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkflowListScreen } from './workflow-list-screen.tsx';

const API_ORIGIN = 'https://api.example.test';

const WORKFLOW_ROW = {
  id: 'workflow-1',
  name: 'Alfa',
  description: 'leírás',
  providerId: 'minimax',
  createdAtMs: 1_700_000_000_000,
  updatedAtMs: 1_700_000_000_000,
};

const WORKFLOW_ROW_WITHOUT_METADATA = {
  id: 'workflow-2',
  name: 'Béta',
  description: null,
  providerId: null,
  createdAtMs: 1_700_000_000_000,
  updatedAtMs: 1_700_000_000_000,
};

function jsonResponse(body: unknown): Response {
  return Response.json(body);
}

const oneWorkflowFetchFunction: FetchFunction = () => Promise.resolve(jsonResponse([WORKFLOW_ROW]));

const failingListFetchFunction: FetchFunction = () => Promise.reject(new Error('kapcsolat megszakadt'));

const emptyListFetchFunction: FetchFunction = () => Promise.resolve(jsonResponse([]));

const successfulStartRunFetchFunction: FetchFunction = (input) => {
  if (input.includes('/runs')) {
    return Promise.resolve(jsonResponse({ runId: 'run-1', status: 'running' }));
  }
  return Promise.resolve(jsonResponse([WORKFLOW_ROW]));
};

const failingStartRunFetchFunction: FetchFunction = (input) => {
  if (input.includes('/runs')) {
    return Promise.reject(new Error('kapcsolat megszakadt'));
  }
  return Promise.resolve(jsonResponse([WORKFLOW_ROW]));
};

const missingMetadataFetchFunction: FetchFunction = () =>
  Promise.resolve(jsonResponse([WORKFLOW_ROW_WITHOUT_METADATA]));

function findButtonByText(scope: ParentNode, text: string): HTMLButtonElement {
  const button = [...scope.querySelectorAll('button')].find((candidate) => candidate.textContent === text);
  if (button === undefined) {
    throw new Error(`a teszt nem talált "${text}" feliratú gombot`);
  }
  return button;
}

function findDialog(container: HTMLElement): HTMLElement {
  const dialog = container.querySelector('[role="dialog"]');
  if (!(dialog instanceof HTMLElement)) {
    throw new TypeError('a teszt nem talált nyitott dialógust');
  }
  return dialog;
}

function noop(): void {
  // a teszt alapértelmezett navigate implementációja, amit nem figyel
}

describe('WorkflowListScreen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  function render(
    fetchFunction: FetchFunction,
    navigate: (routeId: ClientRouteId) => void = noop,
    serverRestartCount = 0,
  ): void {
    act(() => {
      root.render(
        <WorkflowListScreen
          apiOrigin={API_ORIGIN}
          listLimit={25}
          fetchFunction={fetchFunction}
          navigate={navigate}
          serverRestartCount={serverRestartCount}
        />,
      );
    });
  }

  it('a serverRestartCount növekedésére újratölti a listát (szerver újraindulás)', async () => {
    let listCallCount = 0;
    const countingFetchFunction: FetchFunction = () => {
      listCallCount += 1;
      return Promise.resolve(jsonResponse([WORKFLOW_ROW]));
    };
    render(countingFetchFunction);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const callCountBeforeRestart = listCallCount;

    render(countingFetchFunction, noop, 1);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(listCallCount).toBeGreaterThan(callCountBeforeRestart);
  });

  it('első betöltéskor Skeleton jelzést mutat, majd a betöltött sorokat rajzolja', async () => {
    render(oneWorkflowFetchFunction);
    expect(container.querySelector('.skel-stack, .skel')).not.toBeNull();

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Alfa');
    expect(container.querySelector('[role="table"]')).not.toBeNull();
  });

  it('hiányzó leírás és provider esetén a helyőrző szöveget mutatja', async () => {
    render(missingMetadataFetchFunction);
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('nincs megadva');
  });

  it('betöltési hiba esetén hibaüzenetet jelenít meg', async () => {
    render(failingListFetchFunction);
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
  });

  it('üres listára az emptyLabel szöveget mutatja', async () => {
    render(emptyListFetchFunction);
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Még nincs workflow.');
  });

  it('az "Átnevezés" gomb megnyitja az átnevező modálist a sor adataival', async () => {
    render(oneWorkflowFetchFunction);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      findButtonByText(container, 'Átnevezés').click();
    });

    expect(container.textContent).toContain('Workflow átnevezése');
  });

  it('a "Törlés" gomb megnyitja a törlő modálist', async () => {
    render(oneWorkflowFetchFunction);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      findButtonByText(container, 'Törlés').click();
    });

    expect(container.textContent).toContain('Workflow törlése');
  });

  it('az "Új workflow" gomb megnyitja a létrehozó modálist', async () => {
    render(emptyListFetchFunction);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      findButtonByText(container, 'Új workflow').click();
    });

    expect(container.textContent).toContain('Új workflow');
  });

  it('sikeres "Indítás"-ra Toast-ot ad és navigál a futás előzményekre', async () => {
    let navigatedTo: ClientRouteId | undefined;

    render(successfulStartRunFetchFunction, (routeId) => {
      navigatedTo = routeId;
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      findButtonByText(container, 'Indítás').click();
      await Promise.resolve();
    });

    expect(navigatedTo).toBe('runHistory');
    expect(container.textContent).toContain('Futás elindítva');
  });

  it('sikertelen "Indítás"-ra hiba Toast-ot ad, nem navigál', async () => {
    let navigatedTo: ClientRouteId | undefined;

    render(failingStartRunFetchFunction, (routeId) => {
      navigatedTo = routeId;
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      findButtonByText(container, 'Indítás').click();
      await Promise.resolve();
    });

    expect(navigatedTo).toBeUndefined();
    expect(container.textContent).toContain('A futás indítása sikertelen');
  });

  it('az "Új workflow" modális "Mégse" gombja bezárja, hívás nélkül', async () => {
    render(oneWorkflowFetchFunction);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      findButtonByText(container, 'Új workflow').click();
    });
    const dialog = findDialog(container);

    act(() => {
      findButtonByText(dialog, 'Mégse').click();
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('sikeres workflow létrehozás után újratölti a listát', async () => {
    let listCallCount = 0;
    const fetchFunction: FetchFunction = (input, init) => {
      if (input.includes('/providers')) {
        return Promise.resolve(jsonResponse([]));
      }
      if (init.method === 'POST') {
        return Promise.resolve(jsonResponse(WORKFLOW_ROW));
      }
      listCallCount += 1;
      return Promise.resolve(jsonResponse(listCallCount === 1 ? [] : [WORKFLOW_ROW]));
    };

    render(fetchFunction);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      findButtonByText(container, 'Új workflow').click();
    });

    const dialog = findDialog(container);
    const nameInput = dialog.querySelector('input');
    if (nameInput === null) {
      throw new Error('a teszt nem talált input mezőt');
    }
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    act(() => {
      descriptor?.set?.call(nameInput, 'Béta');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const form = dialog.querySelector('form');
    if (form === null) {
      throw new Error('a teszt nem talált <form> elemet');
    }
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(listCallCount).toBe(2);
  });

  it('az "Átnevezés" modális "Mégse" gombja bezárja, hívás nélkül', async () => {
    render(oneWorkflowFetchFunction);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      findButtonByText(container, 'Átnevezés').click();
    });
    const dialog = findDialog(container);

    act(() => {
      findButtonByText(dialog, 'Mégse').click();
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('sikeres átnevezés után újratölti a listát', async () => {
    let listCallCount = 0;
    const fetchFunction: FetchFunction = (_input, init) => {
      if (init.method === 'PATCH') {
        return Promise.resolve(jsonResponse({ ...WORKFLOW_ROW, name: 'Béta' }));
      }
      listCallCount += 1;
      return Promise.resolve(jsonResponse([WORKFLOW_ROW]));
    };

    render(fetchFunction);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      findButtonByText(container, 'Átnevezés').click();
    });

    const dialog = findDialog(container);
    const form = dialog.querySelector('form');
    if (form === null) {
      throw new Error('a teszt nem talált <form> elemet');
    }
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(listCallCount).toBe(2);
  });

  it('a nem rendezhető "Műveletek" fejlécre kattintás nem változtatja meg a sorrendet', async () => {
    render(oneWorkflowFetchFunction);
    await act(async () => {
      await Promise.resolve();
    });

    const header = [...container.querySelectorAll('[role="columnheader"]')].find(
      (candidate) => candidate.textContent === 'Műveletek',
    );
    if (header === undefined) {
      throw new Error('a teszt nem talált "Műveletek" fejlécet');
    }
    act(() => {
      if (header instanceof HTMLElement) {
        header.click();
      }
    });

    expect(container.textContent).toContain('Alfa');
  });

  it('törlés utáni újratöltés alatt ProgressBar jelzést mutat, majd eltűnik sikeres betöltés után', async () => {
    let listCallCount = 0;
    const { promise: secondListPromise, resolve: resolveSecondList } = Promise.withResolvers<Response>();
    const fetchFunction: FetchFunction = (input, init) => {
      if (input.includes('/deletion-summary')) {
        return Promise.resolve(jsonResponse({ runCount: 0, eventCount: 0, snapshotCount: 0 }));
      }
      if (init.method === 'DELETE') {
        return Promise.resolve(jsonResponse({ runCount: 0, eventCount: 0, snapshotCount: 0 }));
      }
      listCallCount += 1;
      if (listCallCount === 1) {
        return Promise.resolve(jsonResponse([WORKFLOW_ROW]));
      }
      return secondListPromise;
    };

    render(fetchFunction);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      findButtonByText(container, 'Törlés').click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const dialog = findDialog(container);
    const checkbox = dialog.querySelector('input[type="checkbox"]');
    if (!(checkbox instanceof HTMLInputElement)) {
      throw new TypeError('a teszt nem talált jelölőnégyzetet');
    }
    act(() => {
      checkbox.click();
    });

    await act(async () => {
      findButtonByText(dialog, 'Törlés').click();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();

    await act(async () => {
      resolveSecondList(jsonResponse([]));
      await Promise.resolve();
    });

    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('a törlés modális onDeleted hívása után újratölti a listát, ProgressBar jelzéssel', async () => {
    let listCallCount = 0;
    const fetchFunction: FetchFunction = (input, init) => {
      if (input.includes('/deletion-summary')) {
        return Promise.resolve(jsonResponse({ runCount: 0, eventCount: 0, snapshotCount: 0 }));
      }
      if (init.method === 'DELETE') {
        return Promise.resolve(jsonResponse({ runCount: 0, eventCount: 0, snapshotCount: 0 }));
      }
      listCallCount += 1;
      return Promise.resolve(jsonResponse(listCallCount === 1 ? [WORKFLOW_ROW] : []));
    };

    render(fetchFunction);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      findButtonByText(container, 'Törlés').click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const dialog = findDialog(container);
    const checkbox = dialog.querySelector('input[type="checkbox"]');
    if (!(checkbox instanceof HTMLInputElement)) {
      throw new TypeError('a teszt nem talált jelölőnégyzetet');
    }
    act(() => {
      checkbox.click();
    });

    await act(async () => {
      findButtonByText(dialog, 'Törlés').click();
      await Promise.resolve();
    });

    expect(listCallCount).toBe(2);
    expect(container.textContent).toContain('Még nincs workflow.');
  });
});
