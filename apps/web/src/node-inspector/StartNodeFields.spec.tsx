import type { StartNodeConfig } from '@easter-workflow-builder/protocol';
import { FieldErrorVisibilityContext } from '@easter-workflow-builder/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StartNodeFields } from './StartNodeFields.tsx';
import { FieldErrorsContext } from './field-errors-context.ts';

function typeInto(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function typeIntoTextArea(element: HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  descriptor?.set?.call(element, value);
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

/**
 * A `SelectField` trigger `role="combobox"` szerepű gomb; a panel
 * `createPortal`-lal a `document.body`-ba kerül, a triggerhez az `aria-controls`
 * köti. A függvény megnyitja a panelt, és az opciók `role="option"` elemeit adja.
 */
function openValueKindOptions(container: HTMLElement): readonly HTMLElement[] {
  const trigger = container.querySelector<HTMLButtonElement>('button.select');
  if (trigger === null) {
    throw new Error('a teszt nem találta az Érték típusa választót');
  }
  clickOn(trigger);
  const panelId = trigger.getAttribute('aria-controls');
  const panel = [...document.body.querySelectorAll<HTMLElement>('[role="listbox"]')].find(
    (candidate) => candidate.id === panelId,
  );
  return [...(panel?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
}

function optionLabelOf(option: HTMLElement): string | undefined {
  return option.querySelector('.menu__text')?.textContent ?? undefined;
}

function chooseValueKind(container: HTMLElement, optionLabel: string): void {
  const option = openValueKindOptions(container).find((candidate) => optionLabelOf(candidate) === optionLabel);
  if (option === undefined) {
    throw new Error(`a teszt nem talált "${optionLabel}" feliratú opciót`);
  }
  clickOn(option);
}

// eslint-disable-next-line unicorn/no-null -- a `StartNodeConfig.onUnhandledError` a dróton ténylegesen `null` értéket hordoz (SPEC-005).
const EMPTY_CONFIG: StartNodeConfig = { type: 'start', inputFields: [], onUnhandledError: null };

describe('StartNodeFields', () => {
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

  it('üres listára csak a hozzáadás gombot mutatja', () => {
    act(() => {
      root.render(<StartNodeFields config={EMPTY_CONFIG} onChange={vi.fn()} />);
    });
    expect(container.querySelectorAll('.node-inspector__list-row')).toHaveLength(0);
  });

  it('a hozzáadás gomb egy üres mezőt vesz fel', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<StartNodeFields config={EMPTY_CONFIG} onChange={onChange} />);
    });
    const fieldAddButton = container.querySelector('button');
    if (fieldAddButton === null) {
      throw new Error('a teszt nem találta a hozzáadás gombot');
    }
    act(() => {
      fieldAddButton.click();
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ inputFields: [{ name: '', label: '', valueKind: 'text', required: false }] }),
    );
  });

  it('egy meglévő mező minden almezője szerkeszthető', () => {
    const onChange = vi.fn();
    const config: StartNodeConfig = {
      ...EMPTY_CONFIG,
      inputFields: [{ name: 'a', label: 'A', valueKind: 'text', required: false }],
    };
    act(() => {
      root.render(<StartNodeFields config={config} onChange={onChange} />);
    });
    const [nameInput, labelInput] = [
      ...container.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])'),
    ];
    if (nameInput === undefined || labelInput === undefined) {
      throw new Error('a teszt nem találta a bemeneti mező szöveg mezőit');
    }
    act(() => {
      typeInto(nameInput, 'b');
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ inputFields: [{ name: 'b', label: 'A', valueKind: 'text', required: false }] }),
    );

    act(() => {
      typeInto(labelInput, 'B');
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ inputFields: [{ name: 'a', label: 'B', valueKind: 'text', required: false }] }),
    );

    chooseValueKind(container, 'Szám');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ inputFields: [{ name: 'a', label: 'A', valueKind: 'number', required: false }] }),
    );

    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (checkbox === null) {
      throw new Error('a teszt nem találta a kötelező jelölőnégyzetet');
    }
    act(() => {
      checkbox.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ inputFields: [{ name: 'a', label: 'A', valueKind: 'text', required: true }] }),
    );
  });

  it('több mező esetén egy mező szerkesztése a többi mezőt változatlanul hagyja', () => {
    const onChange = vi.fn();
    const config: StartNodeConfig = {
      ...EMPTY_CONFIG,
      inputFields: [
        { name: 'a', label: 'A', valueKind: 'text', required: false },
        { name: 'b', label: 'B', valueKind: 'text', required: false },
      ],
    };
    act(() => {
      root.render(<StartNodeFields config={config} onChange={onChange} />);
    });
    const [firstNameInput] = [...container.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')];
    if (firstNameInput === undefined) {
      throw new Error('a teszt nem találta az első mező név mezőjét');
    }
    act(() => {
      typeInto(firstNameInput, 'x');
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        inputFields: [
          { name: 'x', label: 'A', valueKind: 'text', required: false },
          { name: 'b', label: 'B', valueKind: 'text', required: false },
        ],
      }),
    );
  });

  it('a törlés gomb eltávolítja a mezőt', () => {
    const onChange = vi.fn();
    const config: StartNodeConfig = {
      ...EMPTY_CONFIG,
      inputFields: [
        { name: 'a', label: 'A', valueKind: 'text', required: false },
        { name: 'b', label: 'B', valueKind: 'text', required: false },
      ],
    };
    act(() => {
      root.render(<StartNodeFields config={config} onChange={onChange} />);
    });
    const fieldRemoveButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Törlés',
    );
    if (fieldRemoveButton === undefined) {
      throw new Error('a teszt nem talált Törlés gombot');
    }
    act(() => {
      fieldRemoveButton.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ inputFields: [{ name: 'b', label: 'B', valueKind: 'text', required: false }] }),
    );
  });

  it('a típusválasztó a hat értéket magyar felirattal kínálja', () => {
    const config: StartNodeConfig = {
      ...EMPTY_CONFIG,
      inputFields: [{ name: 'a', label: 'A', valueKind: 'text', required: false }],
    };
    act(() => {
      root.render(<StartNodeFields config={config} onChange={vi.fn()} />);
    });
    expect(container.querySelector('button.select')?.textContent).toContain('Szöveg');
    expect(openValueKindOptions(container).map((option) => optionLabelOf(option))).toEqual([
      'Szöveg',
      'Szám',
      'Igen/nem',
      'Választólista',
      'Lista',
      'JSON adat',
    ]);
  });

  it('a választólistára váltás üres opciólistát vesz fel, a többi mezőt megtartja', () => {
    const onChange = vi.fn();
    const config: StartNodeConfig = {
      ...EMPTY_CONFIG,
      inputFields: [{ name: 'a', label: 'A', valueKind: 'text', required: true }],
    };
    act(() => {
      root.render(<StartNodeFields config={config} onChange={onChange} />);
    });
    chooseValueKind(container, 'Választólista');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        inputFields: [{ name: 'a', label: 'A', valueKind: 'choice', options: [], required: true }],
      }),
    );
  });

  it('a választólistáról másik típusra váltás elhagyja az opciókat', () => {
    const onChange = vi.fn();
    const config: StartNodeConfig = {
      ...EMPTY_CONFIG,
      inputFields: [{ name: 'a', label: 'A', valueKind: 'choice', options: ['piros'], required: false }],
    };
    act(() => {
      root.render(<StartNodeFields config={config} onChange={onChange} />);
    });
    chooseValueKind(container, 'JSON adat');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ inputFields: [{ name: 'a', label: 'A', valueKind: 'json', required: false }] }),
    );
  });

  it('opciók mező csak a választólistánál látszik, és soronként szerkeszthető', () => {
    const onChange = vi.fn();
    const config: StartNodeConfig = {
      ...EMPTY_CONFIG,
      inputFields: [
        { name: 'a', label: 'A', valueKind: 'text', required: false },
        { name: 'b', label: 'B', valueKind: 'choice', options: ['piros', 'zöld'], required: false },
      ],
    };
    act(() => {
      root.render(<StartNodeFields config={config} onChange={onChange} />);
    });
    const textareas = container.querySelectorAll('textarea');
    expect(textareas).toHaveLength(1);
    const [optionsTextarea] = textareas;
    if (optionsTextarea === undefined) {
      throw new Error('a teszt nem találta az opciók mezőt');
    }
    expect(optionsTextarea.value).toBe('piros\nzöld');
    act(() => {
      typeIntoTextArea(optionsTextarea, 'piros\nzöld\nkék');
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        inputFields: [
          { name: 'a', label: 'A', valueKind: 'text', required: false },
          { name: 'b', label: 'B', valueKind: 'choice', options: ['piros', 'zöld', 'kék'], required: false },
        ],
      }),
    );
  });

  it('az `inputFields.0.options` mezőnkénti hibája megjelenik az opciók mező alatt', () => {
    const config: StartNodeConfig = {
      ...EMPTY_CONFIG,
      inputFields: [{ name: 'a', label: 'A', valueKind: 'choice', options: [], required: false }],
    };
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <FieldErrorsContext.Provider value={new Map([['inputFields.0.options', 'Legalább egy opció kell']])}>
            <StartNodeFields config={config} onChange={vi.fn()} />
          </FieldErrorsContext.Provider>
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    expect(container.querySelector('.field__error')?.textContent).toBe('Legalább egy opció kell');
  });

  it('az `inputFields.0.name` mezőnkénti hibája megjelenik a mező alatt, aria kötéssel', () => {
    const config: StartNodeConfig = {
      ...EMPTY_CONFIG,
      inputFields: [{ name: 'a', label: 'A', valueKind: 'text', required: false }],
    };
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <FieldErrorsContext.Provider value={new Map([['inputFields.0.name', 'Kötelező mező']])}>
            <StartNodeFields config={config} onChange={vi.fn()} />
          </FieldErrorsContext.Provider>
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    const [nameInput] = [...container.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')];
    if (nameInput === undefined) {
      throw new Error('a teszt nem találta a név mezőt');
    }
    expect(nameInput.getAttribute('aria-invalid')).toBe('true');
    const errorElement = container.querySelector('.field__error');
    expect(errorElement?.id).toBe(nameInput.getAttribute('aria-describedby'));
    expect(errorElement?.textContent).toBe('Kötelező mező');
  });
});
