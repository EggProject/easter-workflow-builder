/**
 * A `script` node és a `join` node `script` módjának közös beállítása
 * (SPEC-003 4.3). A `runtime` egyetlen értéke az `expression`; a séma
 * felkészül a típusra, de a futás indítása elutasítja, mert a `script`
 * végrehajtás később implementálandó.
 */
export interface ScriptConfig {
  readonly source: string;
  readonly runtime: 'expression';
}
