import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GRAPH_NODE_CARD_HEIGHT, GRAPH_NODE_CARD_WIDTH } from '../graph-node-catalog/graph-node-catalog.ts';
import { GraphNodeCardSizeStyle } from './GraphNodeCardSizeStyle.tsx';

describe('GraphNodeCardSizeStyle', () => {
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

  it('a katalógus mért konstansaiból írja a két custom propertyt, második szám nélkül', () => {
    act(() => {
      root.render(<GraphNodeCardSizeStyle />);
    });

    const styleElement = container.querySelector('style');
    expect(styleElement?.textContent).toBe(
      `:root { --graph-node-card-width: ${String(GRAPH_NODE_CARD_WIDTH)}px; --graph-node-card-height: ${String(GRAPH_NODE_CARD_HEIGHT)}px; }`,
    );
  });
});
