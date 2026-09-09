import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldErrorVisibilityContext } from '../field-error-visibility/field-error-visibility-context.ts';
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

  function renderedTextArea(): HTMLTextAreaElement {
    const textArea = container.querySelector<HTMLTextAreaElement>('textarea');
    if (textArea === null) {
      throw new Error('a többsoros mező nem található a kirajzolt fán');
    }
    return textArea;
  }

  function blurTextArea(): void {
    act(() => {
      renderedTextArea().focus();
      renderedTextArea().blur();
    });
  }

  it('a design system .textarea osztályát viseli, NEM az egysoros .input osztályt', () => {
    act(() => {
      root.render(<TextAreaField label="Prompt sablon" />);
    });
    expect(renderedTextArea().className).toBe('textarea');
    expect(renderedTextArea().classList.contains('input')).toBe(false);
  });

  it('md méretre nem tesz hozzá méret módosítót, sm méretre igen', () => {
    act(() => {
      root.render(<TextAreaField label="Forrás" size="md" />);
    });
    expect(renderedTextArea().className).toBe('textarea');

    act(() => {
      root.render(<TextAreaField label="Forrás" size="sm" />);
    });
    expect(renderedTextArea().className).toBe('textarea textarea--sm');
  });

  it('a címke a .field burkolóban, a .field__label elemben áll', () => {
    act(() => {
      root.render(<TextAreaField label="Prompt sablon" />);
    });
    const label = container.querySelector('label.field');
    expect(label).not.toBeNull();
    expect(container.querySelector('.field__label')?.textContent).toBe('Prompt sablon');
    expect(label?.contains(renderedTextArea())).toBe(true);
  });

  it('alapértelmezésben három soros, és a hívó rows értéke felülírja', () => {
    act(() => {
      root.render(<TextAreaField label="Forrás" />);
    });
    expect(renderedTextArea().getAttribute('rows')).toBe('3');
    act(() => {
      root.render(<TextAreaField label="Forrás" rows={6} />);
    });
    expect(renderedTextArea().getAttribute('rows')).toBe('6');
  });

  it('azonosító nélkül useId generálta, nem üres azonosítót kap; a hívóé felülírja', () => {
    act(() => {
      root.render(<TextAreaField label="Forrás" />);
    });
    expect(renderedTextArea().id.length).toBeGreaterThan(0);
    act(() => {
      root.render(<TextAreaField label="Forrás" id="forras" />);
    });
    expect(renderedTextArea().id).toBe('forras');
  });

  it('érintetlen mezőn nincs hibaüzenet, akkor sem, ha az érték érvénytelen', () => {
    act(() => {
      root.render(<TextAreaField label="Forrás" id="forras" error="Kötelező mező" />);
    });
    expect(container.querySelector('.field__error')).toBeNull();
    expect(renderedTextArea().className).toBe('textarea');
    expect(renderedTextArea().getAttribute('aria-invalid')).toBeNull();
    expect(renderedTextArea().getAttribute('aria-describedby')).toBeNull();
  });

  it('érintés után hibás állapot: is-error, aria-invalid, aria-describedby és a mező alatti üzenet', () => {
    act(() => {
      root.render(<TextAreaField label="Forrás" id="forras" error="Kötelező mező" />);
    });
    blurTextArea();
    expect(renderedTextArea().className).toBe('textarea is-error');
    expect(renderedTextArea().getAttribute('aria-invalid')).toBe('true');
    expect(renderedTextArea().getAttribute('aria-describedby')).toBe('forras-error');
    const errorElement = container.querySelector('.field__error');
    expect(errorElement?.textContent).toBe('Kötelező mező');
    expect(errorElement?.getAttribute('role')).toBe('alert');
  });

  it('megkísérelt beküldés után érintetlen mezőn is látszik a hibaüzenet', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <TextAreaField label="Forrás" error="Kötelező mező" />
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    expect(container.querySelector('.field__error')?.textContent).toBe('Kötelező mező');
  });

  it('a hívó saját onBlur kezelője megmarad az érintettség jelölése mellett', () => {
    const onBlur = vi.fn();
    act(() => {
      root.render(<TextAreaField label="Forrás" error="Kötelező mező" onBlur={onBlur} />);
    });
    blurTextArea();
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.field__error')).not.toBeNull();
  });

  it('hiba nélkül a hívó aria-invalid és aria-describedby értéke változatlanul megy át', () => {
    act(() => {
      root.render(<TextAreaField label="Forrás" aria-invalid="true" aria-describedby="sugo" />);
    });
    expect(renderedTextArea().getAttribute('aria-invalid')).toBe('true');
    expect(renderedTextArea().getAttribute('aria-describedby')).toBe('sugo');
  });

  it('látható hiba mellett a hívó aria-describedby értéke és a hiba azonosítója összefűződik', () => {
    act(() => {
      root.render(<TextAreaField label="Forrás" id="forras" aria-describedby="sugo" error="Hibás" />);
    });
    blurTextArea();
    expect(renderedTextArea().getAttribute('aria-describedby')).toBe('sugo forras-error');
  });

  it('a className az elemre kerül, és a natív attribútumok áttovábbítódnak', () => {
    act(() => {
      root.render(<TextAreaField label="Forrás" className="sajat" placeholder="Írj ide" disabled />);
    });
    expect(renderedTextArea().className).toBe('textarea sajat');
    expect(renderedTextArea().getAttribute('placeholder')).toBe('Írj ide');
    expect(renderedTextArea().disabled).toBe(true);
  });
});
