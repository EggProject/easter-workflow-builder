/* eslint-disable unicorn/no-null -- a `LoopNodeConfig.onUnhandledError` a dróton ténylegesen `null` értéket hordoz (SPEC-005). */
import type { LoopNodeConfig } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoopNodeFields } from './LoopNodeFields.tsx';
import { FieldErrorsContext } from './field-errors-context.ts';

type OnChange = (nextConfig: LoopNodeConfig) => void;

function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

const CONFIG: LoopNodeConfig = { type: 'loop', maxIterations: 5, continueExpression: 'i < 5', onUnhandledError: null };

describe('LoopNodeFields', () => {
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

  it('a max. iterációk száma és a folytatás feltétel szerkeszthető', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<LoopNodeFields config={CONFIG} onChange={onChange} />);
    });
    const maxIterationsInput = container.querySelector('input');
    if (maxIterationsInput === null) {
      throw new Error('a teszt nem találta a maxIterations mezőt');
    }
    act(() => {
      typeInto(maxIterationsInput, '10');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ maxIterations: 10 }));
    const continueTextarea = container.querySelector('textarea');
    if (continueTextarea === null) {
      throw new Error('a teszt nem találta a folytatás feltétel mezőt');
    }
    act(() => {
      typeInto(continueTextarea, 'i < 10');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ continueExpression: 'i < 10' }));
  });

  it('érvénytelen bevitelre a natív number input üresre vált, ez 0 értéket ad (mért viselkedés)', () => {
    const onChange = vi.fn<OnChange>();
    act(() => {
      root.render(<LoopNodeFields config={CONFIG} onChange={onChange} />);
    });
    const maxIterationsInput = container.querySelector('input');
    if (maxIterationsInput === null) {
      throw new Error('a teszt nem találta a maxIterations mezőt');
    }
    act(() => {
      typeInto(maxIterationsInput, 'nem szám');
    });
    const lastCall = onChange.mock.calls.at(-1);
    if (lastCall === undefined) {
      throw new Error('a teszt nem talált onChange hívást');
    }
    expect(lastCall[0].maxIterations).toBe(0);
  });

  it('a `maxIterations` mezőnkénti hibája megjelenik a mező alatt, aria kötéssel', () => {
    act(() => {
      root.render(
        <FieldErrorsContext.Provider value={new Map([['maxIterations', 'Kötelező']])}>
          <LoopNodeFields config={CONFIG} onChange={vi.fn()} />
        </FieldErrorsContext.Provider>,
      );
    });
    const maxIterationsInput = container.querySelector('input');
    if (maxIterationsInput === null) {
      throw new Error('a teszt nem találta a maxIterations mezőt');
    }
    expect(maxIterationsInput.getAttribute('aria-invalid')).toBe('true');
    const errorElement = container.querySelector('.field__error');
    expect(errorElement?.id).toBe(maxIterationsInput.getAttribute('aria-describedby'));
    expect(errorElement?.textContent).toBe('Kötelező');
  });
});
