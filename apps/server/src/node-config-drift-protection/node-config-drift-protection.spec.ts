/* eslint-disable unicorn/no-null -- a node config nullázható mezői a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, expectTypeOf, it } from 'vitest';
import { isRecord } from '@easter-workflow-builder/typeguards';
import {
  isNodeConfig,
  openDatabase,
  type DatabaseContext,
  type JoinUnselectedNodeConfig as DatabaseJoinUnselectedNodeConfig,
  type NodeConfig as DatabaseNodeConfig,
  type REQUIRED_TEXT_FIELD_PATHS as DATABASE_REQUIRED_TEXT_FIELD_PATHS,
} from '@easter-workflow-builder/db';
import {
  NodeConfigSaveSchema,
  NodeConfigSchema,
  REQUIRED_TEXT_FIELD_PATHS as PROTOCOL_REQUIRED_TEXT_FIELD_PATHS,
  type JoinUnselectedNodeConfig as ProtocolJoinUnselectedNodeConfig,
  type NodeConfig as ProtocolNodeConfig,
} from '@easter-workflow-builder/protocol';

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

  /**
   * A `join` uniója mindkét oldalon négy tagú: a három kiválasztott mód plusz
   * a választatlan, `mode: null` ág (SPEC-008 5.4, O-33). A szándékosan
   * elrontott próba (a negyedik ág kivétele az egyik oldalon) a
   * `docs/research/2026-10-14-kotelezo-mezok-es-start.md` fájlban.
   */
  it('a join négy tagú uniója és a választatlan ág (SPEC-008 O-33)', () => {
    expectTypeOf<Extract<ProtocolNodeConfig, { readonly type: 'join' }>>().toEqualTypeOf<
      Extract<DatabaseNodeConfig, { readonly type: 'join' }>
    >();
    expectTypeOf<Extract<ProtocolNodeConfig, { readonly type: 'join' }>['mode']>().toEqualTypeOf<
      'merge' | 'script' | 'ai_synthesis' | null
    >();
    expectTypeOf<ProtocolJoinUnselectedNodeConfig>().toEqualTypeOf<DatabaseJoinUnselectedNodeConfig>();
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
 * `isNodeConfig` guardján is (SPEC-005 7.6 2. pont mintája). A `join`
 * mind a négy ága szerepel, a választatlan (`mode: null`, SPEC-008 O-33) is;
 * az `onUnhandledError` itt `null` is lehet, mert az olvasó séma elfogadja.
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
  { type: 'join', mode: null, onUnhandledError: null },
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

function describeVariant(config: ProtocolNodeConfig): string {
  return config.type === 'join' ? `join ${String(config.mode)}` : config.type;
}

describe('a protokoll séma szerint érvényes érték a db isNodeConfig guardján is átmegy', () => {
  for (const candidate of REPRESENTATIVE_NODE_CONFIGS) {
    const parsed = NodeConfigSchema.safeParse(candidate);
    const label = parsed.success ? describeVariant(parsed.data) : 'ismeretlen';
    it(`${label} ág`, () => {
      expect(parsed.success).toBe(true);
      expect(isNodeConfig(candidate)).toBe(true);
    });
  }
});

/**
 * A kötelező szöveg mezők két táblájának sodródás elleni védelme (SPEC-008
 * 5.4, O-21, `.claude/CLAUDE.md` 5. szekció "A `protocol` a `db` írás oldali
 * 'kötelező szöveg mező' szabályát is duplikálhatja..."). A lista két helyen
 * áll: a `protocol` mentési sémájában (`NodeConfigSaveSchema`) és a `db`
 * `replaceGraph` írás oldali ellenőrzésében, mindkettő `as const satisfies`
 * táblában. A típusszintű ág a két tábla literál típusának egyenlősége: egy
 * táblából kivett vagy átírt mező a `bun run typecheck` kaput `TS2344`-es
 * hibával megbuktatja (a szándékosan elrontott próba a
 * `docs/research/2026-10-14-kotelezo-mezok-es-start.md` fájlban).
 */
describe('a protokoll és a db kötelező szöveg mező táblája kétirányban megegyezik', () => {
  it('REQUIRED_TEXT_FIELD_PATHS', () => {
    expectTypeOf<typeof PROTOCOL_REQUIRED_TEXT_FIELD_PATHS>().toEqualTypeOf<
      typeof DATABASE_REQUIRED_TEXT_FIELD_PATHS
    >();
  });
});

/**
 * Típusonként (a `join` módonként) egy egyébként érvényes, mentésre kész
 * konfig: minden listában pontosan egy elem áll, hogy a `*` útvonal elem a
 * 0. indexre mutasson, és az `onUnhandledError` ki van töltve, mert a
 * `protocol` mentési sémája a `null` értéket elutasítja (SPEC-008 5.4,
 * O-29); a `db` `replaceGraph` mindkét értéket elfogadja.
 */
const BASE_CONFIG_BY_VARIANT: Readonly<Record<string, unknown>> = {
  start: {
    type: 'start',
    inputFields: [{ name: 'topic', label: 'Téma', valueKind: 'string', required: true }],
    onUnhandledError: 'fail_run',
  },
  agent_step: { ...VALID_AGENT_STEP_SETTINGS, type: 'agent_step', onUnhandledError: 'fail_run' },
  branch: {
    type: 'branch',
    expression: 'x > 0',
    branches: [{ key: 'pos', label: 'Pozitív' }],
    defaultBranchKey: null,
    onUnhandledError: 'fail_run',
  },
  fan_out: { type: 'fan_out', itemsExpression: 'items', branchLabelTemplate: '{{item}}', onUnhandledError: 'fail_run' },
  'join.script': {
    type: 'join',
    mode: 'script',
    settings: { source: 'x + 1', runtime: 'expression' },
    onUnhandledError: 'fail_run',
  },
  'join.ai_synthesis': {
    type: 'join',
    mode: 'ai_synthesis',
    settings: VALID_AGENT_STEP_SETTINGS,
    onUnhandledError: 'fail_run',
  },
  loop: { type: 'loop', maxIterations: 10, continueExpression: 'i < 10', onUnhandledError: 'fail_run' },
  human_approval: {
    type: 'human_approval',
    title: 'Jóváhagyás',
    bodyTemplate: 'Engedélyezed?',
    timeoutMs: null,
    onUnhandledError: 'fail_run',
  },
  sub_workflow: { type: 'sub_workflow', targetWorkflowId: 'wf-1', inputMapping: {}, onUnhandledError: 'fail_run' },
  script: { type: 'script', source: 'x + 1', runtime: 'expression', onUnhandledError: 'fail_run' },
};

interface RequiredFieldCase {
  readonly variant: string;
  readonly path: string;
}

/**
 * A mezőnkénti esetek a `protocol` táblájából jönnek (a két tábla a fenti
 * típusszintű ág szerint azonos): egy mindkét táblába felvett új mező
 * külön teszteset nélkül is futásidejű próbát kap.
 */
const { join: PROTOCOL_JOIN_PATHS, ...PROTOCOL_PATHS_WITHOUT_JOIN } = PROTOCOL_REQUIRED_TEXT_FIELD_PATHS;

function toCases(variantPrefix: string, entries: readonly [string, readonly string[]][]): readonly RequiredFieldCase[] {
  return entries.flatMap(([key, paths]) => paths.map((path) => ({ variant: `${variantPrefix}${key}`, path })));
}

const REQUIRED_FIELD_CASES: readonly RequiredFieldCase[] = [
  ...toCases('', Object.entries(PROTOCOL_PATHS_WITHOUT_JOIN)),
  ...toCases('join.', Object.entries(PROTOCOL_JOIN_PATHS)),
];

/**
 * A `path` (`branches.*.key`) szerinti mező szövegét cseréli egy másolatban;
 * a `*` a lista 0. elemét jelenti.
 */
function withTextAt(value: unknown, segments: readonly string[], text: string): unknown {
  const [head, ...rest] = segments;
  if (head === undefined) {
    return text;
  }
  if (head === '*') {
    if (!Array.isArray(value)) {
      throw new TypeError('a `*` útvonal elem helyén nem lista áll');
    }
    return value.map((element: unknown, index: number) => (index === 0 ? withTextAt(element, rest, text) : element));
  }
  if (!isRecord(value)) {
    throw new TypeError(`a(z) "${head}" kulcs előtt nem objektum áll`);
  }
  return { ...value, [head]: withTextAt(value[head], rest, text) };
}

function configWith(variant: string, path: string, text: string): unknown {
  return withTextAt(BASE_CONFIG_BY_VARIANT[variant], path.split('.'), text);
}

function openDatabaseWithWorkflow(): { readonly database: DatabaseContext; readonly workflowId: string } {
  const opened = openDatabase(':memory:');
  if (opened.kind === 'error') {
    throw new Error(opened.message);
  }
  const workflow = opened.value.workflows.createWorkflow({ name: 'Sodródás', description: null, providerId: null });
  if (workflow.kind === 'error') {
    throw new Error(workflow.message);
  }
  return { database: opened.value, workflowId: workflow.value.id };
}

function replaceWithConfig(database: DatabaseContext, workflowId: string, candidate: unknown): string | undefined {
  if (!isNodeConfig(candidate)) {
    throw new TypeError('a próba konfig a db isNodeConfig guardján sem megy át');
  }
  const outcome = database.workflows.replaceGraph(
    workflowId,
    [{ id: 'node-1', label: '', positionX: 0, positionY: 0, config: candidate }],
    [],
  );
  return outcome.kind === 'error' ? outcome.message : undefined;
}

describe('a kötelező szöveg mezők mezőnként a protokoll mentési sémáján és a db replaceGraph hívásán is ugyanúgy döntenek', () => {
  it('a tábla mind a tizenhat mezőt felsorolja', () => {
    expect(REQUIRED_FIELD_CASES).toHaveLength(16);
  });

  for (const { variant, path } of REQUIRED_FIELD_CASES) {
    describe(`${variant}: ${path}`, () => {
      it('a nem üres érték mindkettőn átmegy', () => {
        const candidate = configWith(variant, path, 'érték');
        const { database, workflowId } = openDatabaseWithWorkflow();

        expect(NodeConfigSaveSchema.safeParse(candidate).success).toBe(true);
        expect(replaceWithConfig(database, workflowId, candidate)).toBeUndefined();
        database.close();
      });

      for (const [description, blank] of [
        ['üres', ''],
        ['csak szóközös', ' '.repeat(3)],
      ] as const) {
        it(`az ${description} érték mindkettőn elbukik, ugyanazon a mezőútvonalon`, () => {
          const candidate = configWith(variant, path, blank);
          const concretePath = path.replaceAll('*', '0');
          const { database, workflowId } = openDatabaseWithWorkflow();
          const parsed = NodeConfigSaveSchema.safeParse(candidate);

          expect(parsed.success).toBe(false);
          expect(parsed.error?.issues.map((issue) => issue.path.join('.'))).toEqual([concretePath]);
          expect(replaceWithConfig(database, workflowId, candidate)).toContain(
            `"${concretePath}" kötelező szöveg mezője üres (blank_required_text_field)`,
          );
          database.close();
        });
      }
    });
  }
});
