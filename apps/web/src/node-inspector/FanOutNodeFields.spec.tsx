/* eslint-disable unicorn/no-null -- a `FanOutNodeConfig.onUnhandledError` a dróton ténylegesen `null` értéket hordoz (SPEC-005). */
import type { FanOutNodeConfig } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FanOutNodeFields } from './FanOutNodeFields.tsx';

function typeInto(textarea: HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  descriptor?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

const CONFIG: FanOutNodeConfig = {
  type: 'fan_out',
  itemsExpression: 'items',
  branchLabelTemplate: '{{item}}',
  onUnhandledError: null,
};

describe('FanOutNodeFields', () => {
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
      root.render(<FanOutNodeFields config={CONFIG} onChange={onChange} />);
    });
    const [itemsTextarea, branchLabelTextarea] = [...container.querySelectorAll('textarea')];
    if (itemsTextarea === undefined || branchLabelTextarea === undefined) {
      throw new Error('a teszt nem találta a mezőket');
    }
    act(() => {
      typeInto(itemsTextarea, 'other.items');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ itemsExpression: 'other.items' }));
    act(() => {
      typeInto(branchLabelTextarea, '{{index}}');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ branchLabelTemplate: '{{index}}' }));
  });
});
