/* eslint-disable unicorn/no-null -- a `HumanApprovalNodeConfig` nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005). */
import type { HumanApprovalNodeConfig } from '@easter-workflow-builder/protocol';
import { FieldErrorVisibilityContext } from '@easter-workflow-builder/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HumanApprovalNodeFields } from './HumanApprovalNodeFields.tsx';
import { FieldErrorsContext } from './field-errors-context.ts';

function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

const CONFIG: HumanApprovalNodeConfig = {
  type: 'human_approval',
  title: 'Jóváhagyás kérése',
  bodyTemplate: 'Kérlek hagyd jóvá',
  timeoutMs: 60_000,
  onUnhandledError: null,
};

describe('HumanApprovalNodeFields', () => {
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

  it('mindhárom mező szerkeszthető, az időkorlát üresre nullázható', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<HumanApprovalNodeFields config={CONFIG} onChange={onChange} />);
    });
    const titleInput = container.querySelector('input');
    if (titleInput === null) {
      throw new Error('a teszt nem találta a cím mezőt');
    }
    act(() => {
      typeInto(titleInput, 'Új cím');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Új cím' }));

    const bodyTextarea = container.querySelector('textarea');
    if (bodyTextarea === null) {
      throw new Error('a teszt nem találta a törzs mezőt');
    }
    act(() => {
      typeInto(bodyTextarea, 'Új törzs');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ bodyTemplate: 'Új törzs' }));

    const timeoutInput = container.querySelector<HTMLInputElement>('input[type="number"]');
    if (timeoutInput === null) {
      throw new Error('a teszt nem találta az időkorlát mezőt');
    }
    act(() => {
      typeInto(timeoutInput, '');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ timeoutMs: null }));
  });

  it('a `title` mezőnkénti hibája megjelenik a mező alatt, aria kötéssel', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <FieldErrorsContext.Provider value={new Map([['title', 'Kötelező']])}>
            <HumanApprovalNodeFields config={CONFIG} onChange={vi.fn()} />
          </FieldErrorsContext.Provider>
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    const titleInput = container.querySelector('input');
    if (titleInput === null) {
      throw new Error('a teszt nem találta a cím mezőt');
    }
    expect(titleInput.getAttribute('aria-invalid')).toBe('true');
    const errorElement = container.querySelector('.field__error');
    expect(errorElement?.id).toBe(titleInput.getAttribute('aria-describedby'));
    expect(errorElement?.textContent).toBe('Kötelező');
  });
});
