import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { collectAncestorNodeIds } from '../run-context/collect-ancestor-node-ids.ts';
import { findVisibleStepInstance } from '../run-context/find-visible-step-instance.ts';
import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import type { SessionBearingInstance } from './session-bearing-instance.ts';

/**
 * A folytatandó session azonosítójának feloldása (SPEC-004 6.3, "A folytatandó
 * session feloldása"): "A jelenlegi példány ág kontextusában visszafelé
 * haladva az első olyan ős node példány, aminek van nem NULL `sdk_session_id`
 * értéke."
 *
 * A mondat két feltételt köt össze, és mindkettőnek van már megírt, tesztelt
 * eszköze a `run-context` témában, ezért itt egyetlen sor sem ismétli meg
 * őket:
 *
 * - **"visszafelé haladva az első"**: a `collectAncestorNodeIds` a bejövő él
 *   térképen szélességi bejárással gyűjti az ősöket, és a visszaadott halmaz
 *   **beszúrási sorrendje** a bejárás sorrendje, tehát a gráfban közelebbi ős
 *   áll elöl. A ciklus így az első találatnál megáll, és az a legközelebbi ős.
 * - **"a jelenlegi példány ág kontextusában"**: a `findVisibleStepInstance` az
 *   ág kontextus előtag szabályát és a legbelső példány kiválasztását adja
 *   (SPEC-004 6.2), ugyanazzal a szabállyal, amivel a `steps` rekord épül.
 *
 * A bemeneti lista kizárólag session azonosítót **hordozó** példányokat
 * tartalmaz, tehát a "nem NULL `sdk_session_id`" feltétel a lista
 * összeállításakor teljesül (`SessionBearingInstance`).
 *
 * `undefined` visszatérés esetén a hívó `no_resumable_session` hibát ad, és
 * **nem** indít helyette friss sessiont (6.3, 31. elfogadási kritérium).
 */
export function findNearestAncestorSession(
  graph: ExecutableGraph,
  sessionInstances: readonly SessionBearingInstance[],
  instance: StepInstanceReference,
): string | undefined {
  for (const ancestorNodeId of collectAncestorNodeIds(graph, instance.nodeId)) {
    const visible = findVisibleStepInstance(sessionInstances, ancestorNodeId, instance.branchContext);
    if (visible !== undefined) {
      return visible.sdkSessionId;
    }
  }

  return undefined;
}
