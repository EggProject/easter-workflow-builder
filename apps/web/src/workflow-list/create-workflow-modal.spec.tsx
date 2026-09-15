/* eslint-disable unicorn/no-null -- a WorkflowSummary nullázható mezői (description, providerId) a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et (packages/protocol/src/workflow/workflow-record.ts). */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { WorkflowSummary } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateWorkflowModal } from './create-workflow-modal.tsx';

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

const emptyProvidersFetchFunction: FetchFunction = () => Promise.resolve(Response.json([]));

const oneProviderFetchFunction: FetchFunction = () =>
  Promise.resolve(
    Response.json([{ id: 'claude-subscription', displayName: 'Claude előfizetés', models: [], requiredEnvNames: [] }]),
  );

/**
 * Két provider: az egyik kötelező env változó NEVET hordoz, a másik egyet
 * sem. A séma értéket nem is tud vinni (`ProviderSummarySchema`
 * `z.strictObject`), tehát a felület sem tud értéket kiírni (SPEC-007 16.
 * szekció 49. kritérium).
 */
const twoProvidersFetchFunction: FetchFunction = () =>
  Promise.resolve(
    Response.json([
      { id: 'claude-subscription', displayName: 'Claude előfizetés', models: [], requiredEnvNames: [] },
      { id: 'minimax', displayName: 'MiniMax', models: ['MiniMax-M3'], requiredEnvNames: ['MINIMAX_API_KEY'] },
    ]),
  );

const failingCreateFetchFunction: FetchFunction = (input) => {
  if (input.includes('/providers')) {
    return Promise.resolve(Response.json([]));
  }
  return Promise.reject(new Error('kapcsolat megszakadt'));
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
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
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

/**
 * A `SelectField` trigger `role="combobox"` szerepű gomb; a mezőt a saját
 * `.field` burkolóján belüli `.field__label` szövege azonosítja.
 */
function selectTrigger(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button.select')].find(
    (candidate) => candidate.closest('.field')?.querySelector('.field__label')?.textContent === label,
  );
  if (button === undefined) {
    throw new Error(`a teszt nem talált "${label}" feliratú select triggert`);
  }
  return button;
}

/**
 * A panel `createPortal`-lal a `document.body`-ba kerül, tehát NEM a
 * `container` leszármazottja; a triggerhez az `aria-controls` köti.
 */
function selectPanel(trigger: HTMLButtonElement): HTMLElement {
  const panelId = trigger.getAttribute('aria-controls');
  const panel = [...document.body.querySelectorAll<HTMLElement>('[role="listbox"]')].find(
    (candidate) => candidate.id === panelId,
  );
  if (panel === undefined) {
    throw new Error('a teszt nem találta a select panelt');
  }
  return panel;
}

function chooseOption(container: HTMLElement, label: string, optionLabel: string): void {
  const trigger = selectTrigger(container, label);
  clickOn(trigger);
  const option = [...selectPanel(trigger).querySelectorAll<HTMLElement>('[role="option"]')].find(
    (candidate) => candidate.querySelector('.menu__text')?.textContent === optionLabel,
  );
  if (option === undefined) {
    throw new Error(`a teszt nem talált "${optionLabel}" feliratú opciót a(z) "${label}" mezőben`);
  }
  clickOn(option);
}

