import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RunViewHeaderSkeleton } from './RunViewHeaderSkeleton.tsx';

describe('RunViewHeaderSkeleton', () => {
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

  it('a fejléc osztályát viseli, és három csontvázat rajzol várakozás jelzéssel', () => {
    act(() => {
      root.render(<RunViewHeaderSkeleton />);
    });

    expect(container.querySelector('header.run-view-screen__header[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll('.skel')).toHaveLength(3);
    expect(container.querySelector('.skel--btn')).not.toBeNull();
  });
});
