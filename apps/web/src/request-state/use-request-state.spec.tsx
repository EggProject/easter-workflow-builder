import type { Outcome } from '@easter-workflow-builder/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRequestState, type UseRequestStateResult } from './use-request-state.ts';

describe('useRequestState', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseRequestStateResult<string> | undefined;

  function HookHarness(): null {
    latest = useRequestState<string>();
    // eslint-disable-next-line unicorn/no-null -- React függvénykomponensnek `undefined` helyett `null`-t kell adnia, ha nem renderel semmit.
    return null;
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    latest = undefined;
    act(() => {
      root.render(<HookHarness />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('kezdetben idle állapotban van', () => {
    expect(latest?.state).toEqual({ status: 'idle' });
  });

  it('siker esetén pending-en át success állapotba kerül, az értékkel', async () => {
    const { promise: taskPromise, resolve: resolveTask } = Promise.withResolvers<Outcome<string>>();
    const task = (): Promise<Outcome<string>> => taskPromise;

    let runPromise: Promise<void> | undefined;
    act(() => {
      runPromise = latest?.run(task);
    });
    expect(latest?.state).toEqual({ status: 'pending' });

    await act(async () => {
      resolveTask({ kind: 'ok', value: 'rendben' });
      await runPromise;
    });

    expect(latest?.state).toEqual({ status: 'success', value: 'rendben' });
  });

  it('hiba esetén failure állapotba kerül, az üzenettel', async () => {
    await act(async () => {
      await latest?.run(() => Promise.resolve({ kind: 'error', message: 'nem sikerült' }));
    });
    expect(latest?.state).toEqual({ status: 'failure', message: 'nem sikerült' });
  });

  it('a reset visszaállítja idle állapotra', async () => {
    await act(async () => {
      await latest?.run(() => Promise.resolve({ kind: 'error', message: 'hiba' }));
    });
    act(() => {
      latest?.reset();
    });
    expect(latest?.state).toEqual({ status: 'idle' });
  });
});