describe('CreateWorkflowModal', () => {
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

  it('zárt állapotban nem rajzol dialógust', () => {
    act(() => {
      root.render(
        <CreateWorkflowModal
          open={false}
          onClose={noop}
          onCreated={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={rejectingFetchFunction}
        />,
      );
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('nyitáskor betölti a providerek listáját, majd az opciók megjelennek', async () => {
    await act(async () => {
      root.render(
        <CreateWorkflowModal
          open
          onClose={noop}
          onCreated={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={oneProviderFetchFunction}
        />,
      );
      await Promise.resolve();
    });

    const panel = selectPanel(selectTrigger(container, 'Provider'));
    expect(panel.querySelectorAll('[role="option"]')).toHaveLength(2);
  });

  it('provider választás nélkül nem ír ki env változó nevet', async () => {
    await act(async () => {
      root.render(
        <CreateWorkflowModal
          open
          onClose={noop}
          onCreated={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={twoProvidersFetchFunction}
        />,
      );
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain('Szükséges környezeti változók');
    expect(container.textContent).not.toContain('nem kell környezeti változó');
  });

  it('a kiválasztott provider kötelező env változóinak NEVÉT jeleníti meg', async () => {
    await act(async () => {
      root.render(
        <CreateWorkflowModal
          open
          onClose={noop}
          onCreated={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={twoProvidersFetchFunction}
        />,
      );
      await Promise.resolve();
    });

    chooseOption(container, 'Provider', 'MiniMax');

    expect(container.textContent).toContain('Szükséges környezeti változók: MINIMAX_API_KEY');
  });

  it('env változót nem igénylő providerre ezt mondja ki, nem hagyja üresen', async () => {
    await act(async () => {
      root.render(
        <CreateWorkflowModal
          open
          onClose={noop}
          onCreated={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={twoProvidersFetchFunction}
        />,
      );
      await Promise.resolve();
    });

    chooseOption(container, 'Provider', 'Claude előfizetés');

    expect(container.textContent).toContain('Ehhez a providerhez nem kell környezeti változó.');
  });

  it('sikeres létrehozásra meghívja az onCreated és az onClose callbacket', async () => {
    let capturedBody: string | undefined;
    const fetchFunction: FetchFunction = (input, init) => {
      if (input.includes('/providers')) {
        return Promise.resolve(Response.json([]));
      }
      capturedBody = typeof init.body === 'string' ? init.body : undefined;
      return Promise.resolve(Response.json(WORKFLOW));
    };

    let createdWorkflow: WorkflowSummary | undefined;
    let closeCallCount = 0;

    await act(async () => {
      root.render(
        <CreateWorkflowModal
          open
          onClose={() => {
            closeCallCount += 1;
          }}
          onCreated={(workflow) => {
            createdWorkflow = workflow;
          }}
          apiOrigin={API_ORIGIN}
          fetchFunction={fetchFunction}
        />,
      );
      await Promise.resolve();
    });

    const nameInput = container.querySelector('input');
    if (nameInput === null) {
      throw new Error('a teszt nem talált input mezőt');
    }
    act(() => {
      typeInto(nameInput, 'Alfa');
    });

    await act(async () => {
      submitForm(container);
      await Promise.resolve();
    });

    expect(createdWorkflow).toEqual(WORKFLOW);
    expect(closeCallCount).toBe(1);
    expect(capturedBody).toBe(JSON.stringify({ name: 'Alfa', description: null, providerId: null }));
  });

  it('kitöltött leírás és provider mezőkkel a törzsbe a tényleges értékek kerülnek', async () => {
    let capturedBody: string | undefined;
    const fetchFunction: FetchFunction = (input, init) => {
      if (input.includes('/providers')) {
        return Promise.resolve(
          Response.json([
            { id: 'claude-subscription', displayName: 'Claude előfizetés', models: [], requiredEnvNames: [] },
          ]),
        );
      }
      capturedBody = typeof init.body === 'string' ? init.body : undefined;
      return Promise.resolve(Response.json(WORKFLOW));
    };

    await act(async () => {
      root.render(
        <CreateWorkflowModal
          open
          onClose={noop}
          onCreated={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={fetchFunction}
        />,
      );
      await Promise.resolve();
    });

    const inputs = container.querySelectorAll('input');
    const nameInput = inputs[0];
    const descriptionInput = inputs[1];
    if (nameInput === undefined || descriptionInput === undefined) {
      throw new Error('a teszt nem talált minden mezőt');
    }
    act(() => {
      typeInto(nameInput, 'Alfa');
      typeInto(descriptionInput, 'egy leírás');
    });
    chooseOption(container, 'Provider', 'Claude előfizetés');

    await act(async () => {
      submitForm(container);
      await Promise.resolve();
    });

    expect(capturedBody).toBe(
      JSON.stringify({ name: 'Alfa', description: 'egy leírás', providerId: 'claude-subscription' }),
    );
  });

  it('hiba esetén a hibaüzenetet jeleníti meg, a modális nyitva marad', async () => {
    let closeCallCount = 0;

    await act(async () => {
      root.render(
        <CreateWorkflowModal
          open
          onClose={() => {
            closeCallCount += 1;
          }}
          onCreated={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={failingCreateFetchFunction}
        />,
      );
      await Promise.resolve();
    });

    const nameInput = container.querySelector('input');
    if (nameInput === null) {
      throw new Error('a teszt nem talált input mezőt');
    }
    act(() => {
      typeInto(nameInput, 'Alfa');
    });

    await act(async () => {
      submitForm(container);
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
    expect(closeCallCount).toBe(0);
  });

  it('a Létrehozás gomb üres név mellett le van tiltva', async () => {
    await act(async () => {
      root.render(
        <CreateWorkflowModal
          open
          onClose={noop}
          onCreated={noop}
          apiOrigin={API_ORIGIN}
          fetchFunction={emptyProvidersFetchFunction}
        />,
      );
      await Promise.resolve();
    });

    const submitButton = container.querySelector('button[type="submit"]');
    expect(submitButton).toHaveProperty('disabled', true);
  });
});
