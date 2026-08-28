import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ProviderDescriptorLookupPort } from '../engine-port/provider-descriptor-lookup-port.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { ValidatedRun } from '../run-validation/validated-run.ts';
import type { NodePlan } from './run-execution.ts';

/**
 * A node ténylegesen bekötött, `on_error`-tól különböző kimenő éleinek
 * `branch_key` értéke (`execute-branch.ts` szerződése). A `branchKey === null`
 * élek kimaradnak: azok nem nevezett ágak, tehát egy `branch` node döntése sem
 * illeszkedhet rájuk.
 */
function availableBranchKeysOf(graph: ExecutableGraph, nodeId: string): readonly string[] {
  const branchKeys: string[] = [];
  const outgoingEdges = graph.outgoingEdges.get(nodeId) ?? [];
  for (const edge of outgoingEdges) {
    if (edge.branchKey !== null && edge.branchKey !== 'on_error') {
      branchKeys.push(edge.branchKey);
    }
  }
  return branchKeys;
}

/**
 * A validált futásból node-onkénti végrehajtási terv (`NodePlan`), egyszer, a
 * futás indításakor (SPEC-004 4.8 után). Minden mezője a futás alatt
 * változatlan, mert a pillanatkép be van fagyasztva (4.1).
 *
 * **A két hibaág éles futásban nem fordul elő, mégsem "lehetetlen esetre írt
 * hibakezelés".** A `ValidatedRun` két térképe (`nodeConfigsById` és
 * `effectiveProviderByNodeId`) típusszinten független egymástól, és az
 * `onUnhandledError` mező a tárolt alakban nullázható marad
 * (SPEC-003 4.3) - a `validateRun` menete garantálja, hogy egy valódi
 * `ValidatedRun` értékben mindkét feltétel teljesül, de a függvény önmagában
 * hívható egy kézzel összerakott, ellentmondó értékkel is, tehát mindkét ág
 * elérhető és tesztelhető. Ugyanaz a megfontolás, mint a `RetryDecision`
 * `missing_backoff` ágánál.
 *
 * A hibaosztály mindkét ágon a helyzetet pontosan megnevező, már létező érték:
 * hiányzó feloldott provider esetén `no_default_provider` (11.1, "nincs
 * feloldható provider"), hiányzó politika esetén
 * `unhandled_error_policy_missing` (4.7 táblázat 9. sora).
 */
export function buildNodePlans(
  validated: ValidatedRun,
  descriptorLookup: ProviderDescriptorLookupPort,
): Outcome<ReadonlyMap<string, NodePlan>> {
  const plans = new Map<string, NodePlan>();

  for (const [nodeId, config] of validated.nodeConfigsById) {
    const providerId = validated.effectiveProviderByNodeId.get(nodeId);
    if (providerId === undefined) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'no_default_provider',
          `A(z) ${nodeId} node-hoz nem tartozik feloldott provider`,
        ),
      };
    }

    const onUnhandledError = config.onUnhandledError;
    if (onUnhandledError === null) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'unhandled_error_policy_missing',
          `A(z) ${nodeId} node configjában nincs onUnhandledError érték beállítva`,
        ),
      };
    }

    plans.set(nodeId, {
      config,
      onUnhandledError,
      providerId,
      descriptor: descriptorLookup(providerId),
      availableBranchKeys: availableBranchKeysOf(validated.graph, nodeId),
    });
  }

  return { kind: 'ok', value: plans };
}
