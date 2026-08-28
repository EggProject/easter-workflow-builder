import type { Outcome } from '@easter-workflow-builder/core';
import type { GraphSnapshotDocument } from '@easter-workflow-builder/db';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import { validateScopeBalance } from '../branch-scope/validate-scope-balance.ts';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import { detectGraphCycle } from '../run-graph/detect-graph-cycle.ts';
import { findLoopBackEdges } from '../run-graph/find-loop-back-edges.ts';
import { validateLoopBackEdgeBody } from '../run-graph/validate-loop-back-edge-body.ts';
import { validateLoopBranchEdges } from '../run-graph/validate-loop-branch-edges.ts';
import { resolveNodeProviders } from './resolve-node-providers.ts';
import { validateBranchEdgeKeys } from './validate-branch-edge-keys.ts';
import { validateDefaultBranchKey } from './validate-default-branch-key.ts';
import { validateEdgeEndpoints } from './validate-edge-endpoints.ts';
import { validateErrorHandlerBackoff } from './validate-error-handler-backoff.ts';
import { validateErrorHandlerEdges } from './validate-error-handler-edges.ts';
import { validateImplementedNodeTypes } from './validate-implemented-node-types.ts';
import { validateJoinMergeSettings } from './validate-join-merge-settings.ts';
import { validateNodeConfigs } from './validate-node-configs.ts';
import { validateNodeReachability } from './validate-node-reachability.ts';
import { validateReservedBranchKeys } from './validate-reserved-branch-keys.ts';
import { validateStartNode } from './validate-start-node.ts';
import { validateUnhandledErrorPolicy } from './validate-unhandled-error-policy.ts';
import type { ValidatedRun } from './validated-run.ts';

// Az érték nélküli ellenőrzések sorban futtatása, az elsőnél megállva. Nem
// általános absztrakció: kizárólag azért áll itt, hogy a `validateRun` két
// ellenőrzési blokkja ne tizenegy egyforma `if (... === 'error') return ...`
// sorból álljon, ami a `sonarjs/cognitive-complexity` küszöböt is átlépné.
function firstError(checks: readonly (() => Outcome<void>)[]): Outcome<void> {
  for (const check of checks) {
    const outcome = check();
    if (outcome.kind === 'error') {
      return outcome;
    }
  }
  return { kind: 'ok', value: undefined };
}

/**
 * A futás indítási validációja: a SPEC-004 4.5, 4.6 és 4.7 szekció minden
 * gráf ellenőrzése, plusz a 4.2 fenntartott `branch_key` szabálya, plusz a
 * 4.8 2. lépésének provider feloldása, egyetlen tiszta függvényben.
 *
 * **Adatbázist nem érint, és nem is szabad, hogy érintsen**: a SPEC-004 4.8
 * kimondja, hogy az 1 ... 5. lépés egyetlen adatot sem ír, mert egy érvénytelen
 * workflow soha nem hozhat létre `workflow_run` sort.
 *
 * **A bemenet a pillanatkép dokumentum**, mert az ütemező is kizárólag abból
 * dolgozik (4.1). A dokumentum node-jain álló `effectiveProviderId` mezőt a
 * validáció **nem olvassa**: a feloldás mérvadó eredménye a visszaadott
 * `effectiveProviderByNodeId` térkép, ami a 4.8 5. lépésében kerül a véglegesen
 * eltárolt dokumentumba.
 *
 * **Az első hibánál megáll**, nem gyűjt hibalistát. A SPEC-004 egyetlen helyen
 * sem mondja ki, melyik a kettő közül, ezért ez **tervezési döntés, nem
 * mérésből jövő szám**: a hibaosztályok egymásra épülnek (a `dangling_edge`
 * után az elérhetőség, a `malformed_node_config` után a config szintű
 * ellenőrzések értelmezhetetlenek lennének), és az `Outcome` alak eleve egyetlen
 * üzenetet hordoz. Ha valaha teljes hibalista kell a szerkesztőnek, az külön
 * felület, nem ennek a függvénynek a bővítése.
 *
 * **A sorrend kötött**, mert az ellenőrzések egymás előfeltételei:
 *
 * 1. `buildExecutableGraph`: a pillanatkép átindexelése (4.1).
 * 2. `validateStartNode`: a start node azonosítója kell a bejárásokhoz.
 * 3. Gráf alak: `validateEdgeEndpoints` (az élek valódi node-okat kötnek),
 *    `validateNodeReachability`, majd a 4.6 négy lépéséből a maradék három
 *    (`detectGraphCycle`, `validateLoopBackEdgeBody`, `validateLoopBranchEdges`)
 *    a `findLoopBackEdges` visszaél halmazával.
 * 4. `validateScopeBalance` (4.5): előfeltétele az egyetlen start node és a
 *    körmentesség, ezért csak itt futhat; mellékterméke a fan-out/join
 *    párosítás.
 * 5. Config szint: előbb az érvényesség (`validateNodeConfigs`), utána a
 *    végrehajthatóság (`validateImplementedNodeTypes`), és csak az így
 *    szűkített unión a maradék hét config ellenőrzés. A hetedik a 4.7
 *    táblázaton kívüli `validateErrorHandlerBackoff` (8.2 3. pont).
 * 6. `resolveNodeProviders` (4.8 2. lépés): a feloldás node-onként.
 */
export function validateRun(
  document: GraphSnapshotDocument,
  globalDefaultProviderId: ProviderId | null,
  workflowProviderId: ProviderId | null,
): Outcome<ValidatedRun> {
  const graph = buildExecutableGraph(document);

  const startNode = validateStartNode(graph);
  if (startNode.kind === 'error') {
    return startNode;
  }
  const startNodeId = startNode.value;
  const loopBackEdgeIds = findLoopBackEdges(graph);

  const shape = firstError([
    () => validateEdgeEndpoints(graph),
    () => validateNodeReachability(graph, startNodeId),
    () => detectGraphCycle(graph, loopBackEdgeIds),
    () => validateLoopBackEdgeBody(graph, loopBackEdgeIds),
    () => validateLoopBranchEdges(graph),
  ]);
  if (shape.kind === 'error') {
    return shape;
  }

  const scopeBalance = validateScopeBalance(graph, startNodeId, loopBackEdgeIds);
  if (scopeBalance.kind === 'error') {
    return scopeBalance;
  }

  const nodeConfigs = validateNodeConfigs(graph);
  if (nodeConfigs.kind === 'error') {
    return nodeConfigs;
  }

  const executableConfigs = validateImplementedNodeTypes(nodeConfigs.value);
  if (executableConfigs.kind === 'error') {
    return executableConfigs;
  }
  const nodeConfigsById = executableConfigs.value;

  const semantics = firstError([
    () => validateUnhandledErrorPolicy(nodeConfigsById),
    () => validateBranchEdgeKeys(graph, nodeConfigsById),
    () => validateDefaultBranchKey(nodeConfigsById),
    () => validateReservedBranchKeys(nodeConfigsById),
    () => validateErrorHandlerEdges(graph),
    () => validateErrorHandlerBackoff(nodeConfigsById),
    () => validateJoinMergeSettings(nodeConfigsById),
  ]);
  if (semantics.kind === 'error') {
    return semantics;
  }

  const providers = resolveNodeProviders(nodeConfigsById, globalDefaultProviderId, workflowProviderId);
  if (providers.kind === 'error') {
    return providers;
  }

  return {
    kind: 'ok',
    value: {
      graph,
      startNodeId,
      loopBackEdgeIds,
      fanOutJoinPairing: scopeBalance.value,
      nodeConfigsById,
      effectiveProviderByNodeId: providers.value,
    },
  };
}
