import type { Outcome } from '@easter-workflow-builder/core';
import type { ProviderDescriptorLookupPort } from '../engine-port/provider-descriptor-lookup-port.ts';
import type { ValidatedRun } from '../run-validation/validated-run.ts';
import { buildNodePlans } from './build-node-plans.ts';
import type { NodePlan } from './run-execution.ts';
import { validateProviderCapabilities } from './validate-provider-capabilities.ts';
import { validateRunInput } from './validate-run-input.ts';

export interface PrepareRunInput {
  readonly validated: ValidatedRun;
  readonly descriptorLookup: ProviderDescriptorLookupPort;
  readonly installedAgentSdkVersion: string;
  readonly input: Readonly<Record<string, unknown>>;
}

/**
 * A SPEC-004 4.8 menet 3. lépésének provider fele és a 4. lépése egyben: a
 * node-onkénti végrehajtási terv, a leíró alapú ellenőrzések (11.2) és a
 * futás bemenetének ellenőrzése. **Egyetlen sor sem ír adatot**, tehát egy itt
 * megbukó futás soha nem hoz létre `workflow_run` sort.
 *
 * **Miért egy függvény a három.** A `buildNodePlans` hibaágai a `ValidatedRun`
 * belső ellentmondásait jelzik, amiket egy valódi `validateRun` eredmény
 * kizár; ha a `run-supervisor` külön ágaztatna rájuk, ott olyan elágazás
 * keletkezne, aminek az egyik kimenete sosem fordul elő. Így a hívási helyen
 * egyetlen elágazás áll, aminek mindkét kimenete előfordul (érvénytelen
 * bemenet, illetve leíró eltérés), a három belső ág pedig ennek a függvénynek
 * a tesztjében, kézzel összerakott `ValidatedRun` értékkel érhető el.
 */
export function prepareRun(input: PrepareRunInput): Outcome<ReadonlyMap<string, NodePlan>> {
  const nodePlans = buildNodePlans(input.validated, input.descriptorLookup);
  if (nodePlans.kind === 'error') {
    return nodePlans;
  }

  const capabilities = validateProviderCapabilities(nodePlans.value, input.installedAgentSdkVersion);
  if (capabilities.kind === 'error') {
    return capabilities;
  }

  const runInput = validateRunInput(input.validated.nodeConfigsById, input.validated.startNodeId, input.input);
  if (runInput.kind === 'error') {
    return runInput;
  }

  return nodePlans;
}
