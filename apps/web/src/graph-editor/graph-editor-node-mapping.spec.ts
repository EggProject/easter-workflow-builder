/* eslint-disable unicorn/no-null -- a szintetikus WorkflowNodeInput fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak */
import { NodeTypeSchema, type NodeType, type WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { flowNodeToWorkflowNode, workflowNodeToFlowNode } from './graph-editor-node-mapping.ts';

const WORKFLOW_NODE: WorkflowNodeInput = {
  id: 'n-1',
  type: 'start',
  label: 'Indítás',
  positionX: 12,
  positionY: 34,
  config: { type: 'start', inputFields: [], onUnhandledError: null },
};

describe('workflowNodeToFlowNode', () => {
  it('a pozíciót {x, y} alakra, a típust a rögzített workflowNode kulcsra teszi', () => {
    const flowNode = workflowNodeToFlowNode(WORKFLOW_NODE);
    expect(flowNode).toEqual({
      id: 'n-1',
      type: 'workflowNode',
      position: { x: 12, y: 34 },
      deletable: false,
      data: { workflowNode: WORKFLOW_NODE },
    });
  });

  it('csak a start csomópont vászon alakja nem törölhető (deletable: false), típusonként', () => {
    const expectedDeletable = {
      start: false,
      agent_step: true,
      branch: true,
      fan_out: true,
      join: true,
      loop: true,
      human_approval: true,
      error_handler: true,
      sub_workflow: true,
      script: true,
    } as const satisfies Readonly<Record<NodeType, boolean>>;
    for (const type of NodeTypeSchema.options) {
      const flowNode = workflowNodeToFlowNode({ ...WORKFLOW_NODE, type });
      expect(flowNode.deletable, type).toBe(expectedDeletable[type]);
    }
  });
});

describe('flowNodeToWorkflowNode', () => {
  it('a vászon pozícióját visszaírja a positionX/positionY mezőbe, a többi mezőt megőrzi', () => {
    const flowNode = workflowNodeToFlowNode(WORKFLOW_NODE);
    const moved = { ...flowNode, position: { x: 100, y: 200 } };
    expect(flowNodeToWorkflowNode(moved)).toEqual({ ...WORKFLOW_NODE, positionX: 100, positionY: 200 });
  });

  it('a workflowNodeToFlowNode majd flowNodeToWorkflowNode kör-út visszaadja az eredeti node-ot', () => {
    expect(flowNodeToWorkflowNode(workflowNodeToFlowNode(WORKFLOW_NODE))).toEqual(WORKFLOW_NODE);
  });
});
