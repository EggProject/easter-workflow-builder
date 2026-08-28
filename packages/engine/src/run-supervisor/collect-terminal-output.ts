import type { ExecutedStepInstance } from '../run-context/executed-step-instance.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';

/**
 * A gráf **terminális** node-jai: akiknek nincs kimenő élük. A `loop` node
 * visszaéle is kimenő él, tehát egy ciklust záró node nem terminális - ez
 * helyes, mert a ciklus az `exit` ágán megy tovább.
 */
function terminalNodeIdsOf(graph: ExecutableGraph): readonly string[] {
  const terminalNodeIds: string[] = [];
  for (const nodeId of graph.nodesById.keys()) {
    if ((graph.outgoingEdges.get(nodeId) ?? []).length === 0) {
      terminalNodeIds.push(nodeId);
    }
  }
  return terminalNodeIds;
}

/**
 * Egy lezárult futás **kimenete**: a terminális node-jainak kimenete
 * (SPEC-004 5.9 6. pont). Ezt az értéket veszi át a hívó `sub_workflow` lépés
 * a saját kimeneteként.
 *
 * **A "terminális node kimenete" fogalmat a spec nem határozza meg, ezért itt
 * dől el** (a `child-workflow-runner.ts` doksija ezt a döntést a port
 * implementációjára, vagyis erre a témára hagyta):
 *
 * - **terminális node** az, aminek a gráfban nincs kimenő éle. Nem a
 *   `SchedulerState` dönti el: a fogalom a gráf alakjából jön, tehát ugyanaz
 *   marad két különböző lefutás után is, és nem függ attól, melyik ág futott.
 * - **egyetlen terminális node esetén a kimenet maga az az érték**, amit a
 *   node utolsó lefutott példánya adott. Ez az elsöprő többségi eset, és így
 *   a szülő workflow kifejezései a szokásos `steps['al-workflow']` alakban
 *   érik el a gyerek eredményét, egy felesleges közbenső szint nélkül.
 * - **több terminális node esetén rekord**, node azonosító -> kimenet, mert
 *   egyetlen érték kiválasztása a több közül kitalált szabály lenne.
 * - **le nem futott terminális node** (halott ág, `fail_branch` után elhalt
 *   ág) nem szerepel a rekordban; egyetlen terminális node esetén ilyenkor az
 *   érték `undefined`.
 * - **fan-out ág több példánya** esetén az **utolsó** lefutás értéke marad,
 *   ugyanaz a "későbbi elem a frissebb lefutás" szabály, amit az
 *   `ExecutedStepInstance` lista doksija és a `findVisibleStepInstance`
 *   döntetlen szabálya is használ. A példányonkénti szétválasztás ág
 *   kontextust igényelne a kimenetben, amire a spec nem ad alakot.
 */
export function collectTerminalOutput(
  graph: ExecutableGraph,
  executedInstances: readonly ExecutedStepInstance[],
): unknown {
  const terminalNodeIds = terminalNodeIdsOf(graph);
  const outputByNodeId = new Map<string, unknown>();

  for (const executed of executedInstances) {
    if (terminalNodeIds.includes(executed.nodeId)) {
      outputByNodeId.set(executed.nodeId, executed.output);
    }
  }

  const [onlyTerminalNodeId] = terminalNodeIds;
  if (onlyTerminalNodeId !== undefined && terminalNodeIds.length === 1) {
    return outputByNodeId.get(onlyTerminalNodeId);
  }

  return Object.fromEntries(outputByNodeId);
}
