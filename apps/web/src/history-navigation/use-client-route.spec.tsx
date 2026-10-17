import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryLocationPort } from './history-location-port.ts';
import { useClientRoute, type NavigationGuard, type UseClientRouteResult } from './use-client-route.ts';

interface FakePort extends HistoryLocationPort {
  readonly emitPopState: () => void;
  readonly setSearchForTest: (nextSearch: string) => void;
  /**
   * A böngésző vissza vagy előre lépésének mása: a cím a célra áll, és utána
   * fut a `popstate` (SPEC-008 M-115).
   */
  readonly traverseForTest: (nextPathname: string, nextSearch: string) => void;
  /**
   * A `pushState` hívások argumentuma, a hívás sorrendjében.
   */
  readonly pushedPaths: readonly string[];
}

function createFakePort(initialPathname: string, initialSearch = ''): FakePort {
  let pathname = initialPathname;
  let search = initialSearch;
  const listeners = new Set<() => void>();
  const pushedPaths: string[] = [];
  const emitPopState = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };
  return {
    pathname: () => pathname,
    search: () => search,
    pushState: (path) => {
      pushedPaths.push(path);
      pathname = path;
    },
    addPopStateListener: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emitPopState,
    setSearchForTest: (nextSearch) => {
      search = nextSearch;
    },
    traverseForTest: (nextPathname, nextSearch) => {
      pathname = nextPathname;
      search = nextSearch;
      emitPopState();
    },
    pushedPaths,
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

  it('navigate query paraméterrel a kérdőjeles alakot tolja be, és a routeId a puszta útvonalra illeszkedik', () => {
    const port = createFakePort('/');
    act(() => {
      root.render(<HookHarness port={port} />);
    });

    act(() => {
      latest?.navigate('runView', 'runId=r-1');
    });

    // A `pushState` a teljes URL-t kapja (a query stringgel együtt), az
    // útvonal illesztés viszont a puszta sablonra megy: a `CLIENT_ROUTE_TABLE`
    // bejegyzései paraméter nélküliek (SPEC-008 5. szekció bevezetője).
    expect(port.pathname()).toBe('/run?runId=r-1');
    expect(latest?.routeId).toBe('runView');
    expect(latest?.search).toBe('?runId=r-1');
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

  describe('a navigációs őr (SPEC-008 5.10, 1. pont)', () => {
    it('regisztrált őrnél a navigate nem navigál, hanem az őrnek adja a végrehajtást', () => {
      const port = createFakePort('/editor', '?workflowId=w-1');
      act(() => {
        root.render(<HookHarness port={port} />);
      });
      const guard = vi.fn<NavigationGuard>();
      act(() => {
        latest?.registerNavigationGuard(guard);
      });

      act(() => {
        latest?.navigate('runHistory');
      });

      expect(guard).toHaveBeenCalledTimes(1);
      expect(port.pathname()).toBe('/editor');
      expect(latest?.routeId).toBe('graphEditor');
      expect(latest?.search).toBe('?workflowId=w-1');
    });

    it('az őrnek adott végrehajtás az őr megkerülésével a célra navigál', () => {
      const port = createFakePort('/editor', '?workflowId=w-1');
      act(() => {
        root.render(<HookHarness port={port} />);
      });
      const proceeds: (() => void)[] = [];
      const guard = vi.fn<NavigationGuard>((proceed) => {
        proceeds.push(proceed);
      });
      act(() => {
        latest?.registerNavigationGuard(guard);
      });
      act(() => {
        latest?.navigate('runView', 'runId=r-1');
      });

      act(() => {
        proceeds[0]?.();
      });

      expect(guard).toHaveBeenCalledTimes(1);
      expect(port.pathname()).toBe('/run?runId=r-1');
      expect(latest?.routeId).toBe('runView');
      expect(latest?.search).toBe('?runId=r-1');
    });

    it('az eltávolított őr után a navigate a mai módon, azonnal navigál', () => {
      const port = createFakePort('/editor');
      act(() => {
        root.render(<HookHarness port={port} />);
      });
      const guard = vi.fn<NavigationGuard>();
      act(() => {
        const unregister = latest?.registerNavigationGuard(guard);
        unregister?.();
      });

      act(() => {
        latest?.navigate('runHistory');
      });

      expect(guard).not.toHaveBeenCalled();
      expect(port.pathname()).toBe('/runs');
      expect(latest?.routeId).toBe('runHistory');
    });

    it('az újabb regisztráció lecseréli a korábbit', () => {
      const port = createFakePort('/editor');
      act(() => {
        root.render(<HookHarness port={port} />);
      });
      const firstGuard = vi.fn<NavigationGuard>();
      const secondGuard = vi.fn<NavigationGuard>();
      act(() => {
        latest?.registerNavigationGuard(firstGuard);
        latest?.registerNavigationGuard(secondGuard);
      });

      act(() => {
        latest?.navigate('runHistory');
      });

      expect(firstGuard).not.toHaveBeenCalled();
      expect(secondGuard).toHaveBeenCalledTimes(1);
      expect(port.pathname()).toBe('/editor');
    });

    it('a registerNavigationGuard hivatkozása két render között azonos', () => {
      const port = createFakePort('/');
      act(() => {
        root.render(<HookHarness port={port} />);
      });
      const first = latest?.registerNavigationGuard;

      act(() => {
        latest?.navigate('runHistory');
      });

      expect(latest?.registerNavigationGuard).toBe(first);
    });
  });

  /**
   * A szerkesztő a `?workflowId=w-1` címen, regisztrált őrrel; az őrnek
   * adott végrehajtások a hívás sorrendjében.
   */
  function renderGuardedEditor(): {
    readonly port: FakePort;
    readonly guard: ReturnType<typeof vi.fn<NavigationGuard>>;
    readonly proceeds: (() => void)[];
  } {
    const port = createFakePort('/editor', '?workflowId=w-1');
    act(() => {
      root.render(<HookHarness port={port} />);
    });
    const proceeds: (() => void)[] = [];
    const guard = vi.fn<NavigationGuard>((proceed) => {
      proceeds.push(proceed);
    });
    act(() => {
      latest?.registerNavigationGuard(guard);
    });
    return { port, guard, proceeds };
  }

  describe('a böngésző vissza és előre gombja (SPEC-008 5.10, 3. pont)', () => {
    it('regisztrált őrnél a popstate után a korábbi útvonal és query string íródik vissza, és a megjelenített útvonal nem vált', () => {
      const { port, guard } = renderGuardedEditor();

      act(() => {
        port.traverseForTest('/runs', '');
      });

      expect(port.pushedPaths).toEqual(['/editor?workflowId=w-1']);
      expect(guard).toHaveBeenCalledTimes(1);
      expect(latest?.routeId).toBe('graphEditor');
      expect(latest?.search).toBe('?workflowId=w-1');
    });

    it('az őrnek adott végrehajtás a popstate utáni címre navigál, az őr megkerülésével', () => {
      const { port, guard, proceeds } = renderGuardedEditor();
      act(() => {
        port.traverseForTest('/runs', '?workflowId=w-2');
      });

      act(() => {
        proceeds[0]?.();
      });

      expect(port.pushedPaths).toEqual(['/editor?workflowId=w-1', '/runs?workflowId=w-2']);
      expect(guard).toHaveBeenCalledTimes(1);
      expect(latest?.routeId).toBe('runHistory');
      expect(latest?.search).toBe('?workflowId=w-2');
    });

    it('egy újabb popstate a címet ugyanígy visszaírja, és az őr a legutóbbi célt kapja', () => {
      const { port, guard, proceeds } = renderGuardedEditor();
      act(() => {
        port.traverseForTest('/runs', '');
      });

      act(() => {
        port.traverseForTest('/', '');
      });

      expect(port.pushedPaths).toEqual(['/editor?workflowId=w-1', '/editor?workflowId=w-1']);
      expect(guard).toHaveBeenCalledTimes(2);
      act(() => {
        proceeds[1]?.();
      });
      expect(port.pushedPaths.at(-1)).toBe('/');
      expect(latest?.routeId).toBe('workflowList');
      expect(latest?.search).toBe('');
    });

    it('a visszaírt cím a legutóbbi navigáció utáni útvonal, nem a csatoláskori', () => {
      const port = createFakePort('/');
      act(() => {
        root.render(<HookHarness port={port} />);
      });
      act(() => {
        latest?.navigate('graphEditor', 'workflowId=w-3');
      });
      const guard = vi.fn<NavigationGuard>();
      act(() => {
        latest?.registerNavigationGuard(guard);
      });

      act(() => {
        port.traverseForTest('/', '');
      });

      expect(port.pushedPaths).toEqual(['/editor?workflowId=w-3', '/editor?workflowId=w-3']);
      expect(guard).toHaveBeenCalledTimes(1);
      expect(latest?.routeId).toBe('graphEditor');
      expect(latest?.search).toBe('?workflowId=w-3');
    });

    it('őr nélkül a popstate a mai módon vált, a cím visszaírása nélkül', () => {
      const port = createFakePort('/editor', '?workflowId=w-1');
      act(() => {
        root.render(<HookHarness port={port} />);
      });

      act(() => {
        port.traverseForTest('/runs', '?workflowId=w-2');
      });

      expect(port.pushedPaths).toEqual([]);
      expect(latest?.routeId).toBe('runHistory');
      expect(latest?.search).toBe('?workflowId=w-2');
    });

    it('az eltávolított őr után a popstate a mai módon vált', () => {
      const port = createFakePort('/editor', '?workflowId=w-1');
      act(() => {
        root.render(<HookHarness port={port} />);
      });
      const guard = vi.fn<NavigationGuard>();
      act(() => {
        const unregister = latest?.registerNavigationGuard(guard);
        unregister?.();
      });

      act(() => {
        port.traverseForTest('/runs', '');
      });

      expect(guard).not.toHaveBeenCalled();
      expect(port.pushedPaths).toEqual([]);
      expect(latest?.routeId).toBe('runHistory');
    });
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
