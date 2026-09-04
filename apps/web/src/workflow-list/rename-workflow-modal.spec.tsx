/* eslint-disable unicorn/no-null -- a WorkflowSummary nullázható mezői (description, providerId) és az `updateWorkflow` kérés törzse a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et (packages/protocol/src/workflow/workflow-record.ts). */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { WorkflowSummary } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RenameWorkflowModal } from './rename-workflow-modal.tsx';

const API_ORIGIN = 'https://api.example.test';

const WORKFLOW: WorkflowSummary = {
  id: 'workflow-1',
  name: 'Alfa',
  description: 'eredeti leírás',
  providerId: null,
  createdAtMs: 0,
  updatedAtMs: 0,
};

const WORKFLOW_WITHOUT_DESCRIPTION: WorkflowSummary = {
  id: 'workflow-2',
  name: 'Béta',
  description: null,
  providerId: null,
  createdAtMs: 0,
  updatedAtMs: 0,
};

function noop(): void {
  // a modális bezárás/callback prop-ját a teszt nem figyeli
}

const rejectingFetchFunction: FetchFunction = () => Promise.reject(new Error('nem hívható'));

const failingRenameFetchFunction: FetchFunction = () => Promise.reject(new Error('kapcsolat megszakadt'));

function submitForm(container: HTMLElement): void {
  const form = container.querySelector('form');
  if (form === null) {
    throw new Error('a teszt nem talált <form> elemet');
  }
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('RenameWorkflowModal', () => {
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
        <RenameWorkflowModal
          workflow={undefined}
          onClose={noop}
          onRenamed={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={rejectingFetchFunction}
        />,
      );
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('workflow megadásakor a mezőket a workflow értékeivel tölti fel', () => {
    act(() => {
      root.render(
        <RenameWorkflowModal
          workflow={WORKFLOW}
          onClose={noop}
          onRenamed={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={rejectingFetchFunction}
        />,
      );
    });
    const inputs = container.querySelectorAll('input');
    expect(inputs[0]?.value).toBe('Alfa');
    expect(inputs[1]?.value).toBe('eredeti leírás');
  });

  it('hiányzó leírású workflow megadásakor a leírás mezőt üresen tölti fel', () => {
    act(() => {
      root.render(
        <RenameWorkflowModal
          workflow={WORKFLOW_WITHOUT_DESCRIPTION}
          onClose={noop}
          onRenamed={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={rejectingFetchFunction}
        />,
      );
    });
    const inputs = container.querySelectorAll('input');
    expect(inputs[0]?.value).toBe('Béta');
    expect(inputs[1]?.value).toBe('');
  });

  it('sikeres mentésre meghívja az onRenamed és az onClose callbacket, a törzsben null leírással hiány esetén', async () => {
    let capturedBody: string | undefined;
    const fetchFunction: FetchFunction = (_input, init) => {
      capturedBody = typeof init.body === 'string' ? init.body : undefined;
      return Promise.resolve(Response.json({ ...WORKFLOW, description: null }));
    };

    let renamedWorkflow: WorkflowSummary | undefined;
    let closeCallCount = 0;

    act(() => {
      root.render(
        <RenameWorkflowModal
          workflow={WORKFLOW}
          onClose={() => {
            closeCallCount += 1;
          }}
          onRenamed={(workflow) => {
            renamedWorkflow = workflow;
          }}
          apiOrigin={API_ORIGIN}
          fetchFunction={fetchFunction}
        />,
      );
    });

    const inputs = container.querySelectorAll('input');
    const nameInput = inputs[0];
    const descriptionInput = inputs[1];
    if (nameInput === undefined || descriptionInput === undefined) {
      throw new Error('a teszt nem talált input mezőt');
    }
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    act(() => {
      descriptor?.set?.call(nameInput, 'Alfa módosítva');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      descriptor?.set?.call(descriptionInput, '');
      descriptionInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitForm(container);
      await Promise.resolve();
    });

    expect(renamedWorkflow?.description).toBeNull();
    expect(closeCallCount).toBe(1);
    expect(capturedBody).toBe(JSON.stringify({ name: 'Alfa módosítva', description: null }));
  });

  it('hiba esetén a hibaüzenetet jeleníti meg', async () => {
    act(() => {
      root.render(
        <RenameWorkflowModal
          workflow={WORKFLOW}
          onClose={noop}
          onRenamed={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={failingRenameFetchFunction}
        />,
      );
    });

    await act(async () => {
      submitForm(container);
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
  });
});
