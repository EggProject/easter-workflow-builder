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
   * Szünetelteti-e a követést egy sor váltása: egy becsukás, aminek az új
   * magasságát a lista még nem mérte meg, vagy egy kinyitás, amiből a
   * felhasználó még nem tért vissza az aljára, és az ugrás gombot sem nyomta
   * meg (user döntés 2026-09-25). Amíg igaz, egy jelentés nem kapcsolhatja
   * vissza a követést.
   */
  readonly isPausedByToggle: boolean;
}

/**
 * A hat esemény, ami az állapotot mozgatja.
 *
 * - `rows_rendered`: a `react-window` `onRowsRendered` jelentése, a jelentés
 *   pillanatában érvényes sorszámmal.
 * - `rows_arrived`: a sorszám megváltozott, és a panel levonta a hatását:
 *   `isFollowed`, ha az érkezést követte (az aljára görgetett, vagy a lista
 *   még nincs csatolva, és a csatoláskor fog), különben a sorok a nem
 *   látottak közé kerülnek.
 * - `jump_requested`: a felhasználó megnyomta az "ugrás az aljára" gombot.
 * - `row_toggle_started`: a felhasználó kinyitott vagy becsukott egy sort, és
 *   a követés szünetel.
 * - `row_toggle_settled`: a szünet az utolsó jelentés szerint zárul: a
 *   becsukott sorok mérése megjött, vagy minden váltás visszaállt (páros
 *   számú kattintás ugyanazon a fejlécen).
 * - `bottom_reached_while_paused`: a szünet alatt a lista előbb elhagyta az
 *   alját, majd egy jelentés szerint újra az utolsó sort mutatja (a
 *   felhasználó visszagörgetett az aljára).
 */
export type TranscriptAutoScrollAction =
  | { readonly type: 'rows_rendered'; readonly stopIndex: number; readonly rowCount: number }
  | { readonly type: 'rows_arrived'; readonly rowCount: number; readonly isFollowed: boolean }
  | { readonly type: 'jump_requested' }
  | { readonly type: 'row_toggle_started' }
  | { readonly type: 'row_toggle_settled' }
  | { readonly type: 'bottom_reached_while_paused' };
