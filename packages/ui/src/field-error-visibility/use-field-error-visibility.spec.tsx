import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FieldErrorVisibilityContext } from './field-error-visibility-context.ts';
import { useFieldErrorVisibility } from './use-field-error-visibility.ts';

/**
 * A hook próbababája: kiírja a láthatóság állapotát, és ad egy gombot, ami
 * az érintettséget jelöli (a valódi mezőkben ezt a `blur` kezelő hívja).
 */
function Probe(properties: Readonly<{ error?: string | undefined }>): ReactElement {
  const { isErrorVisible, markTouched } = useFieldErrorVisibility(properties.error);
  return (
    <button type="button" data-visible={String(isErrorVisible)} onClick={markTouched}>
      próba
    </button>
  );
}

describe('useFieldErrorVisibility', () => {
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

  function renderedButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>('button');
    if (button === null) {
      throw new Error('a próba gomb nem található a kirajzolt fán');
    }
    return button;
  }

  function isVisible(): string | null {
    return renderedButton().getAttribute('data-visible');
  }

  function markTouched(): void {
    act(() => {
      renderedButton().click();
    });
  }

  it('hiba nélkül sosem látható, érintés után sem', () => {
    act(() => {
      root.render(<Probe />);
    });
    expect(isVisible()).toBe('false');
    markTouched();
    expect(isVisible()).toBe('false');
  });

  it('érintetlen, de érvénytelen mezőn nem látható', () => {
    act(() => {
      root.render(<Probe error="Kötelező mező" />);
    });
    expect(isVisible()).toBe('false');
  });

  it('érintett és érvénytelen mezőn látható', () => {
    act(() => {
      root.render(<Probe error="Kötelező mező" />);
    });
    markTouched();
    expect(isVisible()).toBe('true');
  });

  it('megkísérelt beküldés után érintetlen mezőn is látható', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <Probe error="Kötelező mező" />
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    expect(isVisible()).toBe('true');
  });

  it('megkísérelt beküldés után is rejtve marad, ha nincs hiba', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <Probe />
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    expect(isVisible()).toBe('false');
  });
});
