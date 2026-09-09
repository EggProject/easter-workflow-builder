import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StructuredOutputField } from './StructuredOutputField.tsx';

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

const STRATEGY_LABEL = 'Strukturált kimenet stratégiája';

describe('StructuredOutputField', () => {
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

  it('`null` értékre a jelölőnégyzet kikapcsolva, a mezők rejtve', () => {
    act(() => {
      // eslint-disable-next-line unicorn/no-null -- a teszt a "nincs felülírás" állapotot vizsgálja.
      root.render(<StructuredOutputField value={null} onChange={vi.fn()} />);
    });
    expect(container.querySelector('button.select')).toBeNull();
  });

  it('a jelölőnégyzet bekapcsolására egy érvényes alapértelmezett konfigot ad', () => {
    const onChange = vi.fn();
    act(() => {
      // eslint-disable-next-line unicorn/no-null -- lásd fent.
      root.render(<StructuredOutputField value={null} onChange={onChange} />);
    });
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (checkbox === null) {
      throw new Error('a teszt nem találta a jelölőnégyzetet');
    }
    act(() => {
      checkbox.click();
    });
    expect(onChange).toHaveBeenCalledWith({ strategy: 'emit_output_tool', schema: {} });
  });

  it('a jelölőnégyzet kikapcsolására `null`-t ad', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<StructuredOutputField value={{ strategy: 'emit_output_tool', schema: {} }} onChange={onChange} />);
    });
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (checkbox === null) {
      throw new Error('a teszt nem találta a jelölőnégyzetet');
    }
    expect(checkbox.checked).toBe(true);
    act(() => {
      checkbox.click();
    });
    // eslint-disable-next-line unicorn/no-null -- a teszt a "felülírás visszavonása" állapotot vizsgálja.
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('a stratégia váltása frissíti a mezőt', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<StructuredOutputField value={{ strategy: 'emit_output_tool', schema: {} }} onChange={onChange} />);
    });
    chooseOption(container, STRATEGY_LABEL, 'sdk_output_format');
    expect(onChange).toHaveBeenCalledWith({ strategy: 'sdk_output_format', schema: {} });
  });

  it('a séma JSON szerkesztése frissíti a schema mezőt', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<StructuredOutputField value={{ strategy: 'emit_output_tool', schema: {} }} onChange={onChange} />);
    });
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a séma textarea-t');
    }
    act(() => {
      typeInto(textarea, '{"type":"object"}');
    });
    expect(onChange).toHaveBeenCalledWith({ strategy: 'emit_output_tool', schema: { type: 'object' } });
  });
});
