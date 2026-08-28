/**
 * Egy hatókör keret a **statikus**, futás indítás előtti alakban. A futáskori
 * `BranchScope` bejegyzés `stepRunId` mezője helyén itt a hatókört nyitó gráf
 * csomópont azonosítója áll, mert a validáció idején még nincs `step_run` sor
 * (SPEC-004 4.8: "Az 1 ... 5. lépés egyetlen adatot sem ír").
 *
 * A keret ezért nem hordoz `itemIndex` és `iteration` értéket sem: a statikus
 * bejárás azt vizsgálja, **melyik** hatókör van nyitva egy node-nál, nem azt,
 * hányadik elemben vagy iterációban.
 */
export type StaticScopeFrame =
  | { readonly kind: 'fan_out'; readonly originNodeId: string }
  | { readonly kind: 'loop'; readonly originNodeId: string };

/**
 * A statikus hatókör verem a gyökértől befelé, a futáskori `BranchContext`
 * párja. A gyökér kontextus itt is az üres verem (SPEC-004 4.3).
 */
export type StaticScopeStack = readonly StaticScopeFrame[];
