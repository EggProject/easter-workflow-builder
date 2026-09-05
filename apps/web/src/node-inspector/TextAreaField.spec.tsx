import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextAreaField } from './TextAreaField.tsx';

describe('TextAreaField', () => {
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

  it('a címkét és az értéket megjeleníti, hiba nélkül', () => {
    act(() => {
      root.render(<TextAreaField label="Prompt" value="szöveg" onChange={vi.fn()} />);
    });
    expect(container.querySelector('.field__label')?.textContent).toBe('Prompt');
    const textarea = container.querySelector('textarea');
    expect(textarea?.value).toBe('szöveg');
    expect(textarea?.className).not.toContain('input--error');
    expect(container.querySelector('.field__error')).toBeNull();
  });

  it('hiba esetén hibás állapotba állítja a mezőt és megjeleníti az üzenetet', () => {
    act(() => {
      root.render(<TextAreaField label="Prompt" value="" error="kötelező mező" onChange={vi.fn()} />);
    });
    const textarea = container.querySelector('textarea');
    expect(textarea?.className).toContain('input--error');
    expect(container.querySelector('.field__error')?.textContent).toBe('kötelező mező');
  });

  it('a szerkesztésre az onChange a beírt értékkel hívódik', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<TextAreaField label="Prompt" value="" onChange={onChange} />);
    });
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem talált textarea elemet');
    }
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    act(() => {
      descriptor?.set?.call(textarea, 'új érték');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalled();
  });
});
