import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { BranchDecision } from './branch-decision.ts';
import type { BranchHighlightMode } from './branch-highlight-mode.ts';

/**
 * A döntések választott kulcsai egy `branch` csomóponton (1. pont); a `null`
 * kulcs kimarad, mert ilyen kulcsú élt a motor soha nem követ (3. pont).
 */
function chosenBranchKeys(decisions: readonly BranchDecision[], defaultBranchKey: string | null): ReadonlySet<string> {
  const chosenKeys = new Set<string>();
  for (const decision of decisions) {
    const chosenKey = decision.usedDefault ? defaultBranchKey : decision.branchKey;
    if (chosenKey !== null) {
      chosenKeys.add(chosenKey);
    }
  }
  return chosenKeys;
}

export interface HighlightedBranchEdgeInput {
  /**
   * Csomópont azonosító -> a hozzá leképezett döntések, növekvő `eventId`
   * szerint (`group-branch-decisions-by-node.ts`).
   */
  readonly decisionsByNodeId: ReadonlyMap<string, readonly BranchDecision[]>;
  /**
   * A pillanatkép csomópontjai: az alapértelmezett ág kulcsa a `branch`
   * csomópont `config.defaultBranchKey` mezőjéből jön.
   */
  readonly nodes: readonly WorkflowNodeInput[];
  readonly edges: readonly WorkflowEdgeInput[];
  readonly mode: BranchHighlightMode;
}

/**
 * A kiemelendő élek azonosítói (SPEC-008 6.6, 88.): tiszta függvény, DOM és
 * `@xyflow/react` hivatkozás nélkül.
 *
 * 1. **A választott kulcs.** `usedDefault: false` esetén a döntés
 *    `branchKey` értéke; `usedDefault: true` esetén a pillanatkép `branch`
 *    csomópontjának `defaultBranchKey` értéke, mert a motor ilyenkor pontosan
 *    azt a kulcsot választja, a payload kulcsa pedig `null` (`packages/engine` `execute-branch.ts`).
 * 2. **A mód.** `latest`: csomópontonként csak a legutóbbi (legnagyobb
 *    `eventId`-jű) döntés; `all`: minden döntés.
 * 3. **A kiemelt élek.** A pillanatkép minden éle, aminek a forrása a `branch`
 *    csomópont és a `branchKey` mezője egy választott kulcs. A `null` kulcsú él
 *    soha nem emelődik ki, mert a motor soha nem követi (`packages/engine` `build-node-plans.ts`, SPEC-008 O-23).
 *
 * Döntés csak `branch` típusú csomóponthoz tartozhat; más típusú vagy a
 * pillanatképben nem szereplő csomóponthoz leképezett döntés nem emel ki élt.
 */
export function resolveHighlightedBranchEdgeIds(input: Readonly<HighlightedBranchEdgeInput>): ReadonlySet<string> {
  const { decisionsByNodeId, nodes, edges, mode } = input;
  const chosenKeysByNodeId = new Map<string, ReadonlySet<string>>();

  for (const { id, config } of nodes) {
    if (config.type !== 'branch') {
      continue;
    }
    const decisions = decisionsByNodeId.get(id) ?? [];
    const considered = mode === 'latest' ? decisions.slice(-1) : decisions;
    chosenKeysByNodeId.set(id, chosenBranchKeys(considered, config.defaultBranchKey));
  }

  const highlighted = new Set<string>();
  for (const edge of edges) {
    if (edge.branchKey !== null && chosenKeysByNodeId.get(edge.sourceNodeId)?.has(edge.branchKey) === true) {
      highlighted.add(edge.id);
    }
  }
  return highlighted;
}
