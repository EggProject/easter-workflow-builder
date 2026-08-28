import type { BranchContext } from '../branch-scope/branch-scope.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { collectAncestorNodeIds } from './collect-ancestor-node-ids.ts';
import type { ExecutedStepInstance } from './executed-step-instance.ts';
import { findVisibleStepInstance } from './find-visible-step-instance.ts';
import type { RunContext } from './run-context.ts';
import type { StepInstanceReference } from './step-instance-reference.ts';

/**
 * A `buildRunContext` bemenete. A négy első mező a feloldáshoz kell, az utolsó
 * négy pedig **átemelt érték**: a kontextusban megjelenik, de nem itt keletkezik.
 *
 * - `graph`: a végrehajtható gráf, amiből a gráfbeli ős reláció jön (4.1).
 * - `executedInstances`: a lefutott példányok nyilvántartása, amit a
 *   `scheduling` téma vezet (T-005-17).
 * - `instance`: a jelenlegi node példány azonosítója (4.3).
 * - `input`: a futás bemenete, ami egyben a `start` node kimenete.
 * - `item`: a jelenlegi fan-out elem **értéke**. Lásd a `buildRunContext`
 *   doksijának "Miért bemenet az `item`" szakaszát.
 * - `joinInputs`: a beérkezett ág kimenetek, kizárólag `join` node
 *   végrehajtásakor (5.6).
 * - `error`: a hibázó lépés hibaosztálya és üzenete, kizárólag `error_handler`
 *   node végrehajtásakor (8.2).
 */
export interface BuildRunContextInput {
  readonly graph: ExecutableGraph;
  readonly executedInstances: readonly ExecutedStepInstance[];
  readonly instance: StepInstanceReference;
  readonly input: unknown;
  readonly item?: unknown;
  readonly joinInputs?: readonly unknown[];
  readonly error?: { readonly kind: string; readonly message: string };
}

// A legbelső `fan_out` keret `itemIndex` értéke, vagy `undefined`, ha a
// veremben egyetlen `fan_out` keret sincs. A verem a gyökértől befelé áll
// (4.3), ezért az előre haladó bejárás **utolsó** találata a legbelső keret.
function innermostItemIndex(context: BranchContext): number | undefined {
  let itemIndex: number | undefined;

  for (const scope of context) {
    if (scope.kind === 'fan_out') {
      itemIndex = scope.itemIndex;
    }
  }

  return itemIndex;
}

// A legbelső `loop` keret `iteration` értéke, vagy `undefined`. Ugyanaz a
// bejárás, mint az `innermostItemIndex` esetén, a másik keret fajtára.
function innermostIteration(context: BranchContext): number | undefined {
  let iteration: number | undefined;

  for (const scope of context) {
    if (scope.kind === 'loop') {
      iteration = scope.iteration;
    }
  }

  return iteration;
}

// A `steps` rekord (6.2): a jelenlegi node minden gráfbeli ősére megkíséreljük
// a feloldást, és csak a sikeres párokat vesszük fel.
//
// **A fel nem oldható ős nem hiba**, ezért nincs `Outcome` a visszatérési
// típusban: egy le nem futott vagy más ág kontextusban futott ős egyszerűen
// hiányzik a rekordból, és a kifejezés kiértékelő `undefined` értéket lát rá,
// ha hivatkozik. A nevesített, hibázni képes feloldás külön függvény
// (`resolveStepReference`), mert azt a `sub_workflow` `inputMapping` hívja
// (5.9 2. pont).
function buildStepsRecord(
  graph: ExecutableGraph,
  executedInstances: readonly ExecutedStepInstance[],
  instance: StepInstanceReference,
): Readonly<Record<string, unknown>> {
  const steps: Record<string, unknown> = {};

  for (const ancestorNodeId of collectAncestorNodeIds(graph, instance.nodeId)) {
    const visible = findVisibleStepInstance(executedInstances, ancestorNodeId, instance.branchContext);
    if (visible !== undefined) {
      steps[ancestorNodeId] = visible.output;
    }
  }

  return steps;
}

/**
 * A `RunContext` összeállítása egy node példányhoz (SPEC-004 6.1 és 6.2).
 * Tiszta függvény: adatbázist, portot és órát nem érint, a teljes bemenete a
 * `BuildRunContextInput`.
 *
 * **Mi számítódik itt és mi érkezik készen.** A `steps` rekordot és a két
 * hatókör számot (`itemIndex`, `iteration`) ez a függvény vezeti le, az elsőt a
 * 6.2 feloldási szabályából, a másik kettőt a jelenlegi példány ág kontextus
 * verméből. Az `input`, a `joinInputs` és az `error` mező átemelt érték: az
 * elsőt a futás hordozza, a másik kettő pedig node típushoz kötött, és
 * kizárólag a `join`, illetve az `error_handler` végrehajtója tudja, mi az
 * értéke (5.6, 8.2).
 *
 * **Miért bemenet az `item` is.** A `BranchScope` alakja a SPEC-004 4.3
 * szekcióban szó szerint áll, és a `fan_out` keret két mezőt hordoz: a
 * hatókört nyitó lépés futásának azonosítóját és az `itemIndex` sorszámot. Az
 * elem **értéke** nincs a veremben, a spec pedig sehol nem mondja ki, hogy a
 * `fan_out` node kimenete maga a kiértékelt lista lenne (az 5. szekció
 * táblázata csak a `start` node kimenetét nevezi meg). Az értéket tehát vagy
 * megtippelnénk a `fan_out` node kimenetének alakjáról, vagy a hívótól kérjük;
 * a tippelés tilos (`.claude/CLAUDE.md` 4.), ezért az `item` bemenet, amit a
 * `fan_out` végrehajtója ad át az ág aktiválásakor, az `itemIndex` sorszámhoz
 * tartozó elemmel.
 *
 * **A két hatókör szám a legbelső azonos fajtájú keretből jön, nem a verem
 * tetejéről.** A 6.1 szekció szó szerint "a legbelső fan_out hatókör eleme" és
 * "a legbelső loop hatókör iterációja" megfogalmazást használ. A kettő nem
 * ugyanaz: egy `fan_out` hatókörben nyitott `loop` esetén a verem tetején
 * `loop` keret áll, az `itemIndex` mégis látszik, mert a példány továbbra is a
 * fan-out ág eleme alatt fut.
 */
export function buildRunContext(input: BuildRunContextInput): RunContext {
  return {
    input: input.input,
    steps: buildStepsRecord(input.graph, input.executedInstances, input.instance),
    item: input.item,
    itemIndex: innermostItemIndex(input.instance.branchContext),
    iteration: innermostIteration(input.instance.branchContext),
    joinInputs: input.joinInputs,
    error: input.error,
  };
}
