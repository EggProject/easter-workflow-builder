import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';

/**
A próba lépésének modellje `minimax` providernél (SPEC-012 5.1 táblázat, O-14 ... O-17).
*/
const MINIMAX_MODEL_ID = 'MiniMax-M3';

/**
Rövid, eszközt nem kérő prompt: a pontos szöveg a próba kódjában áll, nem döntés (SPEC-012 5.1 táblázat).
*/
const PROBE_PROMPT = 'Válaszolj egyetlen rövid mondattal: mire jó egy "hello world" program? Eszközt ne használj.';

export interface ProbeGraph {
  readonly nodes: readonly WorkflowNodeInput[];
  readonly edges: readonly WorkflowEdgeInput[];
}

/* eslint-disable unicorn/no-null -- a node config nullázható mezői és az él kezelő és ág kulcs mezői valódi NULL értéket tárolnak (SPEC-003 4.4) */
/**
 * A minimális gráf: Start és egyetlen `agent_step` (SPEC-012 5.1 2. lépés).
 * A lépés beállításai az 5.1 táblázat szerintiek: `maxTurns: 1`, nincs
 * `maxBudgetUsd`, nincs eszköz tiltás, nincs időkorlát. `minimax` esetén a
 * modell `MiniMax-M3`; `claude-subscription` esetén alapból nincs `modelId`
 * (a SPEC-012 5.1 táblázata szerint), de a motor több modellű leírónál
 * `model_not_selected` hibával elutasítja a futást, ezért a hívó a
 * `modelIdOverride` paraméterrel adhat modellt (nyitott kérdés, lásd a
 * PLAN-013 T-013-9 jelentését).
 */
export function buildProbeGraph(providerId: ProviderId, modelIdOverride?: string): ProbeGraph {
  return {
    nodes: [
      {
        id: 'start',
        type: 'start',
        label: 'start',
        positionX: 0,
        positionY: 0,
        config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
      },
      {
        id: 'proba',
        type: 'agent_step',
        label: 'proba',
        positionX: 200,
        positionY: 0,
        config: {
          type: 'agent_step',
          onUnhandledError: 'fail_run',
          promptTemplate: PROBE_PROMPT,
          providerId,
          modelId: modelIdOverride ?? (providerId === 'minimax' ? MINIMAX_MODEL_ID : null),
          effort: null,
          thinking: null,
          allowedTools: [],
          disallowedTools: [],
          permissionMode: null,
          maxTurns: 1,
          maxBudgetUsd: null,
          systemPrompt: null,
          agents: {},
          skills: null,
          mcpServers: {},
          cwd: null,
          additionalDirectories: [],
          sandbox: null,
          sessionMode: 'isolated',
          structuredOutput: null,
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        sourceNodeId: 'start',
        targetNodeId: 'proba',
        sourceHandle: null,
        targetHandle: null,
        branchKey: null,
      },
    ],
  };
}
/* eslint-enable unicorn/no-null */
