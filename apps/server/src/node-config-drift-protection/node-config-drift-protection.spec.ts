/* eslint-disable unicorn/no-null -- a node config nullázható mezői a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, expectTypeOf, it } from 'vitest';
import { isNodeConfig, type NodeConfig as DatabaseNodeConfig } from '@easter-workflow-builder/db';
import { NodeConfigSchema, type NodeConfig as ProtocolNodeConfig } from '@easter-workflow-builder/protocol';

/**
 * A `workflow_node.config` tíz ágú `NodeConfig` uniójának sodródás elleni
 * védelme (PLAN-009 T-009-13, SPEC-005 7.7 szekció, `.claude/CLAUDE.md` 5.
 * szekció "A `protocol` a `db` domain uniót is duplikálhatja..."). A
 * `packages/protocol` L1 réteg nem importálhatja a `packages/db` L2 réteg
 * `NodeConfig` unióját (SPEC-002 4. szekció) - mindkét oldal önállóan
 * deklarálja ugyanazt a tíz ágat. Az `apps/server` az egyetlen csomag, ahol a
 * két oldal egyszerre látszik, ezért a védelem ide kerül, az
 * `enum-drift-protection` téma öt elemű mintáját követve.
 *
 * **Ennek a mappának szándékosan nincs futásidejű forrásfájlja**
 * (`node-config-drift-protection.ts` nem létezik): a mappa neve azt nevezi
 * meg, amit őriz, ugyanaz a minta, mint az `enum-drift-protection` mappa. A
 * lefedettségi mérleget ezért ez a fájl nem érinti.
 *
 * **A típusszintű ág az erős védelem**: az `expectTypeOf(...).toEqualTypeOf<...>()`
 * hívás futásidőben csendben nem csinál semmit, kizárólag a TypeScript
 * fordító dönt a generikus paraméterek illeszkedéséről. Ha a két oldal
 * uniója akár egyetlen mezőben is eltér, a `bun run typecheck` kapu
 * fordítási hibával bukik. Ezt a viselkedést a végrehajtás során manuálisan
 * is igazoltuk: egy pillanatra szándékosan elrontott értéket
 * (`'fail_run_TYPO'` az `UnhandledErrorPolicySchema` egyik ágán) illesztve a
 * protokoll oldalra a `bun run typecheck` valóban `TS2344`-es hibával
 * bukott, majd az eredeti tartalom visszaállítása után újra zöld lett.
 *
 * **Az `AgentStepConfig.agents` és a `JoinMergeNodeConfig.settings` mező**
 * mindkét oldalon szándékosan nyitott `Record<string, unknown>` marad
 * (`.claude/CLAUDE.md` 5. szekció): ha bármelyik oldal ezt szűkítené, a
 * típusszintű egyenlőség itt megbukna.
 */
describe('a protokoll és a db NodeConfig uniója kétirányban megegyezik', () => {
  it('NodeConfig', () => {
    expectTypeOf<ProtocolNodeConfig>().toEqualTypeOf<DatabaseNodeConfig>();
  });
});

const VALID_AGENT_STEP_SETTINGS = {
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
};

/**
 * Mind a tíz ágra reprezentatív, érvényes érték: a protokoll séma
 * `.safeParse()`-ával validált alak minden esetben átmegy a `db`
 * `isNodeConfig` guardján is (SPEC-005 7.6 2. pont mintája).
 */
const REPRESENTATIVE_NODE_CONFIGS: readonly unknown[] = [
  {
    type: 'start',
    inputFields: [{ name: 'topic', label: 'Téma', valueKind: 'string', required: true }],
    onUnhandledError: null,
  },
  { ...VALID_AGENT_STEP_SETTINGS, type: 'agent_step', onUnhandledError: 'fail_run' },
  {
    type: 'branch',
    expression: 'x > 0',
    branches: [{ key: 'pos', label: 'Pozitív' }],
    defaultBranchKey: null,
    onUnhandledError: null,
  },
  { type: 'fan_out', itemsExpression: 'items', branchLabelTemplate: '{{item}}', onUnhandledError: null },
  { type: 'join', mode: 'merge', settings: { strategy: 'bármi' }, onUnhandledError: null },
  { type: 'join', mode: 'script', settings: { source: 'x + 1', runtime: 'expression' }, onUnhandledError: null },
  { type: 'join', mode: 'ai_synthesis', settings: VALID_AGENT_STEP_SETTINGS, onUnhandledError: null },
  { type: 'loop', maxIterations: 10, continueExpression: 'i < 10', onUnhandledError: null },
  {
    type: 'human_approval',
    title: 'Jóváhagyás',
    bodyTemplate: 'Engedélyezed?',
    timeoutMs: null,
    onUnhandledError: null,
  },
  {
    type: 'error_handler',
    maxAttempts: 3,
    backoffMs: [1000, 2000, 4000],
    handledErrorKinds: ['timeout'],
    onUnhandledError: null,
  },
  {
    type: 'sub_workflow',
    targetWorkflowId: 'wf-1',
    inputMapping: { topic: 'parent.topic' },
    onUnhandledError: null,
  },
  { type: 'script', source: 'x + 1', runtime: 'expression', onUnhandledError: null },
];

describe('a protokoll séma szerint érvényes érték a db isNodeConfig guardján is átmegy', () => {
  for (const candidate of REPRESENTATIVE_NODE_CONFIGS) {
    const parsed = NodeConfigSchema.safeParse(candidate);
    const label = parsed.success ? parsed.data.type : 'ismeretlen';
    it(`${label} ág`, () => {
      expect(parsed.success).toBe(true);
      expect(isNodeConfig(candidate)).toBe(true);
    });
  }
});
