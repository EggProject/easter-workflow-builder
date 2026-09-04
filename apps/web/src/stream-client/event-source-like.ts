/**
 * A böngésző `EventSource` API-jának szűkített felülete, amit a réteg
 * ténylegesen használ (SPEC-007 9.1): kapcsolat státusz, keret feliratkozás,
 * lezárás. A pinelt happy-dom nem implementálja az `EventSource` API-t
 * (M-24), ezért a réteg ezt a felületet befecskendezett gyáron kapja.
 */
export interface EventSourceLike {
  readonly readyState: number;
  readonly addEventListener: (type: string, listener: (event: MessageEvent) => void) => void;
  readonly close: () => void;
}

/**
 * Egy `streamId`-hez tartozó `EventSourceLike` példány gyártása (SPEC-007
 * 9.1). A böngésző oldali megvalósítás a `globalThis.EventSource`
 * konstruktort hívja, opció objektum nélkül (`withCredentials` marad az
 * alapértéken, `false`).
 */
export type EventSourceFactory = (url: string) => EventSourceLike;
