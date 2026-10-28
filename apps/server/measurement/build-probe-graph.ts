import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';

/* eslint-disable unicorn/no-null -- a node config nullázható mezői és az él kezelő és ág kulcs mezői valódi NULL értéket tárolnak (SPEC-003 4.4), a próba effortjának hiánya is `null` */
/**
A próba lépésének modellje `minimax` providernél (SPEC-013 6., a SPEC-012 5.1 táblázatát felülírva).
*/
const MINIMAX_MODEL_ID = 'MiniMax-M3.1-Flash';

/**
A próba lépésének alapmodellje `claude-subscription` providernél: a katalógusban álló, a pinelt CLI által
ismert legkisebb modell (SPEC-013 1. szekció 3. döntés, research 10.1).
*/
const CLAUDE_SUBSCRIPTION_MODEL_ID = 'claude-haiku-4-5';

/**
A próba effortja providerenként (SPEC-013 6., O-6): `minimax` mellett `low` (a Flash elfogadja, research
2.), `claude-subscription` mellett nincs, mert a `claude-haiku-4-5` az effortot nem támogatja (research 10.2).
*/
const PROBE_EFFORT: Readonly<Record<ProviderId, 'low' | null>> = {
  minimax: 'low',
  'claude-subscription': null,
};

/**
Rövid, eszközt nem kérő prompt: a pontos szöveg a próba kódjában áll, nem döntés (SPEC-012 5.1 táblázat).
*/
const PROBE_PROMPT = 'Válaszolj egyetlen rövid mondattal: mire jó egy "hello world" program? Eszközt ne használj.';

export interface ProbeGraph {
  readonly nodes: readonly WorkflowNodeInput[];
  readonly edges: readonly WorkflowEdgeInput[];
}

/**
 * A minimális gráf: Start és egyetlen `agent_step` (SPEC-012 5.1 2. lépés).
 * A lépés beállításai az 5.1 táblázat szerintiek: `maxTurns: 1`, nincs
 * `maxBudgetUsd`, nincs eszköz tiltás, nincs időkorlát. A modell és az effort
 * a SPEC-013 6. szekciója szerint: `minimax` esetén `MiniMax-M3.1-Flash` és
 * `low`, `claude-subscription` esetén `claude-haiku-4-5` és effort nélkül; a
 * hívó a `modelIdOverride` paraméterrel más modellt adhat.
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
          modelId: modelIdOverride ?? (providerId === 'minimax' ? MINIMAX_MODEL_ID : CLAUDE_SUBSCRIPTION_MODEL_ID),
          effort: PROBE_EFFORT[providerId],
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
