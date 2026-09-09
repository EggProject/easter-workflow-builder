import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonTextAreaField } from './JsonTextAreaField.tsx';

function typeInto(textarea: HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  descriptor?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('JsonTextAreaField', () => {
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

  it('a kezdő értéket formázott JSON szövegként mutatja', () => {
    act(() => {
      root.render(<JsonTextAreaField label="Sandbox" value={{ enabled: true }} onChange={vi.fn()} />);
    });
    const textarea = container.querySelector('textarea');
    expect(textarea?.value).toContain('"enabled": true');
  });

  it('érvényes JSON szerkesztésre az onChange a beolvasott értékkel hívódik, hiba nélkül', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<JsonTextAreaField label="Sandbox" value={{}} onChange={onChange} />);
    });
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a textarea-t');
    }
    act(() => {
      typeInto(textarea, '{"enabled":false}');
    });
    expect(onChange).toHaveBeenCalledWith({ enabled: false });
    expect(container.querySelector('.field__error')).toBeNull();
  });

  it('érvénytelen JSON szerkesztésre hibát mutat, és nem hívja az onChange-et', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<JsonTextAreaField label="Sandbox" value={{}} onChange={onChange} />);
    });
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a textarea-t');
    }
    act(() => {
      typeInto(textarea, '{nem json');
    });
    expect(onChange).not.toHaveBeenCalled();
    // A hibaüzenet csak ÉRINTETT mezőn látszik (`packages/ui`
    // `field-error-visibility` téma), tehát a mező elhagyása kell hozzá.
    expect(container.querySelector('.field__error')).toBeNull();
    act(() => {
      textarea.focus();
      textarea.blur();
    });
    expect(container.querySelector('.field__error')?.textContent).toContain('Érvénytelen JSON');
  });
});
