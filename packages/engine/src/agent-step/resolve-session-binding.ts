import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import { findNearestAncestorSession } from './find-nearest-ancestor-session.ts';
import { resolveForkSession } from './resolve-fork-session.ts';
import type { SessionBearingInstance } from './session-bearing-instance.ts';
import type { SessionBinding } from './session-binding.ts';
import type { SessionSourceNodes } from './session-source-nodes.ts';

/**
 * A `resolveSessionBinding` bemenete. A `sessionSourceNodes` és a `graph` a
 * pillanatképből számolt, futás alatt változatlan érték, a `sessionInstances`
 * és az `instance` viszont a futás aktuális állapota.
 */
export interface ResolveSessionBindingInput {
  readonly graph: ExecutableGraph;
  readonly sessionSourceNodes: SessionSourceNodes;
  readonly instance: StepInstanceReference;
  readonly sessionMode: AgentStepConfig['sessionMode'];
  readonly sessionInstances: readonly SessionBearingInstance[];
}

/**
 * A lépés session kötésének feloldása (SPEC-004 6.3 táblázat, 5.2 3. pont).
 *
 * - `isolated`: friss session, `resume` és `forkSession` nélkül. Ez a
 *   `SessionBinding` `isolated` ága, és nem igényel keresést: a session
 *   azonosító a `system` `init` üzenetből íródik majd a `step_run` sorra.
 * - `continued`: a legközelebbi ős lépés session azonosítója megy ki
 *   `resume` értékként, mellette a `resolveForkSession` determinisztikus
 *   döntése (6.4). Ha nincs folytatható ős, `no_resumable_session` hiba, és a
 *   motor **nem** indít helyette friss sessiont, mert az csendben más
 *   viselkedést adna, mint amit a felhasználó kért (6.3).
 *
 * Tiszta függvény: adatbázist és portot nem érint, a teljes bemenete a
 * paraméter objektum.
 */
export function resolveSessionBinding(input: ResolveSessionBindingInput): Outcome<SessionBinding> {
  if (input.sessionMode === 'isolated') {
    return { kind: 'ok', value: { mode: 'isolated' } };
  }

  const resume = findNearestAncestorSession(input.graph, input.sessionInstances, input.instance);
  if (resume === undefined) {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'no_resumable_session',
        `A(z) ${input.instance.nodeId} node continued session módban fut, de az ág kontextusában egyetlen ős lépésnek sincs SDK session azonosítója`,
      ),
    };
  }

  return {
    kind: 'ok',
    value: {
      mode: 'continued',
      resume,
      forkSession: resolveForkSession(input.graph, input.sessionSourceNodes, input.instance.nodeId),
    },
  };
}
