/**
 * Egy **futáskori** hatókör bejegyzés, szó szerint a SPEC-004 4.3 szekció
 * alakjában. Ugyanaz a node sokszor futhat: fan-out ágban ágonként, ciklusban
 * iterációnként (SPEC-003 4.10), és a példányokat ez a verem különbözteti meg.
 * A `fan_out` node minden elemhez egy `fan_out` bejegyzést tol a veremre, a
 * `loop` node minden iterációhoz egy `loop` bejegyzést; a `join` az innermost
 * `fan_out` bejegyzést veszi le, a `loop` a sajátját kilépéskor.
 *
 * A `stepRunId` a bejegyzést nyitó lépés futásának azonosítója, tehát a
 * `step_run.parent_step_run_id` oszlop értéke a verem tetején álló bejegyzésből
 * jön (SPEC-004 4.3 táblázat).
 *
 * **Miért van két alak.** Ez a típus csak futásidőben tölthető ki, mert a
 * `stepRunId` egy létező `step_run` sort nevez meg. A gráf validáció viszont a
 * futás indítása **előtt** fut, amikor még egyetlen `step_run` sor sem
 * létezik, ezért ott a `StaticScopeStack` statikus alakja áll, ami a
 * `stepRunId` helyén a hatókört nyitó gráf csomópont azonosítóját hordozza. A
 * két alak ugyanazt a vermet írja le, más életciklusban.
 *
 * **Ebben a lépésben (T-005-11) ez a típus csak deklarálva van**: a tényleges
 * futásidejű feltöltés a `run-context` és a `scheduling` téma dolga
 * (PLAN-005 T-005-16, T-005-17).
 */
export type BranchScope =
  | { readonly kind: 'fan_out'; readonly stepRunId: string; readonly itemIndex: number }
  | { readonly kind: 'loop'; readonly stepRunId: string; readonly iteration: number };

/**
 * A futáskori ág kontextus: a hatókör bejegyzések verme a gyökértől befelé
 * (SPEC-004 4.3). A gyökér kontextus az üres verem, és egy node példány
 * azonosítója a `(nodeId, branchContext)` pár.
 */
export type BranchContext = readonly BranchScope[];
