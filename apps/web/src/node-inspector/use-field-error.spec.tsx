import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FieldErrorsContext } from './field-errors-context.ts';
import { useFieldError } from './use-field-error.ts';

function ErrorProbe(properties: Readonly<{ path: string }>): ReactElement {
  const message = useFieldError(properties.path);
  return <span data-testid="proba">{message ?? 'nincs hiba'}</span>;
}

describe('useFieldError', () => {
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

  it('szolgáltató nélkül undefined értéket ad, tehát a mező hibaüzenet nélkül renderelődik', () => {
    act(() => {
      root.render(<ErrorProbe path="promptTemplate" />);
    });
    expect(container.textContent).toBe('nincs hiba');
  });

  it('a szolgáltatott térképből az útvonalhoz tartozó üzenetet adja vissza', () => {
    act(() => {
      root.render(
        <FieldErrorsContext.Provider value={new Map([['promptTemplate', 'kötelező mező']])}>
          <ErrorProbe path="promptTemplate" />
        </FieldErrorsContext.Provider>,
      );
    });
    expect(container.textContent).toBe('kötelező mező');
  });

  it('a mező alatti útvonal hibáját is felszedi (soronkénti lista mező)', () => {
    act(() => {
      root.render(
        <FieldErrorsContext.Provider value={new Map([['backoffMs.1', 'Invalid input']])}>
          <ErrorProbe path="backoffMs" />
        </FieldErrorsContext.Provider>,
      );
    });
    expect(container.textContent).toBe('Invalid input');
  });

  it('ismeretlen útvonalra undefined értéket ad, akkor is, ha a térképben van másik hiba', () => {
    act(() => {
      root.render(
        <FieldErrorsContext.Provider value={new Map([['promptTemplate', 'kötelező mező']])}>
          <ErrorProbe path="modelId" />
        </FieldErrorsContext.Provider>,
      );
    });
    expect(container.textContent).toBe('nincs hiba');
  });
});
