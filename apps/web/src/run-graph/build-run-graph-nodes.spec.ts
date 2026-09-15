/* eslint-disable unicorn/no-null -- a szintetikus fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { StepRunRecord, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { buildRunGraphNodes } from './build-run-graph-nodes.ts';

const BASE_STEP_RUN: StepRunRecord = {
  id: 's-1',
  runId: 'r-1',
  nodeId: 'n-agent',
  nodeType: 'agent_step',
  parentStepRunId: null,
  iteration: 0,
  attempt: 1,
  status: 'running',
  providerId: 'minimax',
  modelId: null,
  sessionMode: null,
  sdkSessionId: null,
  resumedFromSessionId: null,
  forkedSession: false,
  structuredOutputStrategy: null,
  output: null,
  resultSubtype: null,
  numTurns: null,
  inputTokens: null,
  outputTokens: null,
  cacheReadInputTokens: null,
  cacheCreationInputTokens: null,
  subWorkflowRunId: null,
  errorKind: null,
  errorMessage: null,
  startedAtMs: 100,
  finishedAtMs: null,
  createdAtMs: 100,
};

const AGENT_NODE: WorkflowNodeInput = {
  id: 'n-agent',
  type: 'agent_step',
  label: 'Összefoglaló',
  positionX: 0,
  positionY: 0,
  config: {
    type: 'agent_step',
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
    sessionMode: 'isolated',
    structuredOutput: null,
    onUnhandledError: null,
  },
};

describe('buildRunGraphNodes', () => {
  it('lépés futás nélküli csomópontra nem tesz fel status kulcsot', () => {
    const built = buildRunGraphNodes([AGENT_NODE], new Map());

    expect(built).toHaveLength(1);
    expect(built[0]?.workflowNode.id).toBe('n-agent');
    expect(Object.hasOwn(built[0] ?? {}, 'status')).toBe(false);
  });

  it('a megjelenített lépés futás állapotát teszi a kártya adatába', () => {
    const built = buildRunGraphNodes(
      [AGENT_NODE],
      new Map([
        [
          'n-agent',
          [
            { ...BASE_STEP_RUN, id: 's-early', status: 'failed', createdAtMs: 100 },
            { ...BASE_STEP_RUN, id: 's-late', status: 'running', createdAtMs: 200 },
          ],
        ],
      ]),
    );

    expect(built[0]?.status).toBe('running');
  });
});
