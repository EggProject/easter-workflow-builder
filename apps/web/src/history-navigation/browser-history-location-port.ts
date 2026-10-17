import type { HistoryLocationPort } from './history-location-port.ts';

/**
 * A `HistoryLocationPort` böngésző oldali megvalósítása, egyetlen fájlban,
 * a `globalThis.history` és a `globalThis.location` objektumra kötve
 * (SPEC-007 7.2). A `pushState` első argumentuma (`state`) `null`: az
 * alkalmazás nem tárol saját állapotot a history bejegyzésben, a második
 * (`unused`) paraméter történeti okból kötelező, az üres sztring megadása
 * biztonságos a metódus jövőbeli változásaival szemben
 * (<https://developer.mozilla.org/en-US/docs/Web/API/History/pushState>).
 */
export const browserHistoryLocationPort: HistoryLocationPort = {
  pathname: () => globalThis.location.pathname,
  search: () => globalThis.location.search,
  pushState: (path) => {
    // eslint-disable-next-line unicorn/no-null -- a `state` paraméter kötelező, az alkalmazás nem tárol állapotot, és a `null` a `history.state` kezdőértéke (https://html.spec.whatwg.org/multipage/nav-history-apis.html#the-history-interface).
    globalThis.history.pushState(null, '', path);
  },
  addPopStateListener: (listener) => {
    globalThis.addEventListener('popstate', listener);
    return () => {
      globalThis.removeEventListener('popstate', listener);
    };
  },
};
