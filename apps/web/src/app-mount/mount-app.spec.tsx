import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountApp } from './mount-app.tsx';

class FakeEventSource {
  readyState = 0;

  addEventListener(): void {
    // a teszt nem iratkozik fel keretre
  }

  close(): void {
    // a teszt nem zár kapcsolatot
  }
}

describe('mountApp', () => {
  // eslint-disable-next-line unicorn/no-unnecessary-global-this -- a bare `EventSource` azonosító ReferenceError-t dobna, mert happy-dom-ban nem létező globális (M-24); a `globalThis.` biztonságos, sosem dobó tulajdonság-elérés.
  const originalEventSource = globalThis.EventSource;

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllEnvs();
    Object.assign(globalThis, { EventSource: originalEventSource });
  });

  it('hiányzó #root elemre hibát dob', () => {
    expect(() => {
      mountApp();
    }).toThrow('A #root elem hiányzik a dokumentumból.');
  });

  it('hiányzó kötelező konfigurációra a hibaüzenetet írja a #root szövegébe', () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);

    act(() => {
      mountApp();
    });

    expect(root.textContent).toContain('Hiányzó kötelező konfiguráció');
  });

  it('érvényes konfigurációval a WorkflowListScreen tartalmát rajzolja a #root alá', async () => {
    vi.stubEnv('VITE_API_ORIGIN', 'https://api.example.test');
    vi.stubEnv('VITE_LIST_LIMIT', '25');
    vi.stubEnv('VITE_STREAM_REPLAY_LIMIT', '50');
    Object.assign(globalThis, { EventSource: FakeEventSource });

    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);

    await act(async () => {
      mountApp();
      await Promise.resolve();
    });

    expect(root.textContent).toContain('Új workflow');
  });
});
