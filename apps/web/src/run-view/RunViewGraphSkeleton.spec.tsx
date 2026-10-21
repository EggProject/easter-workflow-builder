import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RunViewGraphSkeleton } from './RunViewGraphSkeleton.tsx';

describe('RunViewGraphSkeleton', () => {
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

  it('a panel teljes területét kitöltő egyetlen blokk csontvázat rajzol, várakozás jelzéssel', () => {
    act(() => {
      root.render(<RunViewGraphSkeleton />);
    });

    expect(container.querySelector('.run-view-screen__graph-loading[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll('.skel')).toHaveLength(1);
    expect(container.querySelector('.skel')?.className).toBe('skel');
  });
});
