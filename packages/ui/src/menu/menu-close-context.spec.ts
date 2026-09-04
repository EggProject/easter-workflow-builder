import { act, createElement, useContext, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MenuCloseContext } from './menu-close-context.ts';

function ContextReader(properties: { readonly onRead: (close: () => void) => void }): ReactElement {
  const close = useContext(MenuCloseContext);
  properties.onRead(close);
  return createElement('div');
}

describe('MenuCloseContext', () => {
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

  it('provider nélkül az alapértéke egy hívható, no-op függvény', () => {
    let readClose: (() => void) | undefined;
    act(() => {
      root.render(
        createElement(ContextReader, {
          onRead: (close) => {
            readClose = close;
          },
        }),
      );
    });

    expect(typeof readClose).toBe('function');
    expect(() => {
      readClose?.();
    }).not.toThrow();
  });
});
