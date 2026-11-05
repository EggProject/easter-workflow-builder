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

/**
 * A jelölőnégyzet a felirata alapján (a `Checkbox` a szöveget `aria-labelledby`
 * kötéssel adja a vezérlőnek).
 */
function checkboxByLabel(label: string): HTMLInputElement {
  const checkbox = [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((candidate) => {
    const labelId = candidate.getAttribute('aria-labelledby') ?? '';
    return document.querySelector(`#${CSS.escape(labelId)}`)?.textContent === label;
  });
  if (checkbox === undefined) {
    throw new Error(`a teszt nem találta a(z) "${label}" jelölőnégyzetet`);
  }
  return checkbox;
}

const CONFIG: ErrorHandlerNodeConfig = {
  type: 'error_handler',
  maxAttempts: 3,
  backoffMs: [100, 200],
  handledErrorKinds: ['provider_call_failed'],
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

    const backoffTextarea = container.querySelector('textarea');
    if (backoffTextarea === null) {
      throw new Error('a teszt nem találta a backoffMs mezőt');
    }
    act(() => {
      typeInto(backoffTextarea, '100\n200\n300');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ backoffMs: [100, 200, 300] }));

    act(() => {
      checkboxByLabel('Egy sablon nem renderelhető.').click();
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ handledErrorKinds: ['provider_call_failed', 'template_render_failed'] }),
    );
  });

  it('gépelés közben a backoffMs lista mezőben az Enter megmarad, a configba a bontott lista kerül', () => {
    const latest = renderStatefulFields(root, { ...CONFIG, backoffMs: [], handledErrorKinds: [] });
    const backoffTextarea = container.querySelector('textarea');
    if (backoffTextarea === null) {
      throw new Error('a teszt nem találta a backoffMs mezőt');
    }

    for (const partial of ['100', '100\n', '100\n200']) {
      act(() => {
        typeInto(backoffTextarea, partial);
      });
      expect(backoffTextarea.value).toBe(partial);
    }
    expect(latest().backoffMs).toEqual([100, 200]);
  });

  it('a kezelt hibafajták zárt listája jelölőnégyzet csoportokban áll, szabad szöveg mező nélkül (SPEC-004 8.2, O-5)', () => {
    act(() => {
      root.render(<ErrorHandlerNodeFields config={CONFIG} onChange={vi.fn()} />);
    });

    expect(container.querySelectorAll('textarea')).toHaveLength(1);
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(24);
    const groupNames = [...container.querySelectorAll('[role="group"]')].map((group) => {
      const labelId = group.getAttribute('aria-labelledby') ?? '';
      return document.querySelector(`#${CSS.escape(labelId)}`)?.textContent;
    });
    expect(groupNames).toStrictEqual([
      'Kezelt hibafajták',
      'Agent lépés',
      'Sablon, kifejezés és kimenet',
      'Vezérlő csomópontok',
      'Al-workflow',
      'Szkript',
    ]);
    expect(
      checkboxByLabel('Az agent hívás nem indult el, vagy az üzenetfolyam eredmény nélkül megszakadt.').checked,
    ).toBe(true);
    expect(checkboxByLabel('Egy sablon nem renderelhető.').checked).toBe(false);
    expect(container.textContent).toContain('Csak a bejelölt hibafajtákat kezeli, a többit nem.');
  });

  it('a jelölés levétele kiveszi a fajtát, az üres lista mindent kezel, és ezt a mező alatti mondat kimondja', () => {
    const latest = renderStatefulFields(root, CONFIG);

    act(() => {
      checkboxByLabel('Az agent hívás nem indult el, vagy az üzenetfolyam eredmény nélkül megszakadt.').click();
    });

    expect(latest().handledErrorKinds).toStrictEqual([]);
    expect(container.textContent).toContain('Egyik sincs bejelölve, ezért a csomópont minden hibafajtát kezel.');

    act(() => {
      checkboxByLabel('A szkript túllépte az időkorlátját.').click();
    });
    act(() => {
      checkboxByLabel('Az Elágazás egyik ága sem illeszkedett.').click();
    });

    expect(latest().handledErrorKinds).toStrictEqual(['script_timed_out', 'branch_no_matching_edge']);
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
