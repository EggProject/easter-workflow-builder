import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StructuredOutputField } from './StructuredOutputField.tsx';

function typeInto(element: HTMLSelectElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

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
    expect(container.querySelector('select')).toBeNull();
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
    const select = container.querySelector('select');
    if (select === null) {
      throw new Error('a teszt nem találta a stratégia legördülőt');
    }
    act(() => {
      typeInto(select, 'sdk_output_format');
    });
    expect(onChange).toHaveBeenCalledWith({ strategy: 'sdk_output_format', schema: {} });
  });

  it('egy DOM szinten érvénytelen stratégia értékre nem hívja az onChange-et', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<StructuredOutputField value={{ strategy: 'emit_output_tool', schema: {} }} onChange={onChange} />);
    });
    const select = container.querySelector('select');
    if (select === null) {
      throw new Error('a teszt nem találta a stratégia legördülőt');
    }
    act(() => {
      typeInto(select, 'nincs-ilyen-opcio');
    });
    expect(onChange).not.toHaveBeenCalled();
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
