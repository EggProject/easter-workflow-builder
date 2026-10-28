/* eslint-disable unicorn/no-null -- a WorkflowSummary nullázható mezői (description, providerId) és az `updateWorkflow` kérés törzse a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et (packages/protocol/src/workflow/workflow-record.ts). */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { WorkflowSummary } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditWorkflowModal } from './edit-workflow-modal.tsx';

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

const WORKFLOW_WITH_PROVIDER: WorkflowSummary = { ...WORKFLOW, providerId: 'minimax' };

/**
 * Két provider: az egyik kötelező env változó NEVET hordoz, a másik egyet
 * sem (a séma értéket nem is tud vinni).
 */
const PROVIDERS = [
  { id: 'claude-subscription', displayName: 'Claude előfizetés', models: [], requiredEnvNames: [] },
  {
    id: 'minimax',
    displayName: 'MiniMax',
    models: [],
    requiredEnvNames: [['ANTHROPIC_BASE_URL'], ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY']],
  },
];

function noop(): void {
  // a modális bezárás/callback prop-ját a teszt nem figyeli
}

interface RecordedRequests {
  readonly patchBodies: unknown[];
  readonly connectionTests: string[];
}

/**
 * Szerver mock: a provider lista, a `PATCH` (a megadott válasszal) és a
 * kapcsolat teszt; a kéréseket rögzíti.
 */
function createFetchFunction(patchResponse?: Response): { readonly fetchFunction: FetchFunction } & RecordedRequests {
  const recorded: RecordedRequests = { patchBodies: [], connectionTests: [] };
  const fetchFunction: FetchFunction = (input, init) => {
    if (input.includes('/connection-test')) {
      recorded.connectionTests.push(`${init.method ?? ''} ${new URL(input).pathname}`);
      return Promise.resolve(Response.json({ succeeded: true, errorMessage: null }));
    }
    if (init.method === 'PATCH') {
      recorded.patchBodies.push(typeof init.body === 'string' ? JSON.parse(init.body) : undefined);
      return Promise.resolve(patchResponse ?? Response.json({ ...WORKFLOW, name: 'Alfa módosítva' }));
    }
    return Promise.resolve(Response.json(PROVIDERS));
  };
  return { fetchFunction, ...recorded };
}

// Provider lista rendben, a `PATCH` hálózati hibával elbukik.
const failingPatchFetch: FetchFunction = (input, init) => {
  if (init.method === 'PATCH') {
    return Promise.reject(new Error('kapcsolat megszakadt'));
  }
  return Promise.resolve(Response.json(input.includes('/providers') ? PROVIDERS : []));
};

function submitForm(container: HTMLElement): void {
  const form = container.querySelector('form');
  if (form === null) {
    throw new Error('a teszt nem talált <form> elemet');
  }
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function typeInto(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  act(() => {
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/**
 * A `detail: 1` kötelező: a `SelectField` a `detail === 0` kattintást
 * billentyűzetből származónak tekinti, és szándékosan nem nyit rá.
 */
function clickOn(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
}

function findSaveButton(container: HTMLElement): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === 'Mentés');
}

function providerTrigger(container: HTMLElement): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button.select')].find(
    (candidate) => candidate.closest('.field')?.querySelector('.field__label')?.textContent === 'Provider',
  );
  if (button === undefined) {
    throw new Error('a teszt nem találta a Provider választót');
  }
  return button;
}

/**
 * A panel `createPortal`-lal a `document.body`-ba kerül; a nyitott panel
 * opcióit a body-ban keressük (egyszerre egy panel lehet nyitva).
 */
function chooseProvider(container: HTMLElement, optionLabel: string): void {
  const trigger = providerTrigger(container);
  clickOn(trigger);
  let option: Element | undefined;
  for (const candidate of document.body.querySelectorAll('[role="option"]')) {
    if (candidate.querySelector('.menu__text')?.textContent === optionLabel) {
      option = candidate;
    }
  }
  if (option === undefined) {
    throw new Error(`a teszt nem talált "${optionLabel}" feliratú opciót`);
  }
  clickOn(option);
}

describe('EditWorkflowModal', () => {
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

  async function render(
    workflow: WorkflowSummary | undefined,
    fetchFunction: FetchFunction,
    callbacks: { readonly onClose?: () => void; readonly onEdited?: (workflow: WorkflowSummary) => void } = {},
  ): Promise<void> {
    await act(async () => {
      root.render(
        <EditWorkflowModal
          workflow={workflow}
          onClose={callbacks.onClose ?? noop}
          onEdited={callbacks.onEdited ?? noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={fetchFunction}
        />,
      );
      await Promise.resolve();
    });
  }

  it('workflow nélkül nem rajzol dialógust, és providereket sem tölt', async () => {
    const requests: string[] = [];
    await render(undefined, (input) => {
      requests.push(input);
      return Promise.resolve(Response.json(PROVIDERS));
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(requests).toEqual([]);
  });

  it('workflow megadásakor "Workflow szerkesztése" címmel a mezőket a workflow értékeivel tölti fel', async () => {
    await render(WORKFLOW, createFetchFunction().fetchFunction);

    expect(container.textContent).toContain('Workflow szerkesztése');
    const inputs = container.querySelectorAll('input');
    expect(inputs[0]?.value).toBe('Alfa');
    expect(inputs[1]?.value).toBe('eredeti leírás');
  });

  it('hiányzó leírású workflow megadásakor a leírás mezőt üresen tölti fel', async () => {
    await render(WORKFLOW_WITHOUT_DESCRIPTION, createFetchFunction().fetchFunction);

    const inputs = container.querySelectorAll('input');
    expect(inputs[0]?.value).toBe('Béta');
    expect(inputs[1]?.value).toBe('');
  });

  it('nyitáskor betölti a providereket; a nem megadott provider "Nincs megadva", a Kapcsolat teszt tiltott és megindokolt', async () => {
    const { fetchFunction } = createFetchFunction();
    await render(WORKFLOW, fetchFunction);

    expect(providerTrigger(container).textContent).toBe('Nincs megadva');
    const testButton = [...container.querySelectorAll('button')].find((candidate) =>
      candidate.textContent.includes('Kapcsolat teszt'),
    );
    expect(testButton?.disabled).toBe(true);
    expect(container.textContent).toContain('A kapcsolat teszthez válassz ki egy providert.');
  });

  it('a workflow providere kiválasztva áll, a kötelező env változók NEVE látszik, és a Kapcsolat teszt azt a providert hívja', async () => {
    const { fetchFunction, connectionTests } = createFetchFunction();
    await render(WORKFLOW_WITH_PROVIDER, fetchFunction);

    expect(providerTrigger(container).textContent).toBe('MiniMax');
    expect(container.textContent).toContain('ANTHROPIC_BASE_URL');
    expect(container.textContent).toContain('ANTHROPIC_AUTH_TOKEN vagy ANTHROPIC_API_KEY');
    const testButton = [...container.querySelectorAll('button')].find((candidate) =>
      candidate.textContent.includes('Kapcsolat teszt'),
    );
    expect(testButton?.disabled).toBe(false);

    await act(async () => {
      testButton?.click();
      await Promise.resolve();
    });

    expect(connectionTests).toEqual(['POST /api/providers/minimax/connection-test']);
    expect(container.querySelector('.alert--success')?.textContent).toContain('A kapcsolat teszt sikeres.');
  });

  it('a provider lista betöltése alatt a választó betöltés feliratot mutat, a betöltés hibája danger Alert', async () => {
    const pending = Promise.withResolvers<Response>();
    await render(WORKFLOW, () => pending.promise);
    expect(providerTrigger(container).textContent).toBe('betöltés');

    await act(async () => {
      pending.reject(new Error('kapcsolat megszakadt'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('.alert--danger')?.textContent).toContain('A szerver nem érhető el.');
  });

  it('változatlan providerrel a törzs a providerId mezőt is hordozza (null az örökölt), sikerre meghívja az onEdited és az onClose callbacket', async () => {
    const { fetchFunction, patchBodies } = createFetchFunction();
    let editedWorkflow: WorkflowSummary | undefined;
    let closeCallCount = 0;
    await render(WORKFLOW, fetchFunction, {
      onClose: () => {
        closeCallCount += 1;
      },
      onEdited: (workflow) => {
        editedWorkflow = workflow;
      },
    });
    const inputs = container.querySelectorAll('input');
    const nameInput = inputs[0];
    const descriptionInput = inputs[1];
    if (nameInput === undefined || descriptionInput === undefined) {
      throw new Error('a teszt nem talált input mezőt');
    }
    typeInto(nameInput, 'Alfa módosítva');
    typeInto(descriptionInput, '');

    await act(async () => {
      submitForm(container);
      await Promise.resolve();
    });

    expect(patchBodies).toEqual([{ name: 'Alfa módosítva', description: null, providerId: null }]);
    expect(editedWorkflow?.name).toBe('Alfa módosítva');
    expect(closeCallCount).toBe(1);
  });

  it('provider választással a törzsbe a választott providerId kerül', async () => {
    const { fetchFunction, patchBodies } = createFetchFunction();
    await render(WORKFLOW, fetchFunction);

    chooseProvider(container, 'Claude előfizetés');
    await act(async () => {
      submitForm(container);
      await Promise.resolve();
    });

    expect(patchBodies).toEqual([{ name: 'Alfa', description: 'eredeti leírás', providerId: 'claude-subscription' }]);
  });

  it('az "Nincs megadva" (örökölt) választás a meglévő providert nullára állítja a törzsben', async () => {
    const { fetchFunction, patchBodies } = createFetchFunction();
    await render(WORKFLOW_WITH_PROVIDER, fetchFunction);

    chooseProvider(container, 'Nincs megadva');
    await act(async () => {
      submitForm(container);
      await Promise.resolve();
    });

    expect(patchBodies).toEqual([{ name: 'Alfa', description: 'eredeti leírás', providerId: null }]);
  });

  it('hiba esetén a hibaüzenetet jeleníti meg, a modális nyitva marad', async () => {
    await render(WORKFLOW, failingPatchFetch);

    await act(async () => {
      submitForm(container);
      await Promise.resolve();
    });

    expect(container.querySelector('.alert--danger[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('a mentés alatt a Mentés gomb tiltott és betöltést jelez (aria-busy), a felirata nem változik', async () => {
    const pendingPatch = Promise.withResolvers<Response>();
    await render(WORKFLOW, (_input, init) =>
      init.method === 'PATCH' ? pendingPatch.promise : Promise.resolve(Response.json(PROVIDERS)),
    );
    expect(findSaveButton(container)?.getAttribute('aria-busy')).toBeNull();

    await act(async () => {
      submitForm(container);
      await Promise.resolve();
    });

    expect(findSaveButton(container)?.disabled).toBe(true);
    expect(findSaveButton(container)?.getAttribute('aria-busy')).toBe('true');
    expect(findSaveButton(container)?.classList.contains('is-loading')).toBe(true);

    await act(async () => {
      pendingPatch.resolve(Response.json({ ...WORKFLOW, name: 'Alfa módosítva' }));
      await Promise.resolve();
    });
  });

  it('a Mentés gomb üres név mellett le van tiltva', async () => {
    await render(WORKFLOW, createFetchFunction().fetchFunction);
    const nameInput = container.querySelector('input');
    if (nameInput === null) {
      throw new Error('a teszt nem talált név mezőt');
    }

    typeInto(nameInput, '  ');

    const saveButton = [...container.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'Mentés',
    );
    expect(saveButton?.disabled).toBe(true);
  });
});
