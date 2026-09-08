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
      expect.objectContaining({ inputFields: [{ name: '', label: '', valueKind: 'string', required: false }] }),
    );
  });

  it('egy meglévő mező minden almezője szerkeszthető', () => {
    const onChange = vi.fn();
    const config: StartNodeConfig = {
      ...EMPTY_CONFIG,
      inputFields: [{ name: 'a', label: 'A', valueKind: 'string', required: false }],
    };
    act(() => {
      root.render(<StartNodeFields config={config} onChange={onChange} />);
    });
    const [nameInput, labelInput, valueKindInput] = [
      ...container.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])'),
    ];
    if (nameInput === undefined || labelInput === undefined || valueKindInput === undefined) {
      throw new Error('a teszt nem találta a bemeneti mező szöveg mezőit');
    }
    act(() => {
      typeInto(nameInput, 'b');
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ inputFields: [{ name: 'b', label: 'A', valueKind: 'string', required: false }] }),
    );

    act(() => {
      typeInto(labelInput, 'B');
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ inputFields: [{ name: 'a', label: 'B', valueKind: 'string', required: false }] }),
    );

    act(() => {
      typeInto(valueKindInput, 'number');
    });
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
      expect.objectContaining({ inputFields: [{ name: 'a', label: 'A', valueKind: 'string', required: true }] }),
    );
  });

  it('több mező esetén egy mező szerkesztése a többi mezőt változatlanul hagyja', () => {
    const onChange = vi.fn();
    const config: StartNodeConfig = {
      ...EMPTY_CONFIG,
      inputFields: [
        { name: 'a', label: 'A', valueKind: 'string', required: false },
        { name: 'b', label: 'B', valueKind: 'string', required: false },
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
          { name: 'x', label: 'A', valueKind: 'string', required: false },
          { name: 'b', label: 'B', valueKind: 'string', required: false },
        ],
      }),
    );
  });

  it('a törlés gomb eltávolítja a mezőt', () => {
    const onChange = vi.fn();
    const config: StartNodeConfig = {
      ...EMPTY_CONFIG,
      inputFields: [
        { name: 'a', label: 'A', valueKind: 'string', required: false },
        { name: 'b', label: 'B', valueKind: 'string', required: false },
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
      expect.objectContaining({ inputFields: [{ name: 'b', label: 'B', valueKind: 'string', required: false }] }),
    );
  });

  it('az `inputFields.0.name` mezőnkénti hibája megjelenik a mező alatt, aria kötéssel', () => {
    const config: StartNodeConfig = {
      ...EMPTY_CONFIG,
      inputFields: [{ name: 'a', label: 'A', valueKind: 'string', required: false }],
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
