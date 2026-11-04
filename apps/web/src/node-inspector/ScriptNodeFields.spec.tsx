/* eslint-disable unicorn/no-null -- a `ScriptNodeConfig.onUnhandledError` a dróton ténylegesen `null` értéket hordoz (SPEC-005). */
import type { ScriptNodeConfig } from '@easter-workflow-builder/protocol';
import { FieldErrorVisibilityContext } from '@easter-workflow-builder/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScriptNodeFields } from './ScriptNodeFields.tsx';
import { FieldErrorsContext } from './field-errors-context.ts';

function typeInto(textarea: HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  descriptor?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
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

const CONFIG: ScriptNodeConfig = {
  type: 'script',
  source: 'return 1;',
  runtime: 'expression',
  onUnhandledError: 'fail_run',
};

describe('ScriptNodeFields', () => {
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

  it('nincs figyelmeztetés, a forrás szerkeszthető, a `type` és az `onUnhandledError` megmarad', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<ScriptNodeFields config={CONFIG} onChange={onChange} />);
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a forrás textarea-t');
    }
    act(() => {
      typeInto(textarea, 'return 2;');
    });
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'script',
      source: 'return 2;',
      runtime: 'expression',
      onUnhandledError: 'fail_run',
    });
  });

  it('a runtime váltása a node-ra teljes alakot ad: `type` és `onUnhandledError` a JavaScript ág mezői mellett', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<ScriptNodeFields config={CONFIG} onChange={onChange} />);
    });
    const trigger = container.querySelector<HTMLButtonElement>('button.select');
    if (trigger === null) {
      throw new Error('a teszt nem találta a runtime select triggert');
    }
    clickOn(trigger);
    const option = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (candidate) => candidate.querySelector('.menu__text')?.textContent === 'JavaScript',
    );
    if (option === undefined) {
      throw new Error('a teszt nem találta a JavaScript opciót');
    }
    clickOn(option);
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'script',
      source: 'return 1;',
      runtime: 'javascript',
      timeoutMs: null,
      cwd: null,
      memoryLimitMb: null,
      onUnhandledError: 'fail_run',
    });
  });

  it('a `source` mezőnkénti hibája megjelenik a mező alatt, aria kötéssel', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <FieldErrorsContext.Provider value={new Map([['source', 'Kötelező']])}>
            <ScriptNodeFields config={CONFIG} onChange={vi.fn()} />
          </FieldErrorsContext.Provider>
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a forrás textarea-t');
    }
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    const errorElement = container.querySelector('.field__error');
    expect(errorElement?.id).toBe(textarea.getAttribute('aria-describedby'));
    expect(errorElement?.textContent).toBe('Kötelező');
  });
});
