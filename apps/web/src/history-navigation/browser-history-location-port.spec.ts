import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserHistoryLocationPort } from './browser-history-location-port.ts';

describe('browserHistoryLocationPort', () => {
  afterEach(() => {
    // eslint-disable-next-line unicorn/no-null -- a DOM `History#pushState` `state` paramétere kötelező, a teszt nem tárol saját állapotot.
    globalThis.history.pushState(null, '', '/');
  });

  it('a pathname a globalThis.location.pathname értékét adja', () => {
    // eslint-disable-next-line unicorn/no-null -- lásd fent.
    globalThis.history.pushState(null, '', '/runs');
    expect(browserHistoryLocationPort.pathname()).toBe('/runs');
  });

  it('a search a globalThis.location.search értékét adja', () => {
    // eslint-disable-next-line unicorn/no-null -- lásd fent.
    globalThis.history.pushState(null, '', '/runs?workflowId=workflow-1');
    expect(browserHistoryLocationPort.search()).toBe('?workflowId=workflow-1');
  });

  it('a pushState új bejegyzést ír a böngésző előzményekbe', () => {
    browserHistoryLocationPort.pushState('/runs');
    expect(globalThis.location.pathname).toBe('/runs');
  });

  it('az addPopStateListener feliratkozik a popstate eseményre', () => {
    const listener = vi.fn();
    browserHistoryLocationPort.addPopStateListener(listener);

    globalThis.dispatchEvent(new PopStateEvent('popstate'));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('a visszaadott leiratkozó függvény eltávolítja a figyelőt', () => {
    const listener = vi.fn();
    const unsubscribe = browserHistoryLocationPort.addPopStateListener(listener);

    unsubscribe();
    globalThis.dispatchEvent(new PopStateEvent('popstate'));

    expect(listener).not.toHaveBeenCalled();
  });
});
