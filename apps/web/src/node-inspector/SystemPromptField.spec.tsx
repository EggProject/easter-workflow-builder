/* eslint-disable unicorn/no-null -- a teszt a `systemPrompt` nullázható mezőit vizsgálja (SPEC-005 protokoll alak). */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemPromptField } from './SystemPromptField.tsx';

function typeInto(element: HTMLTextAreaElement, value: string): void {
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

function triggerLabel(trigger: HTMLButtonElement): string | null {
  return trigger.querySelector('.select__value')?.textContent ?? null;
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

const MODE_LABEL = 'Rendszer prompt módja';
const EXCLUDE_LABEL = 'Dinamikus szekciók kizárása';

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
    expect(triggerLabel(selectTrigger(container, MODE_LABEL))).toBe('nincs megadva');
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('szöveg értékre a mód "szöveg", a textarea az értéket mutatja, szerkesztése frissít', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<SystemPromptField value="egy prompt" onChange={onChange} />);
    });
    expect(triggerLabel(selectTrigger(container, MODE_LABEL))).toBe('szabad szöveg');
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
    expect(triggerLabel(selectTrigger(container, MODE_LABEL))).toBe('Claude Code preset');
    const appendTextarea = container.querySelector('textarea');
    if (appendTextarea === null) {
      throw new Error('a teszt nem találta az append textarea-t');
    }
    expect(appendTextarea.value).toBe('kiegészítés');
    act(() => {
      typeInto(appendTextarea, '');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ append: null }));

    expect(triggerLabel(selectTrigger(container, EXCLUDE_LABEL))).toBe('igen');
    chooseOption(container, EXCLUDE_LABEL, 'nem');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ excludeDynamicSections: false }));
    chooseOption(container, EXCLUDE_LABEL, 'nincs megadva');
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
    expect(triggerLabel(selectTrigger(container, EXCLUDE_LABEL))).toBe('nincs megadva');
  });

  it('a mód váltása "nincs megadva"-ra `null` értéket ad', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<SystemPromptField value="szöveg" onChange={onChange} />);
    });
    chooseOption(container, MODE_LABEL, 'nincs megadva');
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('a mód váltása "szöveg"-re üres sztringet ad', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<SystemPromptField value={null} onChange={onChange} />);
    });
    chooseOption(container, MODE_LABEL, 'szabad szöveg');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('a mód váltása "preset"-re az alapértelmezett preset objektumot adja', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<SystemPromptField value={null} onChange={onChange} />);
    });
    chooseOption(container, MODE_LABEL, 'Claude Code preset');
    expect(onChange).toHaveBeenCalledWith({
      type: 'preset',
      preset: 'claude_code',
      append: null,
      excludeDynamicSections: null,
    });
  });
});
