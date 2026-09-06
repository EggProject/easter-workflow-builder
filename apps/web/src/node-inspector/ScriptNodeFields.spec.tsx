/* eslint-disable unicorn/no-null -- a `ScriptNodeConfig.onUnhandledError` a dróton ténylegesen `null` értéket hordoz (SPEC-005). */
import type { ScriptNodeConfig } from '@easter-workflow-builder/protocol';
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

const CONFIG: ScriptNodeConfig = { type: 'script', source: 'return 1;', runtime: 'expression', onUnhandledError: null };

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

  it('megjeleníti a figyelmeztetést és a futásidőt, a forrás szerkeszthető', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<ScriptNodeFields config={CONFIG} onChange={onChange} />);
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('unimplemented_node_type');
    expect(container.textContent).toContain('expression');
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a forrás textarea-t');
    }
    act(() => {
      typeInto(textarea, 'return 2;');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'return 2;' }));
  });

  it('a `source` mezőnkénti hibája megjelenik a mező alatt, aria kötéssel', () => {
    act(() => {
      root.render(
        <FieldErrorsContext.Provider value={new Map([['source', 'Kötelező']])}>
          <ScriptNodeFields config={CONFIG} onChange={vi.fn()} />
        </FieldErrorsContext.Provider>,
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
