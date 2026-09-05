/* eslint-disable unicorn/no-null -- a `BranchNodeConfig` nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005). */
import type { BranchNodeConfig } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BranchNodeFields } from './BranchNodeFields.tsx';

function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

const CONFIG: BranchNodeConfig = {
  type: 'branch',
  expression: 'x > 0',
  branches: [{ key: 'pozitiv', label: 'Pozitív' }],
  defaultBranchKey: null,
  onUnhandledError: null,
};

describe('BranchNodeFields', () => {
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

  it('a feltétel kifejezés szerkeszthető', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<BranchNodeFields config={CONFIG} onChange={onChange} />);
    });
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a feltétel mezőt');
    }
    act(() => {
      typeInto(textarea, 'x < 0');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ expression: 'x < 0' }));
  });

  it('egy ág kulcsa és címkéje szerkeszthető', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<BranchNodeFields config={CONFIG} onChange={onChange} />);
    });
    const [keyInput, labelInput] = [...container.querySelectorAll('input')];
    if (keyInput === undefined || labelInput === undefined) {
      throw new Error('a teszt nem találta az ág mezőit');
    }
    act(() => {
      typeInto(keyInput, 'ujkulcs');
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ branches: [{ key: 'ujkulcs', label: 'Pozitív' }] }),
    );
    act(() => {
      typeInto(labelInput, 'Új címke');
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ branches: [{ key: 'pozitiv', label: 'Új címke' }] }),
    );
  });

  it('több ág esetén egy ág szerkesztése a többi ágat változatlanul hagyja', () => {
    const onChange = vi.fn();
    const twoBranchConfig: BranchNodeConfig = {
      ...CONFIG,
      branches: [
        { key: 'pozitiv', label: 'Pozitív' },
        { key: 'negativ', label: 'Negatív' },
      ],
    };
    act(() => {
      root.render(<BranchNodeFields config={twoBranchConfig} onChange={onChange} />);
    });
    const [firstKeyInput] = [...container.querySelectorAll('input')];
    if (firstKeyInput === undefined) {
      throw new Error('a teszt nem találta az első ág kulcs mezőjét');
    }
    act(() => {
      typeInto(firstKeyInput, 'ujkulcs');
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        branches: [
          { key: 'ujkulcs', label: 'Pozitív' },
          { key: 'negativ', label: 'Negatív' },
        ],
      }),
    );
  });

  it('az ág hozzáadása gomb felvesz egy üres ágat', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<BranchNodeFields config={{ ...CONFIG, branches: [] }} onChange={onChange} />);
    });
    const branchAddButton = container.querySelector('button');
    if (branchAddButton === null) {
      throw new Error('a teszt nem találta az ág hozzáadása gombot');
    }
    act(() => {
      branchAddButton.click();
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ branches: [{ key: '', label: '' }] }));
  });

  it('az ág törlése gomb eltávolítja az ágat', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<BranchNodeFields config={CONFIG} onChange={onChange} />);
    });
    const branchRemoveButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Törlés',
    );
    if (branchRemoveButton === undefined) {
      throw new Error('a teszt nem talált Törlés gombot');
    }
    act(() => {
      branchRemoveButton.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ branches: [] }));
  });

  it('az alapértelmezett ág kulcsa szerkeszthető, üresre nullázható', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<BranchNodeFields config={{ ...CONFIG, defaultBranchKey: 'pozitiv' }} onChange={onChange} />);
    });
    const defaultInput = [...container.querySelectorAll('input')].at(-1);
    if (defaultInput === undefined) {
      throw new Error('a teszt nem találta az alapértelmezett ág mezőt');
    }
    expect(defaultInput.value).toBe('pozitiv');
    act(() => {
      typeInto(defaultInput, '');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ defaultBranchKey: null }));
  });
});
