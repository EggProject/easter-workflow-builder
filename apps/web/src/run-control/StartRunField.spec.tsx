import type { StartInputField } from '@easter-workflow-builder/protocol';
import { FieldErrorVisibilityContext } from '@easter-workflow-builder/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StartRunField } from './StartRunField.tsx';
import { EMPTY_START_RUN_FIELD_VALUE, type StartRunFieldValue } from './start-run-values.ts';

function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
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

function requireElement<TElement extends Element>(element: TElement | null | undefined, description: string): TElement {
  if (element === null || element === undefined) {
    throw new Error(`a teszt nem találta: ${description}`);
  }
  return element;
}

function optionLabelOf(option: HTMLElement): string | undefined {
  return option.querySelector('.menu__text')?.textContent ?? undefined;
}

describe('StartRunField', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onChange = vi.fn<(nextValue: StartRunFieldValue) => void>();

  beforeEach(() => {
    onChange.mockClear();
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

  function renderField(
    field: StartInputField,
    value: StartRunFieldValue = EMPTY_START_RUN_FIELD_VALUE,
    error?: string,
  ): void {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <StartRunField field={field} value={value} error={error} onChange={onChange} />
        </FieldErrorVisibilityContext.Provider>,
      );
    });
  }

  function labelOf(): string | undefined {
    return container.querySelector('.field__label, .ctrl__label')?.textContent ?? undefined;
  }

  function openChoiceOptions(): readonly HTMLElement[] {
    const trigger = requireElement(container.querySelector<HTMLButtonElement>('button.select'), 'a választót');
    clickOn(trigger);
    const panel = [...document.body.querySelectorAll<HTMLElement>('[role="listbox"]')].find(
      (candidate) => candidate.id === trigger.getAttribute('aria-controls'),
    );
    return [...(panel?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
  }

  it('a szöveg mező szöveges beviteli mező, a kötelezőséget jelzi, és a begépelt szöveget adja', () => {
    renderField(
      { name: 'topic', label: 'Téma', valueKind: 'text', required: true },
      { ...EMPTY_START_RUN_FIELD_VALUE, text: 'AI' },
    );
    const input = requireElement(container.querySelector<HTMLInputElement>('input.input'), 'a szöveg mezőt');
    expect(labelOf()).toBe('Téma');
    expect(input.type).toBe('text');
    expect(input.required).toBe(true);
    expect(input.value).toBe('AI');

    act(() => {
      typeInto(input, 'AI hírek');
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_START_RUN_FIELD_VALUE, text: 'AI hírek' });
  });

  it('a szám mező type="number", üres állapotban üres, és a valueAsNumber értéket adja', () => {
    renderField({ name: 'count', label: 'Darab', valueKind: 'number', required: false });
    const input = requireElement(container.querySelector<HTMLInputElement>('input.input'), 'a szám mezőt');
    expect(input.type).toBe('number');
    expect(input.getAttribute('step')).toBe('any');
    expect(input.value).toBe('');

    act(() => {
      typeInto(input, '4.5');
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_START_RUN_FIELD_VALUE, number: 4.5 });
  });

  it('a szám mező kiürítése NaN értéket ad', () => {
    renderField(
      { name: 'count', label: 'Darab', valueKind: 'number', required: false },
      { ...EMPTY_START_RUN_FIELD_VALUE, number: 4.5 },
    );
    const input = requireElement(container.querySelector<HTMLInputElement>('input.input'), 'a szám mezőt');
    expect(input.value).toBe('4.5');

    act(() => {
      typeInto(input, '');
    });
    expect(onChange.mock.lastCall?.[0].number).toBeNaN();
  });

  it('a szám mező a kapott számot mutatja', () => {
    renderField(
      { name: 'count', label: 'Darab', valueKind: 'number', required: false },
      { ...EMPTY_START_RUN_FIELD_VALUE, number: 0 },
    );
    expect(requireElement(container.querySelector<HTMLInputElement>('input.input'), 'a szám mezőt').value).toBe('0');
  });

  it('a logikai mező jelölőnégyzet a mező címkéjével, és a jelölést adja', () => {
    renderField({ name: 'urgent', label: 'Sürgős', valueKind: 'boolean', required: true });
    const checkbox = requireElement(
      container.querySelector<HTMLInputElement>('input[type="checkbox"]'),
      'a jelölőnégyzetet',
    );
    expect(labelOf()).toBe('Sürgős');
    expect(checkbox.checked).toBe(false);
    // A kötelezőség jelzése a logikai mezőn értelmetlen: a hamis is érték.
    expect(checkbox.required).toBe(false);

    act(() => {
      checkbox.click();
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_START_RUN_FIELD_VALUE, checked: true });
  });

  it('a nem kötelező választólista az opciók előtt egy ürítő opciót is kínál, és az opciót adja', () => {
    renderField({ name: 'color', label: 'Szín', valueKind: 'choice', options: ['piros', 'zöld'], required: false });
    expect(labelOf()).toBe('Szín');
    const options = openChoiceOptions();
    expect(options.map((option) => optionLabelOf(option))).toEqual(['nincs kiválasztva', 'piros', 'zöld']);

    const green = requireElement(options[2], 'a zöld opciót');
    clickOn(green);
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_START_RUN_FIELD_VALUE, text: 'zöld' });
  });

  it('a kötelező választólista csak az opciókat kínálja, kiválasztás előtt a helyettesítő szöveggel', () => {
    renderField({ name: 'color', label: 'Szín', valueKind: 'choice', options: ['piros', 'zöld'], required: true });
    expect(requireElement(container.querySelector('button.select'), 'a választót').textContent).toContain(
      'válassz egy opciót',
    );
    expect(openChoiceOptions().map((option) => optionLabelOf(option))).toEqual(['piros', 'zöld']);
  });

  it('a lista mező soronként egy elemet kérő többsoros mező, és a nyers szöveget adja', () => {
    renderField({ name: 'tags', label: 'Címkék', valueKind: 'list', required: true });
    const textarea = requireElement(container.querySelector('textarea'), 'a lista mezőt');
    expect(labelOf()).toBe('Címkék (soronként egy)');
    expect(textarea.required).toBe(true);

    act(() => {
      typeInto(textarea, 'a\nb');
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_START_RUN_FIELD_VALUE, text: 'a\nb' });
  });

  it('a JSON mező a mező címkéjét viseli, és a nyers szöveget adja', () => {
    renderField({ name: 'payload', label: 'Adat', valueKind: 'json', required: false });
    const textarea = requireElement(container.querySelector('textarea'), 'a JSON mezőt');
    expect(labelOf()).toBe('Adat');
    expect(textarea.required).toBe(false);

    act(() => {
      typeInto(textarea, '{"a": 1}');
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_START_RUN_FIELD_VALUE, text: '{"a": 1}' });
  });

  it('a hibaüzenet a mező alatt áll mind az öt hibát jelezni tudó mezőtípuson', () => {
    const fields: readonly StartInputField[] = [
      { name: 'a', label: 'A', valueKind: 'text', required: false },
      { name: 'b', label: 'B', valueKind: 'number', required: false },
      { name: 'c', label: 'C', valueKind: 'choice', options: ['x'], required: false },
      { name: 'd', label: 'D', valueKind: 'list', required: false },
      { name: 'e', label: 'E', valueKind: 'json', required: false },
    ];
    for (const field of fields) {
      renderField(field, EMPTY_START_RUN_FIELD_VALUE, 'Hiba');
      expect(container.querySelector('.field__error')?.textContent).toBe('Hiba');
    }
  });
});
