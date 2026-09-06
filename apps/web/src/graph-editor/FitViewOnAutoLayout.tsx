import { useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';

export interface FitViewOnAutoLayoutProperties {
  /**
   * Az automatikus elrendezések számlálója (`graph-editor-screen`
   * `autoLayoutRevision`): minden "Elrendezés" kattintás növeli eggyel. A
   * komponens ennek a MEGVÁLTOZÁSÁRA illeszti újra a nézetet.
   */
  readonly revision: number;
}

/**
 * A vászon nézetét a teljes gráfra illeszti, valahányszor az automatikus
 * elrendezés lefutott (SPEC-008 5.7).
 *
 * **A mért hiba, ami ezt indokolja (2026-09-06).** A `<ReactFlow fitView>`
 * prop dokumentált jelentése kizárólag a KEZDETI nézetre szól ("the flow will
 * be zoomed and panned to fit all the nodes initially provided"), ezért az
 * "Elrendezés" gomb után a vászon a betöltéskori nagyításon és eltolásán
 * maradt: az új elrendezés a vászon egy sarkába csúszott, nagy üres területet
 * hagyva maga körül (saját mérés: a nagyítás a kattintás előtt és után is
 * pontosan ugyanaz a szám volt).
 *
 * **Miért önálló komponens, a `<ReactFlow>` gyerekeként.** A `useReactFlow()`
 * hook a React Flow saját context providerét igényli, azt viszont maga a
 * `<ReactFlow>` építi fel a saját fáján belül - a `GraphEditorCanvas`, ami
 * rendereli, még kívül van rajta. A gyerekek viszont már a provider alatt
 * állnak, tehát ez az egyetlen hely, ahonnan a hook hívható extra
 * `<ReactFlowProvider>` beszúrása nélkül.
 *
 * **A hatás függősége szándékosan csak a `revision`.** A `useReactFlow()`
 * által adott objektum azonossága a nézet állapotától függ, a `fitView()`
 * hívás pedig épp a nézetet írja át - a `fitView` függőségre kötése így egy
 * önmagát tápláló hurkot kockáztatna. A kiváltó ok maga a számláló.
 */
export function FitViewOnAutoLayout(properties: Readonly<FitViewOnAutoLayoutProperties>): undefined {
  const { revision } = properties;
  const { fitView } = useReactFlow();

  useEffect(() => {
    void fitView();
    // A `react-hooks/exhaustive-deps` szabály nincs bekötve a projekt ESLint
    // konfigurációjába; a `fitView` kihagyása a fenti, szándékos döntés.
  }, [revision]);

  // Nem rajzol semmit. A visszatérési típus `undefined`, nem `null`: a projekt
  // `unicorn/no-null` szabálya tiltja a `null` literált, a React 19 pedig
  // dokumentáltan elfogadja az `undefined` visszatérést egy komponenstől. Az
  // explicit `return undefined;` sort az `unicorn/no-useless-undefined` tiltja,
  // ezért a függvény a végén egyszerűen kifut.
}
