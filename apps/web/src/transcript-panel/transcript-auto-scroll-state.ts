/**
 * Az automatikus görgetés állapota (SPEC-008 7.4, T-009-25).
 */
export interface TranscriptAutoScrollState {
  /**
   * Követi-e a lista az alját: ha igen, egy új sor érkezésekor a panel az
   * utolsó sorra görget; ha nem, az új sorok száma gyűlik.
   */
  readonly isFollowing: boolean;
  /**
   * Az a sorszám, amire az érkezés hatását (görgetés vagy számlálás) a
   * panel már levonta.
   */
  readonly settledRowCount: number;
  /**
   * A felgörgetés óta érkezett, még nem látott sorok száma; ezt nevezi meg
   * az "ugrás az aljára" gomb.
   */
  readonly unseenCount: number;
  /**
   * Az utolsó jelentett `visibleRows.stopIndex`, `-1`, ha még nem volt
   * jelentés. Ebből látszik, hogy a látható tartomány FELFELÉ mozdult-e.
   */
  readonly lastStopIndex: number;
}

/**
 * A három esemény, ami az állapotot mozgatja.
 *
 * - `rows_rendered`: a `react-window` `onRowsRendered` jelentése, a jelentés
 *   pillanatában érvényes sorszámmal.
 * - `rows_arrived`: a sorszám megváltozott, és a panel levonta a hatását.
 * - `jump_requested`: a felhasználó megnyomta az "ugrás az aljára" gombot.
 */
export type TranscriptAutoScrollAction =
  | { readonly type: 'rows_rendered'; readonly stopIndex: number; readonly rowCount: number }
  | { readonly type: 'rows_arrived'; readonly rowCount: number }
  | { readonly type: 'jump_requested' };
