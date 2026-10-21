import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TranscriptPanelSkeleton } from './TranscriptPanelSkeleton.tsx';

describe('TranscriptPanelSkeleton', () => {
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

  it('a lista helyén négy soros csontvázat rajzol', () => {
    act(() => {
      root.render(<TranscriptPanelSkeleton />);
    });

    expect(container.querySelector('.transcript-panel__loading')).not.toBeNull();
    expect(container.querySelectorAll('.skel')).toHaveLength(4);
  });
});
