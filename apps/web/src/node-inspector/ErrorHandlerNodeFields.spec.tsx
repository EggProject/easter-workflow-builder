/* eslint-disable unicorn/no-null -- a `ErrorHandlerNodeConfig.onUnhandledError` a dróton ténylegesen `null` értéket hordoz (SPEC-005). */
import type { ErrorHandlerNodeConfig } from '@easter-workflow-builder/protocol';
import { FieldErrorVisibilityContext } from '@easter-workflow-builder/ui';
import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorHandlerNodeFields } from './ErrorHandlerNodeFields.tsx';
import { FieldErrorsContext } from './field-errors-context.ts';

function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

const CONFIG: ErrorHandlerNodeConfig = {
  type: 'error_handler',
  maxAttempts: 3,
  backoffMs: [100, 200],
  handledErrorKinds: ['timeout'],
  onUnhandledError: null,
};

/**
 * A mezők állapotot tartó gazdával: a visszaadott függvény a legutóbbi
 * `onChange` configot adja.
 */
function renderStatefulFields(root: Root, initial: ErrorHandlerNodeConfig): () => ErrorHandlerNodeConfig {
  let latest = initial;
  function Host(): ReactElement {
    const [config, setConfig] = useState(latest);
    return (
      <ErrorHandlerNodeFields
        config={config}
        onChange={(next) => {
          latest = next;
          setConfig(next);
        }}
      />
    );
  }
  act(() => {
    root.render(<Host />);
  });
  return () => latest;
}

describe('ErrorHandlerNodeFields', () => {
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

  it('mindhárom mező szerkeszthető', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<ErrorHandlerNodeFields config={CONFIG} onChange={onChange} />);
    });
    const maxAttemptsInput = container.querySelector('input');
    if (maxAttemptsInput === null) {
      throw new Error('a teszt nem találta a maxAttempts mezőt');
    }
    act(() => {
      typeInto(maxAttemptsInput, '5');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ maxAttempts: 5 }));

    const [backoffTextarea, handledKindsTextarea] = [...container.querySelectorAll('textarea')];
    if (backoffTextarea === undefined || handledKindsTextarea === undefined) {
      throw new Error('a teszt nem találta a lista mezőket');
    }
    act(() => {
      typeInto(backoffTextarea, '100\n200\n300');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ backoffMs: [100, 200, 300] }));

    act(() => {
      typeInto(handledKindsTextarea, 'timeout\nnetwork_error');
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ handledErrorKinds: ['timeout', 'network_error'] }),
    );
  });

  it('gépelés közben a két lista mezőben az Enter megmarad, a configba a bontott lista kerül', () => {
    const latest = renderStatefulFields(root, { ...CONFIG, backoffMs: [], handledErrorKinds: [] });
    const [backoffTextarea, handledKindsTextarea] = [...container.querySelectorAll('textarea')];
    if (backoffTextarea === undefined || handledKindsTextarea === undefined) {
      throw new Error('a teszt nem találta a lista mezőket');
    }

    for (const partial of ['100', '100\n', '100\n200']) {
      act(() => {
        typeInto(backoffTextarea, partial);
      });
      expect(backoffTextarea.value).toBe(partial);
    }
    for (const partial of ['timeout', 'timeout\n', 'timeout\nnetwork_error']) {
      act(() => {
        typeInto(handledKindsTextarea, partial);
      });
      expect(handledKindsTextarea.value).toBe(partial);
    }
    expect(latest().backoffMs).toEqual([100, 200]);
    expect(latest().handledErrorKinds).toEqual(['timeout', 'network_error']);
  });

  it('REGRESSZIÓ: a kiürített maxAttempts mező üres marad, és a config NaN értéket kap, nem 0-t', () => {
    const latest = renderStatefulFields(root, CONFIG);
    const maxAttemptsInput = container.querySelector('input');
    if (maxAttemptsInput === null) {
      throw new Error('a teszt nem találta a maxAttempts mezőt');
    }

    act(() => {
      typeInto(maxAttemptsInput, '');
    });

    expect(latest().maxAttempts).toBeNaN();
    expect(maxAttemptsInput.value).toBe('');
  });

  it('a `maxAttempts` mezőnkénti hibája megjelenik a mező alatt, aria kötéssel', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <FieldErrorsContext.Provider value={new Map([['maxAttempts', 'Kötelező']])}>
            <ErrorHandlerNodeFields config={CONFIG} onChange={vi.fn()} />
          </FieldErrorsContext.Provider>
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    const maxAttemptsInput = container.querySelector('input');
    if (maxAttemptsInput === null) {
      throw new Error('a teszt nem találta a maxAttempts mezőt');
    }
    expect(maxAttemptsInput.getAttribute('aria-invalid')).toBe('true');
    const errorElement = container.querySelector('.field__error');
    expect(errorElement?.id).toBe(maxAttemptsInput.getAttribute('aria-describedby'));
    expect(errorElement?.textContent).toBe('Kötelező');
  });
});
