/* eslint-disable unicorn/no-null -- a szintetikus WorkflowNodeInput fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak), nem helyőrző `undefined`-et */
import type { StepRunStatus, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { StepRunStatusSchema } from '@easter-workflow-builder/protocol';
import { ReactFlow } from '@xyflow/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GraphNodeCard } from './GraphNodeCard.tsx';
import type { GraphNodeCardFlowNode } from './graph-node-card-data.ts';

const NODE_TYPES = { workflowNode: GraphNodeCard };

/**
 * A T-009-3 mérés szerinti mezőpár (`initialWidth`/`initialHeight`), ami
 * happy-dom alatt ugyanúgy láthatóvá teszi a node-ot, mint a `width`/
 * `height` (`docs/research/2026-09-05-plan009-f0-blokkolo-meresek.md` 2.
 * szekció). A számérték itt kizárólag teszt fixture méret, nem a T-009-19
 * mért kártya konstans.
 */
const TEST_NODE_SIZE = { initialWidth: 220, initialHeight: 96 };

function buildFlowNode(workflowNode: WorkflowNodeInput, status?: StepRunStatus): GraphNodeCardFlowNode {
  return {
    id: workflowNode.id,
    type: 'workflowNode',
    position: { x: workflowNode.positionX, y: workflowNode.positionY },
    // `exactOptionalPropertyTypes: true` miatt a `status` kulcsot csak akkor
    // vesszük fel, ha valódi értéke van - `{ status: undefined }` nem
    // egyenértékű a kulcs hiányával ez alatt a beállítás alatt.
    data: status === undefined ? { workflowNode } : { workflowNode, status },
    ...TEST_NODE_SIZE,
  };
}

const AGENT_STEP_SETTINGS = {
  promptTemplate: 'Foglald össze: {{input}}',
  providerId: null,
  modelId: null,
  effort: null,
  thinking: null,
  allowedTools: [],
  disallowedTools: [],
  permissionMode: null,
  maxTurns: null,
  maxBudgetUsd: null,
  systemPrompt: null,
  agents: {},
  skills: null,
  mcpServers: {},
  enabledEngineHooks: [],
  cwd: null,
  additionalDirectories: [],
  sandbox: null,
  agentTools: [],
  sessionMode: 'isolated' as const,
  structuredOutput: null,
};

const WORKFLOW_NODES: Readonly<Record<WorkflowNodeInput['type'], WorkflowNodeInput>> = {
  start: {
    id: 'n-start',
    type: 'start',
    label: 'Indítás',
    positionX: 0,
    positionY: 0,
    config: { type: 'start', inputFields: [], onUnhandledError: null },
  },
  agent_step: {
    id: 'n-agent',
    type: 'agent_step',
    label: 'Összefoglaló',
    positionX: 0,
    positionY: 0,
    config: { ...AGENT_STEP_SETTINGS, type: 'agent_step', onUnhandledError: null },
  },
  branch: {
    id: 'n-branch',
    type: 'branch',
    label: 'Elágazás',
    positionX: 0,
    positionY: 0,
    config: {
      type: 'branch',
      expression: 'x > 0',
      branches: [
        { key: 'pos', label: 'Pozitív' },
        { key: 'neg', label: 'Negatív' },
      ],
      defaultBranchKey: null,
      onUnhandledError: null,
    },
  },
  fan_out: {
    id: 'n-fan-out',
    type: 'fan_out',
    label: 'Szétosztás',
    positionX: 0,
    positionY: 0,
    config: { type: 'fan_out', itemsExpression: 'items', branchLabelTemplate: '{{item}}', onUnhandledError: null },
  },
  join: {
    id: 'n-join',
    type: 'join',
    label: 'Összefésülés',
    positionX: 0,
    positionY: 0,
    config: { type: 'join', mode: 'merge', settings: {}, onUnhandledError: null },
  },
  loop: {
    id: 'n-loop',
    type: 'loop',
    label: 'Ciklus',
    positionX: 0,
    positionY: 0,
    config: { type: 'loop', maxIterations: 5, continueExpression: 'i < 5', onUnhandledError: null },
  },
  human_approval: {
    id: 'n-approval',
    type: 'human_approval',
    label: 'Jóváhagyás',
    positionX: 0,
    positionY: 0,
    config: {
      type: 'human_approval',
      title: 'Engedélyezed?',
      bodyTemplate: 'Kérlek erősítsd meg',
      timeoutMs: null,
      onUnhandledError: null,
    },
  },
  error_handler: {
    id: 'n-error-handler',
    type: 'error_handler',
    label: 'Hibakezelő',
    positionX: 0,
    positionY: 0,
    config: {
      type: 'error_handler',
      maxAttempts: 3,
      backoffMs: [1000, 2000],
      handledErrorKinds: ['timeout'],
      onUnhandledError: null,
    },
  },
  sub_workflow: {
    id: 'n-sub-workflow',
    type: 'sub_workflow',
    label: 'Al-workflow',
    positionX: 0,
    positionY: 0,
    config: { type: 'sub_workflow', targetWorkflowId: 'wf-1', inputMapping: {}, onUnhandledError: null },
  },
  script: {
    id: 'n-script',
    type: 'script',
    label: 'Szkript',
    positionX: 0,
    positionY: 0,
    config: { type: 'script', source: 'x + 1', runtime: 'expression', onUnhandledError: null },
  },
};

describe('GraphNodeCard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderNodes(flowNodes: GraphNodeCardFlowNode[]): void {
    act(() => {
      root.render(<ReactFlow nodes={flowNodes} edges={[]} nodeTypes={NODE_TYPES} />);
    });
  }

  function handleElements(kind: 'source' | 'target'): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>(`.react-flow__handle.${kind}`)];
  }

  function sourceHandleIds(): (string | undefined)[] {
    return handleElements('source').map((element) => element.dataset['handleid']);
  }

  it('a start bemenet nélküli, egy kimenő (névtelen) handle-t rajzol', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.start)]);
    expect(handleElements('target')).toHaveLength(0);
    expect(sourceHandleIds()).toEqual([undefined]);
  });

  it('az agent_step egy bemenő és egy névtelen kimenő handle-t rajzol', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.agent_step)]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual([undefined]);
  });

  it('a branch a config.branches listája szerint, plusz egy alapértelmezett handle-t rajzol', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.branch)]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual(['pos', 'neg', undefined]);
  });

  it('a branch node nulla kimenő handle-t rajzol, ha a config.type nem branch (a séma nem kapcsolja össze a két mezőt)', () => {
    renderNodes([
      buildFlowNode({
        ...WORKFLOW_NODES.branch,
        config: WORKFLOW_NODES.fan_out.config,
      }),
    ]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual([]);
  });

  it('a fan_out egy bemenő és egy névtelen kimenő handle-t rajzol', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.fan_out)]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual([undefined]);
  });

  it('a join egy bemenő és egy névtelen kimenő handle-t rajzol', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.join)]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual([undefined]);
  });

  it('a loop két, fenntartott azonosítójú kimenő handle-t rajzol (continue, exit)', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.loop)]);
    expect(sourceHandleIds()).toEqual(['continue', 'exit']);
  });

  it('a human_approval két, fenntartott azonosítójú kimenő handle-t rajzol (approved, rejected)', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.human_approval)]);
    expect(sourceHandleIds()).toEqual(['approved', 'rejected']);
  });

  it('az error_handler egy névtelen és egy on_error kimenő handle-t rajzol', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.error_handler)]);
    expect(sourceHandleIds()).toEqual([undefined, 'on_error']);
  });

  it('a sub_workflow egy bemenő és egy névtelen kimenő handle-t rajzol', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.sub_workflow)]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual([undefined]);
  });

  it('a script egy bemenő és egy névtelen kimenő handle-t rajzol, plusz figyelmeztetést', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.script)]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual([undefined]);
    expect(container.textContent).toContain('nincs implementálva');
  });

  it('a nem script típusok egyike sem jeleníti meg a script figyelmeztetést', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.agent_step)]);
    expect(container.textContent).not.toContain('nincs implementálva');
  });

  it.each(StepRunStatusSchema.options)('a "%s" StepRunStatus badge felirata megjelenik a kártyán', (status) => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.agent_step, status)]);
    expect(container.querySelector('.badge')).not.toBeNull();
  });

  it('futás állapot nélkül nincs badge a kártyán', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.agent_step)]);
    expect(container.querySelector('.badge')).toBeNull();
  });

  it('a node saját magyar címkéje megjelenik', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.human_approval)]);
    expect(container.textContent).toContain('Jóváhagyás');
  });
});
