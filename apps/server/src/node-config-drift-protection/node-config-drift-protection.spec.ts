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
  cwd: null,
  additionalDirectories: [],
  sandbox: null,
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

interface NumberFieldCase {
  readonly field: string;
  readonly path: string;
  readonly build: (value: number) => unknown;
}

/**
 * A pozitív egész szám mezők (SPEC-008 5.4, O-37): a `protocol` mentési
 * sémájának szabálya a `db` `isNodeConfig` guard pozitív egész szabályának
 * (`isPositiveInteger`, SPEC-003 4.3) szándékos duplikátuma. A `db` oldalon
 * nincs mezőtábla, tehát típusszintű ág sem: a védelem mezőnként futásidejű,
 * a mezők listája itt, a `db` guardjából kiolvasva áll (`loop.maxIterations`,
 * `error_handler.maxAttempts`, `error_handler.backoffMs` minden eleme). A
 * szándékosan elrontott próba (a szabály kivétele az egyik oldalon) a
 * `docs/research/2026-10-17-szam-es-agent-mezok.md` fájlban.
 */
const POSITIVE_INTEGER_FIELD_CASES: readonly NumberFieldCase[] = [
  {
    field: 'loop: maxIterations',
    path: 'maxIterations',
    build: (value) => ({
      type: 'loop',
      maxIterations: value,
      continueExpression: 'i < 3',
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'error_handler: maxAttempts',
    path: 'maxAttempts',
    build: (value) => ({
      type: 'error_handler',
      maxAttempts: value,
      backoffMs: [100, 200, 400],
      handledErrorKinds: [],
      onUnhandledError: 'fail_run',
    }),
  },
  ...[0, 1, 2].map((index): NumberFieldCase => ({
    field: `error_handler: backoffMs.${String(index)}`,
    path: `backoffMs.${String(index)}`,
    build: (value) => ({
      type: 'error_handler',
      maxAttempts: 3,
      backoffMs: [100, 200, 400].map((delay, position) => (position === index ? value : delay)),
      handledErrorKinds: [],
      onUnhandledError: 'fail_run',
    }),
  })),
];

/**
 * A többi szám mező egyik oldalon sem tartozik a pozitív egész szabály alá: ha
 * a `db` guard egyszer szigorítana rajtuk, ez az ág bukik, és a `protocol`
 * mentési sémájának is követnie kell.
 */
const UNRESTRICTED_NUMBER_FIELD_CASES: readonly NumberFieldCase[] = [
  {
    field: 'human_approval: timeoutMs',
    path: 'timeoutMs',
    build: (value) => ({
      type: 'human_approval',
      title: 'Jóváhagyás',
      bodyTemplate: 'Engedélyezed?',
      timeoutMs: value,
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'agent_step: maxTurns',
    path: 'maxTurns',
    build: (value) => ({
      ...VALID_AGENT_STEP_SETTINGS,
      maxTurns: value,
      type: 'agent_step',
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'agent_step: maxBudgetUsd',
    path: 'maxBudgetUsd',
    build: (value) => ({
      ...VALID_AGENT_STEP_SETTINGS,
      maxBudgetUsd: value,
      type: 'agent_step',
      onUnhandledError: 'fail_run',
    }),
  },
];

const NOT_POSITIVE_INTEGER_VALUES = [
  ['nulla', 0],
  ['negatív', -3],
  ['nem egész', 1.5],
] as const;

describe('a pozitív egész szám mezők mezőnként a protokoll mentési sémáján és a db isNodeConfig guardján is ugyanúgy döntenek', () => {
  for (const { field, path, build } of POSITIVE_INTEGER_FIELD_CASES) {
    describe(field, () => {
      it('a pozitív egész mindkettőn átmegy', () => {
        expect(NodeConfigSaveSchema.safeParse(build(5)).success).toBe(true);
        expect(isNodeConfig(build(5))).toBe(true);
      });

      for (const [description, value] of NOT_POSITIVE_INTEGER_VALUES) {
        it(`a ${description} érték (${String(value)}) mindkettőn elbukik, a protokoll a mező útvonalán`, () => {
          const parsed = NodeConfigSaveSchema.safeParse(build(value));

          expect(parsed.success).toBe(false);
          expect(parsed.error?.issues.map((issue) => issue.path.join('.'))).toEqual([path]);
          expect(isNodeConfig(build(value))).toBe(false);
        });
      }
    });
  }

  for (const { field, build } of UNRESTRICTED_NUMBER_FIELD_CASES) {
    for (const [description, value] of NOT_POSITIVE_INTEGER_VALUES) {
      it(`${field}: a ${description} érték (${String(value)}) mindkettőn átmegy, a szabály alá nem tartozik`, () => {
        expect(NodeConfigSaveSchema.safeParse(build(value)).success).toBe(true);
        expect(isNodeConfig(build(value))).toBe(true);
      });
    }
  }
});

const SAVABLE_AGENT_STEP = { ...VALID_AGENT_STEP_SETTINGS, type: 'agent_step', onUnhandledError: 'fail_run' };

/**
 * A mentési séma és a `db` `isNodeConfig` guard egyezése a guard minden
 * ellenőrzött alakján, a szám mezőkön túl (T-009-60): a szerver `PUT .../graph`
 * kezelője a `config` mezőt a mentési séma után guard nélkül adja át a `db`-nek,
 * mert egy ottani `isNodeConfig` hibaág a HTTP úton garantáltan sosem futna
 * (`docs/research/2026-10-17-szam-es-agent-mezok.md`). Ha egy eset itt eltér, a
 * két oldal szétvált, és a kezelő a `db`-be a guardon elbukó konfigot írhatna.
 */
const SAVE_SCHEMA_GUARD_AGREEMENT_CASES: readonly {
  readonly label: string;
  readonly config: unknown;
  readonly accepted: boolean;
}[] = [
  {
    label: 'preset rendszer prompt minden mezővel',
    config: {
      ...SAVABLE_AGENT_STEP,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: null, excludeDynamicSections: null },
    },
    accepted: true,
  },
  {
    label: 'preset rendszer prompt append nélkül',
    config: {
      ...SAVABLE_AGENT_STEP,
      systemPrompt: { type: 'preset', preset: 'claude_code', excludeDynamicSections: null },
    },
    accepted: false,
  },
  {
    label: 'stdio MCP szerver envNames nélkül',
    config: { ...SAVABLE_AGENT_STEP, mcpServers: { a: { type: 'stdio', command: 'x', args: [] } } },
    accepted: false,
  },
  {
    label: 'http MCP szerver authEnvName mezővel',
    config: { ...SAVABLE_AGENT_STEP, mcpServers: { a: { type: 'http', url: 'u', authEnvName: null } } },
    accepted: true,
  },
  { label: 'skills: all', config: { ...SAVABLE_AGENT_STEP, skills: 'all' }, accepted: true },
  { label: 'ismeretlen skills szöveg', config: { ...SAVABLE_AGENT_STEP, skills: 'none' }, accepted: false },
  { label: 'hiányos sandbox', config: { ...SAVABLE_AGENT_STEP, sandbox: { enabled: true } }, accepted: false },
  {
    label: 'strukturált kimenet schema kulcs nélkül',
    config: { ...SAVABLE_AGENT_STEP, structuredOutput: { strategy: 'sdk_output_format' } },
    accepted: false,
  },
  { label: 'szám effort', config: { ...SAVABLE_AGENT_STEP, effort: 3 }, accepted: false },
  { label: 'tetszőleges effort szöveg', config: { ...SAVABLE_AGENT_STEP, effort: 'whatever' }, accepted: true },
  { label: 'negatív maxTurns', config: { ...SAVABLE_AGENT_STEP, maxTurns: -1 }, accepted: true },
  {
    label: 'start bemeneti mező required nélkül',
    config: {
      type: 'start',
      inputFields: [{ name: 'a', label: 'b', valueKind: 'string' }],
      onUnhandledError: 'fail_run',
    },
    accepted: false,
  },
  {
    label: 'branch defaultBranchKey nélkül',
    config: { type: 'branch', expression: 'x', branches: [], onUnhandledError: 'fail_run' },
    accepted: false,
  },
  {
    label: 'sub_workflow nem szöveg inputMapping értékkel',
    config: { type: 'sub_workflow', targetWorkflowId: 'w', inputMapping: { a: 1 }, onUnhandledError: 'fail_run' },
    accepted: false,
  },
  {
    label: 'join merge lista settings értékkel',
    config: { type: 'join', mode: 'merge', settings: [], onUnhandledError: 'fail_run' },
    accepted: false,
  },
  {
    label: 'human_approval timeoutMs nélkül',
    config: { type: 'human_approval', title: 't', bodyTemplate: 'b', onUnhandledError: 'fail_run' },
    accepted: false,
  },
  {
    label: 'human_approval végtelen timeoutMs',
    config: {
      type: 'human_approval',
      title: 't',
      bodyTemplate: 'b',
      timeoutMs: Infinity,
      onUnhandledError: 'fail_run',
    },
    accepted: false,
  },
  {
    label: 'loop végtelen maxIterations',
    config: { type: 'loop', maxIterations: Infinity, continueExpression: 'x', onUnhandledError: 'fail_run' },
    accepted: false,
  },
  {
    label: 'error_handler nagy pozitív egészekkel',
    config: {
      type: 'error_handler',
      maxAttempts: 2 ** 60,
      backoffMs: [2 ** 60],
      handledErrorKinds: [],
      onUnhandledError: 'fail_run',
    },
    accepted: true,
  },
];

describe('a mentési séma és a db isNodeConfig guard a guard ellenőrzött alakjain ugyanúgy dönt (T-009-60)', () => {
  for (const { label, config, accepted } of SAVE_SCHEMA_GUARD_AGREEMENT_CASES) {
    it(label, () => {
      expect(NodeConfigSaveSchema.safeParse(config).success).toBe(accepted);
      expect(isNodeConfig(config)).toBe(accepted);
    });
  }
});

/**
 * Az ismeretlen kulcs szabálya mindkét oldalon (SPEC-011 5.2, user döntés
 * 2026-10-26, O-3): a `protocol` olvasó és mentési sémája `z.strictObject`
 * alapú, a `db` `isNodeConfig` guardja zárt kulcslistákkal dolgozik. Ha egy
 * eset itt eltér, a két oldal ismeretlen kulcs szabálya szétvált: a `db` egy
 * olyan konfigot is tárolna (vagy elutasítana), amit a protokoll nem.
 */
const UNKNOWN_KEY = 'ismeretlenKulcs';

function describeCandidate(config: unknown): string {
  const parsed = NodeConfigSchema.safeParse(config);
  return parsed.success ? describeVariant(parsed.data) : 'ismeretlen';
}

const UNKNOWN_KEY_CASES: readonly { readonly label: string; readonly config: unknown }[] = [
  ...REPRESENTATIVE_NODE_CONFIGS.map((config) => ({
    label: `${describeCandidate(config)} gyökere`,
    config: isRecord(config) ? { ...config, [UNKNOWN_KEY]: true } : config,
  })),
  {
    label: 'start bemeneti mezője',
    config: {
      type: 'start',
      inputFields: [{ name: 'topic', label: 'Téma', valueKind: 'string', required: true, [UNKNOWN_KEY]: true }],
      onUnhandledError: 'fail_run',
    },
  },
  {
    label: 'branch opciója',
    config: {
      type: 'branch',
      expression: 'x > 0',
      branches: [{ key: 'pos', label: 'Pozitív', [UNKNOWN_KEY]: true }],
      defaultBranchKey: null,
      onUnhandledError: 'fail_run',
    },
  },
  {
    label: 'join script settings alobjektuma',
    config: {
      type: 'join',
      mode: 'script',
      settings: { source: 'x + 1', runtime: 'expression', [UNKNOWN_KEY]: true },
      onUnhandledError: 'fail_run',
    },
  },
  {
    label: 'join ai_synthesis settings alobjektuma',
    config: {
      type: 'join',
      mode: 'ai_synthesis',
      settings: { ...VALID_AGENT_STEP_SETTINGS, [UNKNOWN_KEY]: true },
      onUnhandledError: 'fail_run',
    },
  },
  {
    label: 'preset rendszer prompt',
    config: {
      ...SAVABLE_AGENT_STEP,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: null,
        excludeDynamicSections: null,
        [UNKNOWN_KEY]: 1,
      },
    },
  },
  {
    label: 'strukturált kimenet',
    config: {
      ...SAVABLE_AGENT_STEP,
      structuredOutput: { strategy: 'sdk_output_format', schema: {}, [UNKNOWN_KEY]: 1 },
    },
  },
  {
    label: 'sandbox',
    config: {
      ...SAVABLE_AGENT_STEP,
      sandbox: {
        enabled: true,
        failIfUnavailable: false,
        autoAllowBashIfSandboxed: true,
        excludedCommands: [],
        enableWeakerNestedSandbox: false,
        [UNKNOWN_KEY]: 1,
      },
    },
  },
  {
    label: 'stdio MCP szerver',
    config: {
      ...SAVABLE_AGENT_STEP,
      mcpServers: { a: { type: 'stdio', command: 'x', args: [], envNames: [], [UNKNOWN_KEY]: 1 } },
    },
  },
  {
    label: 'sse MCP szerver',
    config: {
      ...SAVABLE_AGENT_STEP,
      mcpServers: { a: { type: 'sse', url: 'u', authEnvName: null, [UNKNOWN_KEY]: 1 } },
    },
  },
  {
    label: 'http MCP szerver',
    config: {
      ...SAVABLE_AGENT_STEP,
      mcpServers: { a: { type: 'http', url: 'u', authEnvName: null, [UNKNOWN_KEY]: 1 } },
    },
  },
];

describe('egy ismeretlen kulcs a protokoll sémáin és a db isNodeConfig guardján is elbukik (SPEC-011 5.2)', () => {
  it('az esetek a tíz típust, a join mind a négy ágát és a beágyazott objektumokat lefedik', () => {
    expect(UNKNOWN_KEY_CASES).toHaveLength(REPRESENTATIVE_NODE_CONFIGS.length + 10);
  });

  for (const { label, config } of UNKNOWN_KEY_CASES) {
    it(label, () => {
      expect(NodeConfigSchema.safeParse(config).success).toBe(false);
      expect(NodeConfigSaveSchema.safeParse(config).success).toBe(false);
      expect(isNodeConfig(config)).toBe(false);
    });
  }
});

const FREE_FIELD_CASES: readonly { readonly label: string; readonly config: unknown }[] = [
  {
    label: 'agents: tetszőleges név és belső kulcs',
    config: { ...SAVABLE_AGENT_STEP, agents: { barmi: { [UNKNOWN_KEY]: { melyen: [1] } } } },
  },
  {
    label: 'join merge settings: tetszőleges kulcs',
    config: {
      type: 'join',
      mode: 'merge',
      settings: { [UNKNOWN_KEY]: { melyen: true } },
      onUnhandledError: 'fail_run',
    },
  },
  {
    label: 'structuredOutput.schema: tetszőleges kulcs',
    config: {
      ...SAVABLE_AGENT_STEP,
      structuredOutput: { strategy: 'sdk_output_format', schema: { type: 'object', [UNKNOWN_KEY]: 1 } },
    },
  },
  {
    label: 'sandbox öt nyitott mezője: tetszőleges belső kulcs',
    config: {
      ...SAVABLE_AGENT_STEP,
      sandbox: {
        enabled: true,
        failIfUnavailable: false,
        autoAllowBashIfSandboxed: true,
        excludedCommands: [],
        enableWeakerNestedSandbox: false,
        allowUnsandboxedCommands: { [UNKNOWN_KEY]: 1 },
        network: { [UNKNOWN_KEY]: 1 },
        filesystem: { [UNKNOWN_KEY]: 1 },
        ignoreViolations: { [UNKNOWN_KEY]: 1 },
        ripgrep: { [UNKNOWN_KEY]: 1 },
      },
    },
  },
  {
    label: 'sub_workflow inputMapping: tetszőleges kulcs',
    config: {
      type: 'sub_workflow',
      targetWorkflowId: 'wf-1',
      inputMapping: { [UNKNOWN_KEY]: 'parent.topic' },
      onUnhandledError: 'fail_run',
    },
  },
];

describe('a szabadon maradó mezők tetszőleges kulcsa mindkét oldalon átmegy (SPEC-011 5.2)', () => {
  for (const { label, config } of FREE_FIELD_CASES) {
    it(label, () => {
      expect(NodeConfigSchema.safeParse(config).success).toBe(true);
      expect(NodeConfigSaveSchema.safeParse(config).success).toBe(true);
      expect(isNodeConfig(config)).toBe(true);
    });
  }
});
