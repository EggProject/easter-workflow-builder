import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ScopedFieldErrors } from './ScopedFieldErrors.tsx';
import { FieldErrorsContext } from './field-errors-context.ts';
import { useFieldError } from './use-field-error.ts';

function ErrorProbe(properties: Readonly<{ path: string }>): ReactElement {
  const message = useFieldError(properties.path);
  return <span>{message ?? 'nincs hiba'}</span>;
}

describe('ScopedFieldErrors', () => {
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

  it('a beágyazott mező a saját, előtag nélküli útvonalán találja meg a hibáját', () => {
    act(() => {
      root.render(
        <FieldErrorsContext.Provider value={new Map([['settings.promptTemplate', 'kötelező mező']])}>
          <ScopedFieldErrors prefix="settings">
            <ErrorProbe path="promptTemplate" />
          </ScopedFieldErrors>
        </FieldErrorsContext.Provider>,
      );
    });
    expect(container.textContent).toBe('kötelező mező');
  });

  it('az előtagon kívüli hiba nem szivárog be a szűkített hatókörbe', () => {
    act(() => {
      root.render(
        <FieldErrorsContext.Provider value={new Map([['promptTemplate', 'gyökér szintű hiba']])}>
          <ScopedFieldErrors prefix="settings">
            <ErrorProbe path="promptTemplate" />
          </ScopedFieldErrors>
        </FieldErrorsContext.Provider>,
      );
    });
    expect(container.textContent).toBe('nincs hiba');
  });

  it('szolgáltató nélkül is renderel, üres hatókörrel', () => {
    act(() => {
      root.render(
        <ScopedFieldErrors prefix="settings">
          <ErrorProbe path="promptTemplate" />
        </ScopedFieldErrors>,
      );
    });
    expect(container.textContent).toBe('nincs hiba');
  });
});
