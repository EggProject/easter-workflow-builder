import type { ClientRouteId } from '../client-route/client-route-table.ts';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NotFoundRoute } from './not-found-route.tsx';

function noop(): void {
  // a teszt nem figyeli a navigációt ebben az esetben
}

describe('NotFoundRoute', () => {
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

  it('megnevezi a hibát egy Card komponensben', () => {
    act(() => {
      root.render(<NotFoundRoute navigate={noop} />);
    });

    expect(container.textContent).toContain('Az oldal nem található');
  });

  it('a "Vissza a workflow listára" gomb a workflowList útvonalra navigál', () => {
    let navigatedTo: ClientRouteId | undefined;

    act(() => {
      root.render(
        <NotFoundRoute
          navigate={(routeId) => {
            navigatedTo = routeId;
          }}
        />,
      );
    });

    const button = container.querySelector('button');
    if (button === null) {
      throw new Error('a teszt nem talált gombot');
    }
    act(() => {
      button.click();
    });

    expect(navigatedTo).toBe('workflowList');
  });
});
