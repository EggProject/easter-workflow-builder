import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HistoryLocationPort } from './history-location-port.ts';
import { useClientRoute, type UseClientRouteResult } from './use-client-route.ts';

interface FakePort extends HistoryLocationPort {
  readonly emitPopState: () => void;
  readonly setSearchForTest: (nextSearch: string) => void;
}

function createFakePort(initialPathname: string, initialSearch = ''): FakePort {
  let pathname = initialPathname;
  let search = initialSearch;
  const listeners = new Set<() => void>();
  return {
    pathname: () => pathname,
    search: () => search,
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
    setSearchForTest: (nextSearch) => {
      search = nextSearch;
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

  it('a kezdeti search-öt adja, és navigate után üresre vált', () => {
    const port = createFakePort('/runs', '?workflowId=workflow-1');
    act(() => {
      root.render(<HookHarness port={port} />);
    });
    expect(latest?.search).toBe('?workflowId=workflow-1');

    act(() => {
      latest?.navigate('workflowList');
    });

    expect(latest?.search).toBe('');
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

  it('popstate eseményre a search is a location.search alapján újraszámol', () => {
    const port = createFakePort('/runs');
    act(() => {
      root.render(<HookHarness port={port} />);
    });
    expect(latest?.search).toBe('');

    act(() => {
      port.setSearchForTest('?workflowId=workflow-2');
      port.emitPopState();
    });

    expect(latest?.search).toBe('?workflowId=workflow-2');
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
