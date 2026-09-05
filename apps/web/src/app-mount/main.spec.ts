import { act } from 'react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  const originalFetch = globalThis.fetch;

  /**
   * Szó szerint ugyanaz a hálózati stub, amit a `mount-app.spec.tsx`
   * fejléce indokol, és ugyanabból az okból: a `main.tsx` importálása a
   * `mountApp`-ot hívja, ami a VALÓDI `browserFetchFunction` portot adja
   * tovább, tehát a globális `fetch`-et. Stub nélkül a
   * `WorkflowListScreen` effektje ténylegesen a hálózatot szólította meg
   * (`ENOTFOUND api.example.test`), és a késve, a fájl lefutása UTÁN
   * megérkező elutasítás React állapotfrissítést váltott ki már
   * leszerelt happy-dom környezetben. Ez a CI-ban `ReferenceError: window
   * is not defined` alakban bukott el (PR #11, run 33933773721), helyben
   * viszont zöld volt, mert itt a DNS hiba a teszten belül megérkezett -
   * a különbség kizárólag a DNS válaszidő, tehát a hiba nem
   * determinisztikus. A visszaállítás `afterAll`-ban van, nem
   * `afterEach`-ben: a `mountApp` a React gyökeret nem adja vissza, tehát
   * a teszt nem tudja leszerelni, és egy korábban visszaállított `fetch`
   * mellett a késve lefutó effekt megint a valódi hálózatra menne.
   */
  beforeEach(() => {
    Object.assign(globalThis, { fetch: () => Promise.resolve(Response.json([])) });
  });

  afterAll(() => {
    Object.assign(globalThis, { fetch: originalFetch });
  });

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
