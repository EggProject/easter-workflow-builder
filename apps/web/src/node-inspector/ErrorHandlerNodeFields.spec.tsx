/* eslint-disable unicorn/no-null -- a `ErrorHandlerNodeConfig.onUnhandledError` a dróton ténylegesen `null` értéket hordoz (SPEC-005). */
import type { ErrorHandlerNodeConfig } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorHandlerNodeFields } from './ErrorHandlerNodeFields.tsx';

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
});
