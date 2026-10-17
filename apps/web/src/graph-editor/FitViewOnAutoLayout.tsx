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
 * **A mért hiba, ami ezt indokolja.** A `<ReactFlow fitView>` prop
 * dokumentált jelentése kizárólag a KEZDETI nézetre szól ("the flow will be
 * zoomed and panned to fit all the nodes initially provided"), ezért az
 * "Elrendezés" gomb után a vászon a betöltéskori nagyításon és eltolásán
 * maradt (saját mérés:
 * `docs/research/2026-09-05-grafszerkeszto-es-transcript.md` 7.2 szekció).
 *
 * **Miért önálló komponens, a `<ReactFlow>` gyerekeként.** A `useReactFlow()`
 * hook a React Flow context providere alatt hívható. A `GraphEditorScreen`
 * ma külső `ReactFlowProvider`-t ad, de a `<ReactFlow>` is felépít egyet, ha
 * nincs (`Wrapper`, `@xyflow/react` 12.11.6 `dist/esm/index.js` 3748-3757.
 * sor), és a `GraphEditorCanvas` külső provider nélkül is csatolható. A
 * gyerekként állás mindkét esetben a provider alatt tartja a hookot.
 *
 * **A hatás függősége szándékosan csak a `revision`.** A kiváltó ok maga a
 * számláló. A `fitView` hivatkozás a telepített `@xyflow/react` 12.11.6-ban
 * stabil (a `useReactFlow()` a segédfüggvényeit `[]` függőségű `useMemo`-ban
 * építi, a visszaadott objektum csak a `viewportInitialized` értékre
 * frissül, `dist/esm/index.js` 1052-1236. sor), ezért a kihagyása nem nyel el
 * hívást.
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
