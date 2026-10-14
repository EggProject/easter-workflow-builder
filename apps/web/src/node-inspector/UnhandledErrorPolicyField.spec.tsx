/* eslint-disable unicorn/no-null -- az `onUnhandledError` "nincs beállítva" állapota a dróton ténylegesen `null` (SPEC-005). */
import { FieldErrorVisibilityContext } from '@easter-workflow-builder/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnhandledErrorPolicyField } from './UnhandledErrorPolicyField.tsx';
import { FieldErrorsContext } from './field-errors-context.ts';

const LABEL = 'Kezeletlen hiba szabálya';

/**
 * A `detail: 1` kötelező: a `SelectField` a `detail === 0` kattintást
 * billentyűzetből származónak tekinti, és szándékosan nem nyit rá.
 */
function clickOn(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
}

function trigger(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('button.select');
  if (button === null) {
    throw new Error('a teszt nem találta a select triggert');
  }
  return button;
}

/**
 * A panel `createPortal`-lal a `document.body`-ba kerül; a triggerhez az
 * `aria-controls` köti.
 */
function optionLabels(button: HTMLButtonElement): readonly (string | null | undefined)[] {
  const panel = document.body.querySelector(`#${button.getAttribute('aria-controls') ?? ''}`);
  return [...(panel?.querySelectorAll('[role="option"]') ?? [])].map(
    (option) => option.querySelector('.menu__text')?.textContent,
  );
}

function chooseOption(container: HTMLElement, optionLabel: string): void {
  const button = trigger(container);
  clickOn(button);
  const panel = document.body.querySelector(`#${button.getAttribute('aria-controls') ?? ''}`);
  const option = [...(panel?.querySelectorAll('[role="option"]') ?? [])].find(
    (candidate) => candidate.querySelector('.menu__text')?.textContent === optionLabel,
  );
  if (option === undefined) {
    throw new Error(`a teszt nem talált "${optionLabel}" feliratú opciót`);
  }
  clickOn(option);
}

describe('UnhandledErrorPolicyField', () => {
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

  it('sm méretű SelectField a "Kezeletlen hiba szabálya" címkével, a null érték a helyőrzőt mutatja, a lista pontosan két opció (SPEC-008 5.2, O-29)', () => {
    act(() => {
      root.render(<UnhandledErrorPolicyField value={null} onChange={vi.fn()} />);
    });
    const button = trigger(container);
    expect(button.className).toContain('select--sm');
    expect(button.closest('.field')?.querySelector('.field__label')?.textContent).toBe(LABEL);
    expect(button.textContent).toBe('Válassz…');
    expect(button.querySelector('.select__value')?.classList.contains('select__value--placeholder')).toBe(true);

    clickOn(button);
    expect(optionLabels(button)).toEqual(['fail_run', 'fail_branch']);
  });

  it('a választott érték a tárolt értéket kapja, és a helyőrző nem látszik', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<UnhandledErrorPolicyField value="fail_run" onChange={onChange} />);
    });
    const button = trigger(container);
    expect(button.textContent).toBe('fail_run');
    expect(button.querySelector('.select__value')?.classList.contains('select__value--placeholder')).toBe(false);

    chooseOption(container, 'fail_branch');
    expect(onChange).toHaveBeenLastCalledWith('fail_branch');
  });

  it('választás után a lista egyetlen opciója sem adja vissza a null értéket: a mező üresre nem állítható vissza (user döntés 2026-10-14)', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<UnhandledErrorPolicyField value="fail_run" onChange={onChange} />);
    });
    expect(optionLabels(trigger(container))).toEqual(['fail_run', 'fail_branch']);
    chooseOption(container, 'fail_run');
    chooseOption(container, 'fail_branch');
    expect(onChange.mock.calls).toEqual([['fail_run'], ['fail_branch']]);
  });

  it('az `onUnhandledError` útvonal hibája a mező ALATT jelenik meg, aria-invalid és aria-describedby kötéssel', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <FieldErrorsContext.Provider value={new Map([['onUnhandledError', 'A mező nem lehet üres.']])}>
            <UnhandledErrorPolicyField value={null} onChange={vi.fn()} />
          </FieldErrorsContext.Provider>
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    const button = trigger(container);
    expect(button.getAttribute('aria-invalid')).toBe('true');
    const errorElement = container.querySelector('.field__error');
    expect(errorElement?.id).toBe(button.getAttribute('aria-describedby'));
    expect(errorElement?.textContent).toBe('A mező nem lehet üres.');
    expect(errorElement?.getAttribute('role')).toBe('alert');
    expect(button.compareDocumentPosition(errorElement ?? button)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('érintetlen mezőn, mentési kísérlet nélkül a hiba nem látszik, és nincs aria-invalid', () => {
    act(() => {
      root.render(
        <FieldErrorsContext.Provider value={new Map([['onUnhandledError', 'A mező nem lehet üres.']])}>
          <UnhandledErrorPolicyField value={null} onChange={vi.fn()} />
        </FieldErrorsContext.Provider>,
      );
    });
    expect(container.querySelector('.field__error')).toBeNull();
    expect(trigger(container).getAttribute('aria-invalid')).toBeNull();
  });
});
