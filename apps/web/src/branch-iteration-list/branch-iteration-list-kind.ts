import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';

/**
 * A két csomópont típus, aminek a futás nézetben tételes listája van
 * (SPEC-008 6.3, O-39): a `fan_out` ágai és a `loop` iterációi.
 */
export type BranchIterationListKind = 'fan_out' | 'loop';

/**
 * Van-e a csomópontnak tételes listája, és ha igen, melyik fajta. A `config`
 * `type` mezője dönt, nem a csomópont `type` mezője, ugyanazzal az indokkal,
 * mint a kártya összesítésénél (`run-graph/describe-run-node-summary.ts`): a
 * drótszintű séma a két mezőt szándékosan nem kapcsolja össze, és a `config`
 * a mérvadó.
 */
export function resolveBranchIterationListKind(
  config: WorkflowNodeInput['config'],
): BranchIterationListKind | undefined {
  if (config.type === 'fan_out' || config.type === 'loop') {
    return config.type;
  }
  return undefined;
}
