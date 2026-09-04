import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

class FakeEventSource {
  readyState = 0;

  addEventListener(): void {
    // a teszt nem iratkozik fel keretre
  }

  close(): void {
    // a teszt nem zár kapcsolatot
  }
}

describe('main belépési pont', () => {
  // eslint-disable-next-line unicorn/no-unnecessary-global-this -- a bare `EventSource` azonosító ReferenceError-t dobna, mert happy-dom-ban nem létező globális (M-24); a `globalThis.` biztonságos, sosem dobó tulajdonság-elérés.
  const originalEventSource = globalThis.EventSource;

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllEnvs();
    Object.assign(globalThis, { EventSource: originalEventSource });
  });

  it('egyetlen hívást tesz a mountApp-ra: importáláskor felépíti a felületet a #root alá', async () => {
    vi.stubEnv('VITE_API_ORIGIN', 'https://api.example.test');
    vi.stubEnv('VITE_LIST_LIMIT', '25');
    vi.stubEnv('VITE_STREAM_REPLAY_LIMIT', '50');
    Object.assign(globalThis, { EventSource: FakeEventSource });

    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);

    await act(async () => {
      await import('./main.tsx');
    });

    expect(root.textContent).toContain('Új workflow');
  });
});
