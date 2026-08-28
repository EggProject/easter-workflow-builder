import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { collectAncestorNodeIds } from './collect-ancestor-node-ids.ts';
import type { ExecutedStepInstance } from './executed-step-instance.ts';
import { findVisibleStepInstance } from './find-visible-step-instance.ts';
import type { StepInstanceReference } from './step-instance-reference.ts';

/**
 * **Egyetlen** node hivatkozás feloldása a SPEC-004 6.2 szabálya szerint, hibás
 * ágon `unresolvable_step_reference` hibaosztállyal.
 *
 * A szabály **két feltétele egyszerre** kell:
 *
 * 1. a hivatkozott node a jelenlegi node **gráfbeli őse**
 *    (`collectAncestorNodeIds`), és
 * 2. van olyan lefutott példánya, aminek az **ág kontextusa előtagja** a
 *    jelenlegi példány kontextusának (`findVisibleStepInstance`).
 *
 * **Miért nem elég az ág kontextus önmagában.** Egy `branch` node maga nem nyit
 * hatókört (4.5, a keretet csak a `fan_out` és a `loop` node tolja a veremre),
 * tehát két, egymást kizáró `branch` ág node-jai **azonos** ág kontextusban
 * futnak. Ha csak a kontextus előtagot néznénk, az egyik ág node-ja láthatná a
 * másik ág kimenetét, holott a kettő között nincs sem gráfbeli, sem
 * végrehajtási sorrend. A gráfbeli ős feltétel ezt kontextustól függetlenül
 * zárja ki. Fordítva, önmagában a gráfbeli ős feltétel sem elég: egy fan-out
 * testvér ág node-ja gráfbeli ős lehet, de a kontextusa nem előtag, mert
 * ugyanazon a verem pozíción más az `itemIndex` (6.2 zárómondata).
 *
 * **Ez a függvény a `sub_workflow` végrehajtójáé** (5.9 2. pontja, T-005-23):
 * az `inputMapping` értékei egyenként, névvel feloldott hivatkozások, és egy
 * fel nem oldható hivatkozás ott hiba. A `steps` rekord építése ezzel szemben
 * nem hibázhat, ott a fel nem oldható ős egyszerűen kimarad
 * (`buildRunContext`).
 */
export function resolveStepReference(
  graph: ExecutableGraph,
  executedInstances: readonly ExecutedStepInstance[],
  instance: StepInstanceReference,
  referencedNodeId: string,
): Outcome<unknown> {
  if (!collectAncestorNodeIds(graph, instance.nodeId).has(referencedNodeId)) {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'unresolvable_step_reference',
        `A(z) ${referencedNodeId} node nem gráfbeli őse a(z) ${instance.nodeId} node-nak`,
      ),
    };
  }

  const visible = findVisibleStepInstance(executedInstances, referencedNodeId, instance.branchContext);

  if (visible === undefined) {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'unresolvable_step_reference',
        `A(z) ${referencedNodeId} node-nak nincs látható lefutott példánya a(z) ${instance.nodeId} node ág kontextusából nézve`,
      ),
    };
  }

  return { kind: 'ok', value: visible.output };
}
