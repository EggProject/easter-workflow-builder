/* eslint-disable unicorn/no-null -- a szintetikus WorkflowEdgeInput fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { WorkflowEdgeInput } from '@easter-workflow-builder/protocol';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { workflowEdgeToFlowEdge } from '../graph-editor/graph-editor-edge-mapping.ts';
import { buildRunGraphFlowEdges, HIGHLIGHTED_BRANCH_EDGE_CLASS_NAME } from './build-run-graph-flow-edges.ts';

function edgeInput(id: string, branchKey: string | null): WorkflowEdgeInput {
  return {
    id,
    sourceNodeId: 'branch',
    targetNodeId: `target-${id}`,
    sourceHandle: branchKey,
    targetHandle: null,
    branchKey,
  };
}

const YES_EDGE = edgeInput('e-yes', 'igen');
const NO_EDGE = edgeInput('e-no', 'nem');

describe('buildRunGraphFlowEdges', () => {
  it('a kiemelt él a szerkesztővel közös leképezés, plusz a kiemelés osztálya', () => {
    const [flowEdge] = buildRunGraphFlowEdges([YES_EDGE], new Set([YES_EDGE.id]));
    expect(flowEdge).toEqual({ ...workflowEdgeToFlowEdge(YES_EDGE), className: HIGHLIGHTED_BRANCH_EDGE_CLASS_NAME });
  });

  it('a nem kiemelt él a közös leképezés változatlanul, className kulcs nélkül', () => {
    const [flowEdge] = buildRunGraphFlowEdges([NO_EDGE], new Set([YES_EDGE.id]));
    expect(flowEdge).toEqual(workflowEdgeToFlowEdge(NO_EDGE));
    expect(flowEdge).not.toHaveProperty('className');
  });

  it('élenként dönt, a sorrendet megtartva', () => {
    const flowEdges = buildRunGraphFlowEdges([YES_EDGE, NO_EDGE], new Set([NO_EDGE.id]));
    expect(flowEdges.map((flowEdge) => [flowEdge.id, flowEdge.className])).toEqual([
      ['e-yes', undefined],
      ['e-no', HIGHLIGHTED_BRANCH_EDGE_CLASS_NAME],
    ]);
  });

  it('kiemelt él nélkül egyik él sem kap osztályt', () => {
    const flowEdges = buildRunGraphFlowEdges([YES_EDGE, NO_EDGE], new Set());
    expect(flowEdges.some((flowEdge) => 'className' in flowEdge)).toBe(false);
  });

  it('élek nélkül üres listát ad', () => {
    expect(buildRunGraphFlowEdges([], new Set(['e-yes']))).toEqual([]);
  });
});

describe('a kiemelés osztálya és a run-graph.css', () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const stylesheet = readFileSync(path.join(directory, 'run-graph.css'), 'utf8');

  it('a stíluslap ugyanerre az osztályra festi az élt a --ep-accent tokennel és 2.4 vastagsággal', () => {
    const rulePattern = new RegExp(
      String.raw`^\.run-graph-canvas[^{]*\.${HIGHLIGHTED_BRANCH_EDGE_CLASS_NAME}[^{]*\{([^}]*)\}`,
      'm',
    );
    const ruleMatch = rulePattern.exec(stylesheet);
    expect(ruleMatch).not.toBeNull();
    const declarations = ruleMatch?.[1] ?? '';
    expect(declarations).toMatch(/stroke:\s*var\(--ep-accent\);/);
    expect(declarations).toMatch(/stroke-width:\s*2\.4;/);
  });
});
