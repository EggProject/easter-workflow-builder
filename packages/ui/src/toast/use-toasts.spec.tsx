import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToasts, type UseToastsResult } from './use-toasts.ts';

/**
 * A hook portja `ReturnType<typeof setTimeout>` típusú handle-t vár (Node
 * `Timeout` példány). A teszt szintetikus portja emiatt valódi, azonnal
 * törölt időzítőt kér a handle azonosságához (a callback ezért sosem fut le
 * ténylegesen), de a lejárás szimulálása a `pendingCallbacks` térkép dolga.
 */
function createOpaqueHandle(callback: () => void): ReturnType<typeof setTimeout> {
  const handle = globalThis.setTimeout(callback, 0);
  globalThis.clearTimeout(handle);
  return handle;
}

interface ProbeProperties {
  readonly onResult: (result: UseToastsResult) => void;
  readonly scheduleTimeout: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  readonly clearScheduledTimeout: (handle: ReturnType<typeof setTimeout>) => void;
}

function ToastsProbe({ onResult, scheduleTimeout, clearScheduledTimeout }: ProbeProperties): ReactElement {
  const result = useToasts({ scheduleTimeout, clearScheduledTimeout });
  onResult(result);
  return <span>{result.toasts.length}</span>;
}

describe('useToasts', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseToastsResult | undefined;
  let pendingCallbacks: Map<ReturnType<typeof setTimeout>, () => void>;
  let scheduleTimeout: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  let clearScheduledTimeout: (handle: ReturnType<typeof setTimeout>) => void;

  beforeEach(() => {
    latest = undefined;
    pendingCallbacks = new Map();
    // Befecskendezett, szintetikus időzítő port (SPEC-007 T-008-12): a teszt
    // saját maga dönti el, mikor "telik le" egy időzítő, valós várakozás nélkül.
    scheduleTimeout = (callback) => {
      const handle = createOpaqueHandle(callback);
      pendingCallbacks.set(handle, callback);
      return handle;
    };
    clearScheduledTimeout = (handle) => {
      pendingCallbacks.delete(handle);
    };

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

  function render(): void {
    act(() => {
      root.render(
        <ToastsProbe
          onResult={(result) => {
            latest = result;
          }}
          scheduleTimeout={scheduleTimeout}
          clearScheduledTimeout={clearScheduledTimeout}
        />,
      );
    });
  }

  function currentResult(): UseToastsResult {
    if (latest === undefined) {
      throw new Error('a hook meg nem renderelt eredmenyt');
    }
    return latest;
  }

  function elapseAllPendingTimeouts(): void {
    act(() => {
      for (const callback of pendingCallbacks.values()) {
        callback();
      }
    });
  }

  it('uresen indul', () => {
    render();
    expect(currentResult().toasts).toEqual([]);
  });

  it('push hozzaad egy toastot es visszaadja az azonositot', () => {
    render();
    let id = -1;
    act(() => {
      id = currentResult().push({ title: 'Mentve' });
    });
    expect(id).toBe(1);
    expect(currentResult().toasts).toHaveLength(1);
    expect(currentResult().toasts[0]?.title).toBe('Mentve');
  });

  it('minden push novekvo azonositot kap', () => {
    render();
    let firstId = -1;
    let secondId = -1;
    act(() => {
      firstId = currentResult().push({ title: 'Első' });
      secondId = currentResult().push({ title: 'Második' });
    });
    expect(firstId).toBe(1);
    expect(secondId).toBe(2);
    expect(currentResult().toasts).toHaveLength(2);
  });

  it('dismiss eltavolitja a megnevezett toastot', () => {
    render();
    let id = -1;
    act(() => {
      id = currentResult().push({ title: 'Mentve' });
    });
    act(() => {
      currentResult().dismiss(id);
    });
    expect(currentResult().toasts).toEqual([]);
  });

  it('duration nelkul nem utemez idozitot', () => {
    render();
    act(() => {
      currentResult().push({ title: 'Mentve' });
    });
    expect(pendingCallbacks.size).toBe(0);
  });

  it('duration=Infinity eseten sem utemez idozitot', () => {
    render();
    act(() => {
      currentResult().push({ title: 'Mentve', duration: Infinity });
    });
    expect(pendingCallbacks.size).toBe(0);
  });

  it('veges duration eseten utemez, es a lejaratkor automatikusan eltunteti a toastot', () => {
    render();
    act(() => {
      currentResult().push({ title: 'Mentve', duration: 3000 });
    });
    expect(pendingCallbacks.size).toBe(1);
    expect(currentResult().toasts).toHaveLength(1);

    elapseAllPendingTimeouts();

    expect(currentResult().toasts).toEqual([]);
  });

  it('a manualis dismiss torli az utemezett idozitot (nem fut le duplan)', () => {
    render();
    let id = -1;
    act(() => {
      id = currentResult().push({ title: 'Mentve', duration: 3000 });
    });
    expect(pendingCallbacks.size).toBe(1);

    act(() => {
      currentResult().dismiss(id);
    });
    expect(pendingCallbacks.size).toBe(0);
    expect(currentResult().toasts).toEqual([]);
  });

  it('opciók nélkül az alapértelmezett setTimeout/clearTimeout portot használja', () => {
    vi.useFakeTimers();
    try {
      let defaultResult: UseToastsResult | undefined;
      function DefaultPortProbe(): ReactElement {
        defaultResult = useToasts();
        return <span>{defaultResult.toasts.length}</span>;
      }

      const defaultContainer = document.createElement('div');
      document.body.append(defaultContainer);
      const defaultRoot = createRoot(defaultContainer);

      act(() => {
        defaultRoot.render(<DefaultPortProbe />);
      });
      act(() => {
        if (defaultResult === undefined) {
          throw new Error('a hook meg nem renderelt eredmenyt');
        }
        defaultResult.push({ title: 'Alap port', duration: 1000 });
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(defaultResult?.toasts).toEqual([]);

      act(() => {
        defaultRoot.unmount();
      });
      defaultContainer.remove();
    } finally {
      vi.useRealTimers();
    }
  });
});
