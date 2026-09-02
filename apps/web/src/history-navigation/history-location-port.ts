/**
 * A `history` és a `location` böngésző API befecskendezett portja (SPEC-007
 * 7.2, 9.1: ugyanaz az elv, mint a szerver oldali `clock` és nyelő port).
 * Így a navigáció unit tesztje determinisztikus, és nem függ attól, mit
 * implementál éppen a happy-dom.
 */
export interface HistoryLocationPort {
  /**
   * A jelenlegi útvonal (`location.pathname`).
   */
  readonly pathname: () => string;
  /**
   * Új bejegyzés a böngésző előzményekbe. A `pushState` NEM vált ki
   * `popstate` eseményt (SPEC-007 M-12), ezért a hívó felelőssége az
   * állapot frissítése.
   */
  readonly pushState: (path: string) => void;
  /**
   * Feliratkozás a böngésző vissza/előre navigációjára (`popstate`, M-13).
   * A visszaadott függvény leiratkozik.
   */
  readonly addPopStateListener: (listener: () => void) => () => void;
}
