/* eslint-disable unicorn/no-null -- a teszt a `systemPrompt` nullázható mezőit vizsgálja (SPEC-005 protokoll alak). */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemPromptField } from './SystemPromptField.tsx';

function typeInto(element: HTMLSelectElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function modeSelect(container: HTMLElement): HTMLSelectElement {
  const select = [...container.querySelectorAll<HTMLSelectElement>('select')].find(
    (candidate) => candidate.closest('label')?.textContent.includes('Rendszer prompt módja') === true,
  );
  if (select === undefined) {
    throw new Error('a teszt nem talált mód választó select elemet');
  }
  return select;
}

function excludeSelect(container: HTMLElement): HTMLSelectElement {
  const select = [...container.querySelectorAll<HTMLSelectElement>('select')].find(
    (candidate) => candidate.closest('label')?.textContent.includes('Dinamikus szekciók kizárása') === true,
  );
  if (select === undefined) {
    throw new Error('a teszt nem talált exclude select elemet');
  }
  return select;
}

describe('SystemPromptField', () => {
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

  it('`null` értékre a mód "nincs megadva", sem szöveg, sem preset mező nincs', () => {
    act(() => {
      root.render(<SystemPromptField value={null} onChange={vi.fn()} />);
    });
    expect(modeSelect(container).value).toBe('none');
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('szöveg értékre a mód "szöveg", a textarea az értéket mutatja, szerkesztése frissít', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<SystemPromptField value="egy prompt" onChange={onChange} />);
    });
    expect(modeSelect(container).value).toBe('text');
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a textarea-t');
    }
    expect(textarea.value).toBe('egy prompt');
    act(() => {
      typeInto(textarea, 'módosított');
    });
    expect(onChange).toHaveBeenCalledWith('módosított');
  });

  it('preset értékre a mód "preset", az append és az exclude mező szerkeszthető', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <SystemPromptField
          value={{ type: 'preset', preset: 'claude_code', append: 'kiegészítés', excludeDynamicSections: true }}
          onChange={onChange}
        />,
      );
    });
    expect(modeSelect(container).value).toBe('preset');
    const appendTextarea = container.querySelector('textarea');
    if (appendTextarea === null) {
      throw new Error('a teszt nem találta az append textarea-t');
    }
    expect(appendTextarea.value).toBe('kiegészítés');
    act(() => {
      typeInto(appendTextarea, '');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ append: null }));

    expect(excludeSelect(container).value).toBe('true');
    act(() => {
      typeInto(excludeSelect(container), 'false');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ excludeDynamicSections: false }));
    act(() => {
      typeInto(excludeSelect(container), '');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ excludeDynamicSections: null }));
  });

  it('preset "nincs megadva" exclude állapotra üres választót mutat', () => {
    act(() => {
      root.render(
        <SystemPromptField
          value={{ type: 'preset', preset: 'claude_code', append: null, excludeDynamicSections: null }}
          onChange={vi.fn()}
        />,
      );
    });
    expect(excludeSelect(container).value).toBe('');
  });

  it('a mód váltása "nincs megadva"-ra `null` értéket ad', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<SystemPromptField value="szöveg" onChange={onChange} />);
    });
    act(() => {
      typeInto(modeSelect(container), 'none');
    });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('a mód váltása "szöveg"-re üres sztringet ad', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<SystemPromptField value={null} onChange={onChange} />);
    });
    act(() => {
      typeInto(modeSelect(container), 'text');
    });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('a mód váltása "preset"-re az alapértelmezett preset objektumot adja', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<SystemPromptField value={null} onChange={onChange} />);
    });
    act(() => {
      typeInto(modeSelect(container), 'preset');
    });
    expect(onChange).toHaveBeenCalledWith({
      type: 'preset',
      preset: 'claude_code',
      append: null,
      excludeDynamicSections: null,
    });
  });

  it('egy DOM szinten érvénytelen mód értékre nem hívja az onChange-et', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<SystemPromptField value={null} onChange={onChange} />);
    });
    act(() => {
      typeInto(modeSelect(container), 'nincs-ilyen-mod');
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
