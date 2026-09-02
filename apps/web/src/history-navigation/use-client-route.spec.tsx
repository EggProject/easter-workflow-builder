import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HistoryLocationPort } from './history-location-port.ts';
import { useClientRoute, type UseClientRouteResult } from './use-client-route.ts';

function createFakePort(initialPathname: string): HistoryLocationPort & { readonly emitPopState: () => void } {
  let pathname = initialPathname;
  const listeners = new Set<() => void>();
  return {
    pathname: () => pathname,
    pushState: (path) => {
      pathname = path;
    },
    addPopStateListener: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emitPopState: () => {
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

describe('useClientRoute', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseClientRouteResult | undefined;

  function HookHarness({ port }: { readonly port: HistoryLocationPort }): null {
    latest = useClientRoute(port);
    // eslint-disable-next-line unicorn/no-null -- React függvénykomponensnek `undefined` helyett `null`-t kell adnia, ha nem renderel semmit.
    return null;
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    latest = undefined;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('a kezdeti pathname-hez illeszkedő útvonal azonosítót adja', () => {
    act(() => {
      root.render(<HookHarness port={createFakePort('/runs')} />);
    });
    expect(latest?.routeId).toBe('runHistory');
  });

  it('ismeretlen kezdeti pathname esetén undefined-et ad', () => {
    act(() => {
      root.render(<HookHarness port={createFakePort('/nincs-ilyen')} />);
    });
    expect(latest?.routeId).toBeUndefined();
  });

  it('navigate hívásra pushState-et hív és azonnal frissíti az állapotot', () => {
    const port = createFakePort('/');
    act(() => {
      root.render(<HookHarness port={port} />);
    });
    expect(latest?.routeId).toBe('workflowList');

    act(() => {
      latest?.navigate('runHistory');
    });

    expect(port.pathname()).toBe('/runs');
    expect(latest?.routeId).toBe('runHistory');
  });

  it('popstate eseményre a location.pathname alapján újraszámol', () => {
    const port = createFakePort('/');
    act(() => {
      root.render(<HookHarness port={port} />);
    });

    act(() => {
      port.pushState('/runs');
      port.emitPopState();
    });

    expect(latest?.routeId).toBe('runHistory');
  });

  it('leszereléskor leiratkozik a popstate eseményről', () => {
    const localContainer = document.createElement('div');
    document.body.append(localContainer);
    const localRoot = createRoot(localContainer);
    const port = createFakePort('/');

    act(() => {
      localRoot.render(<HookHarness port={port} />);
    });
    act(() => {
      localRoot.unmount();
    });
    localContainer.remove();

    expect(() => {
      port.pushState('/runs');
      port.emitPopState();
    }).not.toThrow();
  });
});
