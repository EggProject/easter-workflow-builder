/* eslint-disable unicorn/no-null -- a WorkflowSummary nullázható mezői (description, providerId) a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et (packages/protocol/src/workflow/workflow-record.ts). */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { WorkflowSummary } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeleteWorkflowModal } from './delete-workflow-modal.tsx';

const API_ORIGIN = 'https://api.example.test';

const WORKFLOW: WorkflowSummary = {
  id: 'workflow-1',
  name: 'Alfa',
  description: null,
  providerId: null,
  createdAtMs: 0,
  updatedAtMs: 0,
};

function noop(): void {
  // a modális bezárás/callback prop-ját a teszt nem figyeli
}

const rejectingFetchFunction: FetchFunction = () => Promise.reject(new Error('nem hívható'));

function emptySummaryFetchFunction(): Promise<Response> {
  return Promise.resolve(Response.json({ runCount: 0, eventCount: 0, snapshotCount: 0 }));
}

function findCheckbox(container: HTMLElement): HTMLInputElement {
  const checkbox = container.querySelector('input[type="checkbox"]');
  if (!(checkbox instanceof HTMLInputElement)) {
    throw new TypeError('a teszt nem talált jelölőnégyzetet');
  }
  return checkbox;
}

const summaryFetchFunction: FetchFunction = () =>
  Promise.resolve(Response.json({ runCount: 3, eventCount: 40, snapshotCount: 2 }));

function findConfirmButton(container: HTMLElement): HTMLButtonElement {
  const buttons = [...container.querySelectorAll('button')];
  const confirmButton = buttons.find((button) => button.textContent === 'Törlés');
  if (confirmButton === undefined) {
    throw new Error('a teszt nem talált Törlés gombot');
  }
  return confirmButton;
}

describe('DeleteWorkflowModal', () => {
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

  it('workflow nélkül nem rajzol dialógust', () => {
    act(() => {
      root.render(
        <DeleteWorkflowModal
          workflow={undefined}
          onClose={noop}
          onDeleted={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={rejectingFetchFunction}
        />,
      );
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('nyitáskor betölti az összefoglalót, és megjeleníti a számokat', async () => {
    await act(async () => {
      root.render(
        <DeleteWorkflowModal
          workflow={WORKFLOW}
          onClose={noop}
          onDeleted={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={summaryFetchFunction}
        />,
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain('3 futást');
    expect(container.textContent).toContain('40 eseményt');
    expect(container.textContent).toContain('2 gráf pillanatképet');
  });

  it('a Törlés gomb a jelölőnégyzet bepipálásáig le van tiltva, utána engedélyezett', async () => {
    await act(async () => {
      root.render(
        <DeleteWorkflowModal
          workflow={WORKFLOW}
          onClose={noop}
          onDeleted={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={emptySummaryFetchFunction}
        />,
      );
      await Promise.resolve();
    });

    expect(findConfirmButton(container).disabled).toBe(true);

    const checkbox = findCheckbox(container);
    act(() => {
      checkbox.click();
    });

    expect(findConfirmButton(container).disabled).toBe(false);
  });

  it('sikeres törlésre meghívja az onDeleted és az onClose callbacket, a kötelező literállal', async () => {
    let capturedBody: string | undefined;
    const fetchFunction: FetchFunction = (_input, init) => {
      if (init.method === 'DELETE') {
        capturedBody = typeof init.body === 'string' ? init.body : undefined;
      }
      return Promise.resolve(Response.json({ runCount: 1, eventCount: 2, snapshotCount: 1 }));
    };

    let deletedWorkflowId: string | undefined;
    let closeCallCount = 0;

    await act(async () => {
      root.render(
        <DeleteWorkflowModal
          workflow={WORKFLOW}
          onClose={() => {
            closeCallCount += 1;
          }}
          onDeleted={(workflowId) => {
            deletedWorkflowId = workflowId;
          }}
          apiOrigin={API_ORIGIN}
          fetchFunction={fetchFunction}
        />,
      );
      await Promise.resolve();
    });

    act(() => {
      findCheckbox(container).click();
    });

    await act(async () => {
      findConfirmButton(container).click();
      await Promise.resolve();
    });

    expect(deletedWorkflowId).toBe('workflow-1');
    expect(closeCallCount).toBe(1);
    expect(capturedBody).toBe(JSON.stringify({ acknowledgeIrreversible: true }));
  });

  it('az összefoglaló betöltési hibáját megjeleníti', async () => {
    await act(async () => {
      root.render(
        <DeleteWorkflowModal
          workflow={WORKFLOW}
          onClose={noop}
          onDeleted={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={rejectingFetchFunction}
        />,
      );
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
  });

  it('a törlés küldési hibáját megjeleníti', async () => {
    let callCount = 0;
    const fetchFunction: FetchFunction = () => {
      callCount += 1;
      if (callCount === 1) {
        return emptySummaryFetchFunction();
      }
      return Promise.reject(new Error('kapcsolat megszakadt'));
    };

    await act(async () => {
      root.render(
        <DeleteWorkflowModal
          workflow={WORKFLOW}
          onClose={noop}
          onDeleted={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={fetchFunction}
        />,
      );
      await Promise.resolve();
    });

    act(() => {
      findCheckbox(container).click();
    });

    await act(async () => {
      findConfirmButton(container).click();
      await Promise.resolve();
    });

    const alerts = [...container.querySelectorAll('[role="alert"]')];
    expect(alerts.at(-1)?.textContent).toBe('A szerver nem érhető el.');
  });
});
