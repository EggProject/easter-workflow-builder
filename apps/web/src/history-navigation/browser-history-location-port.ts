import type { HistoryLocationPort } from './history-location-port.ts';

/**
 * A `HistoryLocationPort` böngésző oldali megvalósítása, egyetlen fájlban,
 * a `globalThis.history` és a `globalThis.location` objektumra kötve
 * (SPEC-007 7.2). A `pushState` első argumentuma (`state`) `null`: az
 * alkalmazás nem tárol saját állapotot a history bejegyzésben, a második
 * (`title`) üres sztring, mert a böngészők ma nem használják
 * (dokumentált MDN megjegyzés).
 */
export const browserHistoryLocationPort: HistoryLocationPort = {
  pathname: () => globalThis.location.pathname,
  pushState: (path) => {
    // eslint-disable-next-line unicorn/no-null -- a DOM `History#pushState` `state` paramétere kötelező, az alkalmazás nem tárol saját állapotot, a szerializálhatatlan `undefined` helyett `null`-t ír elő a specifikáció.
    globalThis.history.pushState(null, '', path);
  },
  addPopStateListener: (listener) => {
    globalThis.addEventListener('popstate', listener);
    return () => {
      globalThis.removeEventListener('popstate', listener);
    };
  },
};
