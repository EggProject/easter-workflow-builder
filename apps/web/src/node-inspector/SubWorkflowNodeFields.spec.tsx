/* eslint-disable unicorn/no-null -- a `SubWorkflowNodeConfig.onUnhandledError` a dróton ténylegesen `null` értéket hordoz (SPEC-005). */
import type { SubWorkflowNodeConfig } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubWorkflowNodeFields } from './SubWorkflowNodeFields.tsx';

function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

const CONFIG: SubWorkflowNodeConfig = {
  type: 'sub_workflow',
  targetWorkflowId: 'wf-1',
  inputMapping: { a: 'b' },
  onUnhandledError: null,
};

describe('SubWorkflowNodeFields', () => {
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

  it('mindkét mező szerkeszthető', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<SubWorkflowNodeFields config={CONFIG} onChange={onChange} />);
    });
    const targetInput = container.querySelector('input');
    if (targetInput === null) {
      throw new Error('a teszt nem találta a targetWorkflowId mezőt');
    }
    act(() => {
      typeInto(targetInput, 'wf-2');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ targetWorkflowId: 'wf-2' }));

    const mappingTextarea = container.querySelector('textarea');
    if (mappingTextarea === null) {
      throw new Error('a teszt nem találta az inputMapping mezőt');
    }
    act(() => {
      typeInto(mappingTextarea, 'c=d\ne=f');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ inputMapping: { c: 'd', e: 'f' } }));
  });
});
