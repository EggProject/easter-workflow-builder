import type { StartInputField } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StartRunModal } from './StartRunModal.tsx';
import { REQUIRED_START_FIELD_MESSAGE } from './start-run-values.ts';

const REQUIRED_FIELD: StartInputField = { name: 'topic', label: 'Téma', valueKind: 'string', required: true };
const OPTIONAL_FIELD: StartInputField = { name: 'note', label: 'Megjegyzés', valueKind: 'string', required: false };

function typeInto(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('StartRunModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();
  const onSubmit = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    onSubmit.mockClear();
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

  interface RenderOptions {
    readonly open?: boolean;
    readonly fields?: readonly StartInputField[];
    readonly isSubmitting?: boolean;
    readonly errorMessage?: string | undefined;
  }

  function renderModal(options: RenderOptions = {}): void {
    act(() => {
      root.render(
        <StartRunModal
          open={options.open ?? true}
          fields={options.fields ?? [REQUIRED_FIELD, OPTIONAL_FIELD]}
          isSubmitting={options.isSubmitting ?? false}
          errorMessage={options.errorMessage}
          onClose={onClose}
          onSubmit={onSubmit}
        />,
      );
    });
  }

  function fieldInput(label: string): HTMLInputElement {
    const input = [...container.querySelectorAll<HTMLInputElement>('input.input')].find(
      (candidate) => candidate.closest('.field')?.querySelector('.field__label')?.textContent === label,
    );
    if (input === undefined) {
      throw new Error(`a teszt nem talált "${label}" feliratú mezőt`);
    }
    return input;
  }

  function submitForm(): void {
    const form = container.querySelector('form');
    if (form === null) {
      throw new Error('a teszt nem talált <form> elemet');
    }
    act(() => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  }

  it('minden bemeneti mezőre rajzol egy szöveges mezőt, a kötelezőt megjelölve', () => {
    renderModal();

    expect(fieldInput('Téma').required).toBe(true);
    expect(fieldInput('Megjegyzés').required).toBe(false);
  });

  it('a kitöltött értékeket a StartRunRequest input objektumaként adja át', () => {
    renderModal();
    act(() => {
      typeInto(fieldInput('Téma'), 'AI hírek');
      typeInto(fieldInput('Megjegyzés'), 'rövid');
    });

    submitForm();

    expect(onSubmit).toHaveBeenCalledWith({ topic: 'AI hírek', note: 'rövid' });
  });

  it('üresen hagyott kötelező mezővel nem küld, és a hibát a MEZŐ ALATT írja ki, összesítő nélkül', () => {
    renderModal();

    submitForm();

    expect(onSubmit).not.toHaveBeenCalled();
    const input = fieldInput('Téma');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const errorId = input.getAttribute('aria-describedby');
    const error = errorId === null ? undefined : container.querySelector(`#${errorId}`);
    expect(error?.textContent).toBe(REQUIRED_START_FIELD_MESSAGE);
    expect(error?.getAttribute('role')).toBe('alert');
    // A hibaüzenet a mező `.field` burkolóján BELÜL áll, tehát nem egy űrlap
    // tetején álló összesítő.
    expect(error?.closest('.field')).toBe(input.closest('.field'));
    expect(container.querySelectorAll('.field__error')).toHaveLength(1);
  });

  it('érintetlen mezőn beküldési kísérlet előtt nincs hibaüzenet', () => {
    renderModal();

    expect(container.querySelectorAll('.field__error')).toHaveLength(0);
    expect(fieldInput('Téma').getAttribute('aria-invalid')).toBeNull();
  });

  it('a mező elhagyása után beküldési kísérlet nélkül is kiírja a hibát', () => {
    renderModal();

    act(() => {
      // A React az `onBlur` propot a natív, FELBUBBLÁZÓ `focusout` eseményre
      // köti (a natív `blur` nem bubblázik, tehát a delegált kezelőt nem
      // hívná meg): ugyanaz a minta, mint a `packages/ui` `Menu.spec.tsx`
      // fájljában.
      fieldInput('Téma').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    expect(container.querySelector('.field__error')?.textContent).toBe(REQUIRED_START_FIELD_MESSAGE);
  });

  it('a javítás után a beküldés átmegy', () => {
    renderModal();
    submitForm();
    expect(onSubmit).not.toHaveBeenCalled();

    act(() => {
      typeInto(fieldInput('Téma'), 'AI');
    });
    submitForm();

    expect(onSubmit).toHaveBeenCalledWith({ topic: 'AI' });
    expect(container.querySelectorAll('.field__error')).toHaveLength(0);
  });

  it('a küldés alatt mindkét gomb letiltva, az indításon spinner áll', () => {
    renderModal({ isSubmitting: true });

    const buttons = [...container.querySelectorAll<HTMLButtonElement>(':scope .modal__footer button.btn')];
    expect(buttons.map((button) => button.textContent)).toEqual(['Mégse', 'Indítás']);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(container.querySelector(':scope .modal__footer .btn.is-loading')?.textContent).toContain('Indítás');
  });

  it('a szerver oldali hibát az űrlapban, riasztásként írja ki', () => {
    renderModal({ errorMessage: 'A szerver nem érhető el.' });

    expect(container.querySelector(':scope form [role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
  });

  it('újranyitáskor az előző értékek és a beküldési kísérlet nyoma eltűnik', () => {
    renderModal();
    act(() => {
      typeInto(fieldInput('Téma'), 'AI');
    });
    submitForm();
    expect(onSubmit).toHaveBeenCalledTimes(1);

    renderModal({ open: false });
    renderModal({ open: true });

    expect(fieldInput('Téma').value).toBe('');
    expect(container.querySelectorAll('.field__error')).toHaveLength(0);
  });

  it('zárva nem rajzol dialógust', () => {
    renderModal({ open: false });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
