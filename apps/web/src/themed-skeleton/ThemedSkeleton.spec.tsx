import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemedSkeleton } from './ThemedSkeleton.tsx';

describe('ThemedSkeleton', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    delete document.documentElement.dataset['theme'];
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    delete document.documentElement.dataset['theme'];
  });

  function renderedSkeleton(): HTMLElement {
    const element = container.querySelector<HTMLElement>('.skel');
    if (element === null) {
      throw new Error('a skeleton elem nem talalhato a kirajzolt fan');
    }
    return element;
  }

  it('vilagos temaban (data-theme hianyzik) nem adja hozza a "skel--ink" modositot', () => {
    act(() => {
      root.render(<ThemedSkeleton shape="text" />);
    });
    expect(renderedSkeleton().className).toBe('skel skel--text');
  });

  it('sotet temaban (data-theme="dark") hozzaadja a "skel--ink" modositot', () => {
    document.documentElement.dataset['theme'] = 'dark';
    act(() => {
      root.render(<ThemedSkeleton shape="text" />);
    });
    expect(renderedSkeleton().className).toBe('skel skel--text skel--ink');
  });

  it('a shape es lines prop tovabbadodik a burkolt Skeleton komponensnek', () => {
    act(() => {
      root.render(<ThemedSkeleton shape="text" lines={2} />);
    });
    const rows = container.querySelectorAll(':scope .skel-stack .skel--text');
    expect(rows).toHaveLength(2);
  });
});
