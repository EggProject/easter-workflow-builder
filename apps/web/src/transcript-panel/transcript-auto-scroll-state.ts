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
  /**
   * Van-e kinyitott vagy becsukott sor, aminek az új magasságát a lista még
   * nem mérte meg. Amíg igaz, a jelentések a mérés előtti elrendezést írják
   * le, ezért nem kapcsolhatják vissza a követést.
   */
  readonly isToggleUnmeasured: boolean;
}

/**
 * Az öt esemény, ami az állapotot mozgatja.
 *
 * - `rows_rendered`: a `react-window` `onRowsRendered` jelentése, a jelentés
 *   pillanatában érvényes sorszámmal.
 * - `rows_arrived`: a sorszám megváltozott, és a panel levonta a hatását:
 *   `isFollowed`, ha az érkezést követte (az aljára görgetett, vagy a lista
 *   még nincs csatolva, és a csatoláskor fog), különben a sorok a nem
 *   látottak közé kerülnek.
 * - `jump_requested`: a felhasználó megnyomta az "ugrás az aljára" gombot.
 * - `row_toggle_started`: a felhasználó kinyitott vagy becsukott egy sort,
 *   és a lista a sor új magasságát még nem mérte meg.
 * - `row_toggle_settled`: a kinyitás vagy becsukás lezárult: a lista megmérte
 *   a sort és jelentett, vagy a sor a mérés előtt visszaállt (egy képkockán
 *   belüli ki-be csukás).
 */
export type TranscriptAutoScrollAction =
  | { readonly type: 'rows_rendered'; readonly stopIndex: number; readonly rowCount: number }
  | { readonly type: 'rows_arrived'; readonly rowCount: number; readonly isFollowed: boolean }
  | { readonly type: 'jump_requested' }
  | { readonly type: 'row_toggle_started' }
  | { readonly type: 'row_toggle_settled' };
