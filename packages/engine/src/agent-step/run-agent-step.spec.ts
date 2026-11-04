/* eslint-disable unicorn/no-null -- a `SnapshotEdge`, a `SnapshotWorkflow.description`, a `CreateStepRunInput` és az `AgentStepConfig` nullázható mezői a tárolt alakban `null` értéket hordoznak (SPEC-003 4.3, 4.4, 5.1, 9.2), nem helyőrző `undefined`-et */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  type AgentQueryRequest,
  type AgentQueryRunner,
  compileStructuredOutputSchema,
} from '@easter-workflow-builder/agent';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type {
  AgentStepConfig,
  DatabaseContext,
  NodeType,
  SnapshotEdge,
  SnapshotNode,
} from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import { isRecord } from '@easter-workflow-builder/typeguards';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import type { SkillLibraryPort } from '../engine-port/skill-library-port.ts';
import type { TemplateRendererPort } from '../engine-port/template-renderer-port.ts';
import { createAgentQueryRegistry } from '../run-interrupt/agent-query-registry.ts';
import type { AgentStepCapabilityDecisions } from './agent-step-capability-decisions.ts';
import type { AgentStepExecution } from './agent-step-execution.ts';
import type { AgentStepRequest } from './agent-step-request.ts';
import { runAgentStep } from './run-agent-step.ts';
import type { StructuredOutputSchemaCompilerPort } from '../engine-port/structured-output-schema-compiler-port.ts';

function ignoreLogLine(): void {
  // szándékosan üres: a teszt nem a fordító naplóját vizsgálja
}

const SCHEMA_COMPILER: StructuredOutputSchemaCompilerPort = {
  compile: (schema) =>
    compileStructuredOutputSchema(schema, { info: ignoreLogLine, warn: ignoreLogLine, error: ignoreLogLine }),
};

/**
 * A strukturált kimenetet váró lépés kérésének két mezője: a config sémája és a
 * futás indításakor (itt a teszt által) lefordított ellenőrző (SPEC-015 5.4).
 */
function structuredOutputParts(schema: unknown): Pick<AgentStepRequest, 'config' | 'structuredOutputValidator'> {
  const compiled = SCHEMA_COMPILER.compile(schema);
  if (compiled.kind === 'error') {
    throw new Error(compiled.message);
  }
  return {
    config: agentStepConfig({ structuredOutput: { strategy: 'sdk_output_format', schema } }),
    structuredOutputValidator: compiled.value,
  };
}

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

// Lokális, tesztre szűkített guardok: a commitolt fixture JSON gyökere rekord,
// a sorozatai tömbök. A megosztott `typeguards` csomag nem hordoz tömb guardot
// `unknown` elemtípusra, és egy tesztfájl kedvéért nem is bővítjük.
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isFixtureRoot(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A commitolt SDK üzenet fixture egy sorozata (SPEC-004 14.1, 67. elfogadási
 * kritérium): a teszt soha nem hív valós API-t, az üzenetek fájlból jönnek.
 */
function fixtureMessages(name: string): readonly unknown[] {
  const text = readFileSync(new URL('agent-step-messages-fixture.json', import.meta.url), 'utf8');
  const parsed: unknown = JSON.parse(text);
  const sequence = isFixtureRoot(parsed) ? parsed[name] : undefined;
  if (!isUnknownArray(sequence)) {
    throw new Error(`a(z) ${name} fixture sorozat hiányzik vagy nem tömb`);
  }
  return sequence;
}

function node(id: string, type: NodeType): SnapshotNode {
  return { id, type, label: id, position: { x: 0, y: 0 }, config: {}, effectiveProviderId: 'minimax' };
}

function edge(id: string, sourceNodeId: string, targetNodeId: string): SnapshotEdge {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey: null };
}

// start -> s (agent) -> a (agent): az `a` node folytathatja az `s` sessionjét.
const graph: ExecutableGraph = buildExecutableGraph({
  version: 1,
  sdkVersionPin: '0.0.0-teszt',
  workflow: { id: 'wf', name: 'teszt', description: null },
  nodes: [node('start', 'start'), node('s', 'agent_step'), node('a', 'agent_step')],
  edges: [edge('e1', 'start', 's'), edge('e2', 's', 'a')],
});

function agentStepConfig(overrides: Partial<AgentStepConfig> = {}): AgentStepConfig {
  return {
    promptTemplate: 'Számold ki: {{bemenet}}',
    providerId: null,
    modelId: 'modell-1',
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
    ...overrides,
  };
}

const decisions: AgentStepCapabilityDecisions = {
  model: { outgoingModel: 'modell-1-kliens', modelIdentifierUnproven: false },
  structuredOutput: undefined,
  thinking: undefined,
  effort: undefined,
  disallowedServerTools: { disallowedTools: [], serverToolAvailabilityUnproven: false },
  includePartialMessages: true,
};

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

// Valós `workflow`, `workflow_run` és `step_run` sor: a `run_event` idegen
// kulcsai miatt kell, és a teszt így a commitolt migrációkkal felépült
// adatbázis ellen fut (SPEC-004 14.4).
function seedRun(
  database: DatabaseContext,
  workflowBuiltinSkillsEnabled: boolean | null = null,
): { readonly runId: string; readonly stepRunId: string } {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({
      name: 'agent-step teszt',
      description: null,
      providerId: null,
      builtinSkillsEnabled: workflowBuiltinSkillsEnabled,
    }),
  );
  const snapshot = {
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: workflow.id, name: workflow.name, description: null },
    nodes: [],
    edges: [],
  } as const;
  const run = okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'minimax',
      graphSnapshotDocument: snapshot,
    }),
  );
  const stepRun = okOrThrow(
    database.stepRuns.createStepRun({
      runId: run.id,
      nodeId: 'a',
      nodeType: 'agent_step',
      parentStepRunId: null,
      providerId: 'minimax',
      modelId: 'modell-1',
      sessionMode: 'isolated',
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    }),
  );
  return { runId: run.id, stepRunId: stepRun.id };
}

function messageIterable(messages: readonly unknown[]): AsyncIterable<unknown> {
  return {
    [Symbol.asyncIterator]: () => {
      let index = 0;
      return {
        next: (): Promise<IteratorResult<unknown>> => {
          const value = messages[index];
          index += 1;
          return Promise.resolve(value === undefined ? { done: true, value: undefined } : { done: false, value });
        },
      };
    },
  };
}

/**
 * Lassú, kézzel vezérelt üzenetfolyam: az `init` üzenet után a generátor a
 * `release()` hívásig felfüggesztve marad, tehát a teszt szimulálni tudja,
 * hogy a lépés MÉG FUT, amikor a megszakítás megérkezik (SPEC-004 9. szekció
 * 4. pont). A `release()` UTÁN érkező `result` üzenet igazolja, hogy a
 * megszakítás utáni esemény is beíródik.
 */
function controlledMessageIterable(): { readonly messages: AsyncIterable<unknown>; readonly release: () => void } {
  const { promise: gate, resolve: releaseGate } = Promise.withResolvers<undefined>();

  async function* generate(): AsyncGenerator {
    yield { type: 'system', subtype: 'init', session_id: 'session-lassu', uuid: 'lassu-1' };
    await gate;
    yield {
      type: 'result',
      subtype: 'success',
      session_id: 'session-lassu',
      uuid: 'lassu-2',
      num_turns: 1,
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    };
  }

  return {
    messages: generate(),
    release: () => {
      releaseGate(undefined);
    },
  };
}

interface CapturedRequest {
  request: AgentQueryRequest | undefined;
}

function newCapture(): CapturedRequest {
  return { request: undefined };
}

function fakeRunner(messages: readonly unknown[], captured: CapturedRequest): AgentQueryRunner {
  return {
    run: (request) => {
      captured.request = request;
      return {
        kind: 'ok',
        value: { messages: messageIterable(messages), interrupt: () => Promise.resolve() },
      };
    },
  };
}

const notCalled = (): never => {
  throw new Error('ebben a tesztben nem hívott port');
};

// Az alapértelmezett kiadó nyelő: a legtöbb teszt nem a kimenő eseményeket
// vizsgálja, de a port hívása így is megtörténik.
const discardedEvents: unknown[] = [];

// Az alapértelmezett regiszter: a legtöbb teszt csak a lépés eredményét
// vizsgálja, a regisztráció/leiratkozás bekötését az "a query azonnal
// regisztrálódik..." teszt ellenőrzi, a saját, dedikált példányán.
const agentQueryRegistry = createAgentQueryRegistry();

interface DependencyParts {
  readonly database: DatabaseContext;
  readonly agentQueryRunner: AgentQueryRunner;
  readonly templateRenderer?: TemplateRendererPort;
  readonly processEnvironment?: ProcessEnvironmentPort;
  readonly eventPublisher?: EventPublisherPort;
  readonly skillLibrary?: SkillLibraryPort;
}

function dependenciesOf(parts: DependencyParts): EngineDependencies {
  const renderer: TemplateRendererPort = {
    render: (template) => ({ kind: 'ok', value: `renderelt: ${template}` }),
    compile: notCalled,
  };
  const publisher: EventPublisherPort = {
    publish: (event) => {
      discardedEvents.push(event);
    },
  };
  return {
    database: parts.database,
    agentQueryRunner: parts.agentQueryRunner,
    providerDescriptorLookup: notCalled,
    expressionEvaluator: { evaluate: notCalled, compile: notCalled },
    templateRenderer: parts.templateRenderer ?? renderer,
    eventPublisher: parts.eventPublisher ?? publisher,
    clock: { nowMs: () => 0, sleep: notCalled },
    idGenerator: { nextId: notCalled },
    processEnvironment: parts.processEnvironment ?? { read: () => null, readAll: () => ({}) },
    structuredOutputSchemaCompiler: SCHEMA_COMPILER,
    scriptRunner: { compile: notCalled, run: notCalled },
    skillLibrary: parts.skillLibrary ?? {
      readSkillLibrary: () => ({ rootDirectory: '/skill-konyvtar', pluginName: 'skill-konyvtar', skillNames: [] }),
    },
  };
}

function requestOf(overrides: Partial<AgentStepRequest> = {}): AgentStepRequest {
  return {
    runId: 'run-nincs',
    stepRunId: 'step-nincs',
    instance: { nodeId: 'a', branchContext: [] },
    config: agentStepConfig(),
    decisions,
    descriptor: { requiredEnv: [], disallowedEnv: [] },
    runContext: {
      input: {},
      steps: {},
      item: undefined,
      itemIndex: undefined,
      iteration: undefined,
      joinInputs: undefined,
      error: undefined,
    },
    graph,
    sessionSourceNodes: { sourceNodeIds: new Set(['s', 'a']), continuedNodeIds: new Set(['a']) },
    sessionInstances: [],
    structuredOutputValidator: undefined,
    ...overrides,
  };
}

function failedOutcomeOf(execution: AgentStepExecution): { readonly kind: string; readonly message: string } {
  return execution.outcome.status === 'failed'
    ? { kind: execution.outcome.errorKind, message: execution.outcome.errorMessage }
    : { kind: 'succeeded', message: '' };
}

function failingListDatabase(database: DatabaseContext): DatabaseContext {
  return {
    ...database,
    mcpServerDefinitions: {
      ...database.mcpServerDefinitions,
      listDefinitions: () => ({ kind: 'error', message: 'olvasási hiba (corrupt_mcp_server_definition).' }),
    },
  };
}

describe('runAgentStep', () => {
  it('sikeres futtatás: a lépés succeeded, a számadatok és a session a helyükre kerülnek', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const captured = newCapture();
    const published: unknown[] = [];
    const request = requestOf({
      runId,
      stepRunId,
      ...structuredOutputParts({}),
    });
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
      eventPublisher: {
        publish: (event) => {
          published.push(event);
        },
      },
    });

    const execution = okOrThrow(await runAgentStep(request, dependencies, agentQueryRegistry));

    expect(execution.outcome).toStrictEqual({ status: 'succeeded', output: { osszeg: 4 } });
    expect(execution.resultSubtype).toBe('success');
    expect(execution.numTurns).toBe(3);
    expect(execution.tokens).toStrictEqual({
      inputTokens: 11,
      outputTokens: 22,
      cacheReadInputTokens: 33,
      cacheCreationInputTokens: 44,
    });

    // A renderelt prompt a sablon porton ment át, az `Options` a lépésé.
    const options = captured.request?.options ?? {};
    expect(captured.request?.prompt).toBe('renderelt: Számold ki: {{bemenet}}');
    expect(options['persistSession']).toBe(true);
    expect(Object.hasOwn(options, 'resume')).toBe(false);
    expect(Object.hasOwn(options, 'forkSession')).toBe(false);

    // Minden üzenet előbb a naplóba, utána az élő nézetbe ment.
    const events = okOrThrow(database.events.readEventsForStep(stepRunId, 10));
    expect(events).toHaveLength(3);
    expect(published).toHaveLength(3);

    const step = okOrThrow(database.stepRuns.getStepRun(stepRunId));
    expect(step.sdkSessionId).toBe('session-uj-1');
    expect(step.resumedFromSessionId).toBeNull();
    expect(step.forkedSession).toBe(false);

    database.close();
  });

  it('continued módban a legközelebbi ős session azonosítója megy ki és íródik be', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const captured = newCapture();
    const request = requestOf({
      runId,
      stepRunId,
      config: agentStepConfig({ sessionMode: 'continued' }),
      sessionInstances: [{ nodeId: 's', branchContext: [], sdkSessionId: 'session-os' }],
    });
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
    });

    const execution = okOrThrow(await runAgentStep(request, dependencies, agentQueryRegistry));
    const options = captured.request?.options ?? {};

    expect(execution.outcome.status).toBe('succeeded');
    expect(options['resume']).toBe('session-os');
    expect(options['forkSession']).toBe(false);

    const step = okOrThrow(database.stepRuns.getStepRun(stepRunId));
    expect(step.resumedFromSessionId).toBe('session-os');
    expect(step.forkedSession).toBe(false);

    database.close();
  });

  it('continued módban folytatható ős nélkül no_resumable_session, futtatás nélkül', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const captured = newCapture();
    const request = requestOf({ runId, stepRunId, config: agentStepConfig({ sessionMode: 'continued' }) });
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
    });

    const execution = okOrThrow(await runAgentStep(request, dependencies, agentQueryRegistry));

    expect(failedOutcomeOf(execution).kind).toBe('no_resumable_session');
    expect(captured.request).toBeUndefined();
    expect(execution.tokens).toBeUndefined();

    database.close();
  });

  it('strukturált kimenetet váró lépésnél a hiányzó kimenet missing_structured_output', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const request = requestOf({
      runId,
      stepRunId,
      ...structuredOutputParts({}),
    });
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('strukturaltKimenetNelkul'), newCapture()),
    });

    const execution = okOrThrow(await runAgentStep(request, dependencies, agentQueryRegistry));

    expect(failedOutcomeOf(execution).kind).toBe('missing_structured_output');
    expect(execution.tokens?.inputTokens).toBe(1);

    database.close();
  });

  it('a sémára illeszkedő strukturált kimenettel a lépés succeeded, a kimenet tárolható (SPEC-015 AC1)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const request = requestOf({
      runId,
      stepRunId,
      ...structuredOutputParts({ type: 'object', properties: { osszeg: { type: 'number' } }, required: ['osszeg'] }),
    });
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), newCapture()),
    });

    const execution = okOrThrow(await runAgentStep(request, dependencies, agentQueryRegistry));

    expect(execution.outcome).toStrictEqual({ status: 'succeeded', output: { osszeg: 4 } });

    database.close();
  });

  it('a sémára nem illeszkedő kimenet structured_output_schema_mismatch, az útvonallal és a kulcsszóval, kimenet nélkül (SPEC-015 AC1)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const request = requestOf({
      runId,
      stepRunId,
      ...structuredOutputParts({ type: 'object', properties: { osszeg: { type: 'string' } }, required: ['osszeg'] }),
    });
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), newCapture()),
    });

    const execution = okOrThrow(await runAgentStep(request, dependencies, agentQueryRegistry));

    expect(execution.outcome).toStrictEqual({
      status: 'failed',
      errorKind: 'structured_output_schema_mismatch',
      errorMessage:
        'A kimenet nem illeszkedik a strukturált kimenet sémájára: a(z) "/osszeg" útvonalon a(z) "type" kulcsszó nem teljesül (must be string) (structured_output_schema_mismatch).',
    });
    // A számadatok a hibás ágon is kimennek, a nyers result üzenet a naplóban marad.
    expect(execution.tokens?.inputTokens).toBe(11);
    expect(
      okOrThrow(database.events.readEventsForStep(stepRunId, 100)).some((event) => event.kind === 'sdk_result'),
    ).toBe(true);

    database.close();
  });

  it('a lépés nem fordít újra: a kimenetet a kapott (az indításkor lefordított) ellenőrző vizsgálja (SPEC-015 5.4)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    // A config sémája illeszkedne a kimenetre, a kapott ellenőrző nem: a döntést az ellenőrző hozza.
    const request = requestOf({
      runId,
      stepRunId,
      config: agentStepConfig({ structuredOutput: { strategy: 'sdk_output_format', schema: {} } }),
      structuredOutputValidator: structuredOutputParts({ type: 'string' }).structuredOutputValidator,
    });
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), newCapture()),
    });

    const execution = okOrThrow(await runAgentStep(request, dependencies, agentQueryRegistry));

    expect(failedOutcomeOf(execution).kind).toBe('structured_output_schema_mismatch');

    database.close();
  });

  it('strukturált kimenetet nem váró lépés a kimenet hiánya ellenére sikeres', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('strukturaltKimenetNelkul'), newCapture()),
    });

    const execution = okOrThrow(await runAgentStep(requestOf({ runId, stepRunId }), dependencies, agentQueryRegistry));

    expect(execution.outcome).toStrictEqual({ status: 'succeeded', output: undefined });
    // Az alapértelmezett kiadó nyelő is megkapta az üzeneteket: a kiadás
    // minden lépésnél lefut, akkor is, ha a teszt nem azt vizsgálja.
    expect(discardedEvents.length).toBeGreaterThan(0);

    database.close();
  });

  it('nem success subtype agent_result_not_success, az üzenetben a tényleges subtype névvel', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('hibasSubtype'), newCapture()),
    });

    const execution = okOrThrow(await runAgentStep(requestOf({ runId, stepRunId }), dependencies, agentQueryRegistry));

    expect(failedOutcomeOf(execution)).toStrictEqual({
      kind: 'agent_result_not_success',
      message: 'Az agent futtatás result üzenetének subtype értéke error_max_turns (agent_result_not_success).',
    });
    expect(execution.resultSubtype).toBe('error_max_turns');
    expect(execution.numTurns).toBe(8);

    database.close();
  });

  it('result üzenet nélkül véget érő folyam provider_call_failed', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('resultNelkul'), newCapture()),
    });

    const execution = okOrThrow(await runAgentStep(requestOf({ runId, stepRunId }), dependencies, agentQueryRegistry));

    expect(failedOutcomeOf(execution).kind).toBe('provider_call_failed');
    expect(execution.resultSubtype).toBeUndefined();

    database.close();
  });

  it('a folyam olvasása közben dobott hiba provider_call_failed, a beérkezett események megmaradnak', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const [firstMessage] = fixtureMessages('sikeres');
    let hasDelivered = false;
    const runner: AgentQueryRunner = {
      run: () => ({
        kind: 'ok',
        value: {
          messages: {
            [Symbol.asyncIterator]: () => ({
              next: (): Promise<IteratorResult<unknown>> => {
                if (hasDelivered) {
                  return Promise.reject(new Error('a folyam elszakadt'));
                }
                hasDelivered = true;
                return Promise.resolve({ done: false, value: firstMessage });
              },
            }),
          },
          interrupt: () => Promise.resolve(),
        },
      }),
    };
    const dependencies = dependenciesOf({ database, agentQueryRunner: runner });

    const execution = okOrThrow(await runAgentStep(requestOf({ runId, stepRunId }), dependencies, agentQueryRegistry));
    const events = okOrThrow(database.events.readEventsForStep(stepRunId, 10));

    expect(failedOutcomeOf(execution).kind).toBe('provider_call_failed');
    expect(events).toHaveLength(1);

    database.close();
  });

  it('a sablon renderelés hibája template_render_failed, futtatás nélkül', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const captured = newCapture();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
      templateRenderer: { render: () => ({ kind: 'error', message: 'ismeretlen sablon mező' }), compile: notCalled },
    });

    const execution = okOrThrow(await runAgentStep(requestOf({ runId, stepRunId }), dependencies, agentQueryRegistry));

    expect(failedOutcomeOf(execution)).toStrictEqual({
      kind: 'template_render_failed',
      message: 'A lépés prompt sablonja nem renderelhető: ismeretlen sablon mező (template_render_failed).',
    });
    expect(captured.request).toBeUndefined();

    database.close();
  });

  it('hiányzó kötelező env változó missing_provider_env, kizárólag a névvel', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const request = requestOf({
      runId,
      stepRunId,
      descriptor: {
        requiredEnv: [
          {
            name: 'PROVIDER_KULCS',
            source: 'process_env_passthrough',
            secret: true,
            purpose: 'hitelesítés',
            evidence: [{ kind: 'measurement', id: 'M-01' }],
          },
        ],
        disallowedEnv: [],
      },
    });
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), newCapture()),
    });

    const failure = failedOutcomeOf(okOrThrow(await runAgentStep(request, dependencies, agentQueryRegistry)));

    expect(failure.kind).toBe('missing_provider_env');
    expect(failure.message).toContain('PROVIDER_KULCS');

    database.close();
  });

  it('a lépés MCP hivatkozásai a központi definíciókból és a szerver környezetéből oldódnak fel, az érték eseménybe nem kerül (SPEC-009 6.4)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    okOrThrow(
      database.mcpServerDefinitions.saveDefinition({
        name: 'github',
        definition: {
          type: 'stdio',
          command: 'github-mcp',
          args: ['--stdio'],
          envNames: ['GITHUB_TOKEN'],
          envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
        },
      }),
    );
    okOrThrow(
      database.mcpServerDefinitions.saveDefinition({
        name: 'docs',
        definition: { type: 'http', url: 'http://127.0.0.1:4100/mcp', authEnvName: 'DOCS_AUTH' },
      }),
    );
    const environment = new Map([
      ['GITHUB_TOKEN_SAJAT', 'mcp-titok-sajat'],
      ['DOCS_AUTH', 'Bearer mcp-titok-docs'],
    ]);
    const captured = newCapture();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
      processEnvironment: { read: (name) => environment.get(name) ?? null, readAll: () => ({}) },
    });
    const config = agentStepConfig({
      mcpServerReferences: {
        github: { envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_SAJAT' }, authEnvName: null },
        docs: { envBindings: {}, authEnvName: null },
      },
    });

    const execution = okOrThrow(
      await runAgentStep(requestOf({ runId, stepRunId, config }), dependencies, agentQueryRegistry),
    );

    expect(execution.outcome.status).toBe('succeeded');
    expect(captured.request?.options['mcpServers']).toStrictEqual({
      github: { type: 'stdio', command: 'github-mcp', args: ['--stdio'], env: { GITHUB_TOKEN: 'mcp-titok-sajat' } },
      docs: { type: 'http', url: 'http://127.0.0.1:4100/mcp', headers: { Authorization: 'Bearer mcp-titok-docs' } },
    });
    const events = okOrThrow(database.events.readEventsForStep(stepRunId, 100));
    expect(JSON.stringify(events)).not.toContain('mcp-titok');

    database.close();
  });

  it('a kikapcsolt beépített skillek a kimenő env blokkba a kikapcsoló változót teszik (SPEC-009 O-44)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    okOrThrow(database.settings.setBuiltinSkillsEnabled(false));
    const captured = newCapture();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
    });

    okOrThrow(await runAgentStep(requestOf({ runId, stepRunId }), dependencies, agentQueryRegistry));

    const outgoingEnvironment = captured.request?.options['env'];
    expect(isRecord(outgoingEnvironment) && outgoingEnvironment['CLAUDE_CODE_DISABLE_BUNDLED_SKILLS']).toBe('1');
    database.close();
  });

  // A háromszintű feloldás (SPEC-009 O-44, user döntés 2026-11-04): lépés ?? workflow ?? globális.
  it.each([
    ['a lépés hamis értéke felülírja a globális igazat', false, null, true, '1'],
    ['null lépés mellett a workflow hamis értéke kikapcsol', null, false, true, '1'],
    ['a lépés igaz értéke felülírja a hamis workflow és globális értéket', true, false, false, undefined],
  ] as const)(
    'a beépített skillek háromszintű kapcsolója: %s',
    async (_label, stepValue, workflowValue, globalValue, expected) => {
      const database = openMemoryDatabase();
      const { runId, stepRunId } = seedRun(database, workflowValue);
      okOrThrow(database.settings.setBuiltinSkillsEnabled(globalValue));
      const captured = newCapture();
      const dependencies = dependenciesOf({
        database,
        agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
      });
      const config = agentStepConfig({ builtinSkillsEnabled: stepValue });

      okOrThrow(await runAgentStep(requestOf({ runId, stepRunId, config }), dependencies, agentQueryRegistry));

      const outgoingEnvironment = captured.request?.options['env'];
      expect(isRecord(outgoingEnvironment)).toBe(true);
      expect(isRecord(outgoingEnvironment) ? outgoingEnvironment['CLAUDE_CODE_DISABLE_BUNDLED_SKILLS'] : 'nincs').toBe(
        expected,
      );
      database.close();
    },
  );

  it('a futás sorának olvasási hibája az Outcome hibaágán megy tovább, futtatás nélkül (SPEC-009 O-44)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const dependencies = dependenciesOf({
      database: { ...database, runs: { ...database.runs, getRun: () => ({ kind: 'error', message: 'nincs futás' }) } },
      agentQueryRunner: { run: notCalled },
    });

    expect(await runAgentStep(requestOf({ runId, stepRunId }), dependencies, agentQueryRegistry)).toStrictEqual({
      kind: 'error',
      message: 'nincs futás',
    });
    database.close();
  });

  it('a workflow sorának olvasási hibája az Outcome hibaágán megy tovább, futtatás nélkül (SPEC-009 O-44)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const dependencies = dependenciesOf({
      database: {
        ...database,
        workflows: { ...database.workflows, getWorkflow: () => ({ kind: 'error', message: 'nincs workflow' }) },
      },
      agentQueryRunner: { run: notCalled },
    });

    expect(await runAgentStep(requestOf({ runId, stepRunId }), dependencies, agentQueryRegistry)).toStrictEqual({
      kind: 'error',
      message: 'nincs workflow',
    });
    database.close();
  });

  it('a beállítás olvasásának adatbázis hibája az Outcome hibaágán megy tovább, futtatás nélkül', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const dependencies = dependenciesOf({
      database: {
        ...database,
        settings: { ...database.settings, readSettings: () => ({ kind: 'error', message: 'zárva' }) },
      },
      agentQueryRunner: { run: notCalled },
    });

    expect(await runAgentStep(requestOf({ runId, stepRunId }), dependencies, agentQueryRegistry)).toStrictEqual({
      kind: 'error',
      message: 'zárva',
    });
    database.close();
  });

  it('a nem csatlakozott MCP szerver a lépést megnevezett hibával megállítja, a folyam tovább nem olvasódik (O-46)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    okOrThrow(
      database.mcpServerDefinitions.saveDefinition({
        name: 'docs',
        definition: { type: 'http', url: 'http://127.0.0.1:4100/mcp', authEnvName: null },
      }),
    );
    const interruptSpy = vi.fn(() => Promise.resolve());
    const consumed: unknown[] = [];
    async function* generate(): AsyncGenerator {
      await Promise.resolve();
      yield {
        type: 'system',
        subtype: 'init',
        session_id: 'session-mcp',
        uuid: 'mcp-1',
        mcp_servers: [{ name: 'docs', status: 'failed' }],
      };
      consumed.push('tovabb');
      yield* fixtureMessages('sikeres');
    }
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: { run: () => ({ kind: 'ok', value: { messages: generate(), interrupt: interruptSpy } }) },
    });
    const config = agentStepConfig({ mcpServerReferences: { docs: { envBindings: {}, authEnvName: null } } });

    const execution = okOrThrow(
      await runAgentStep(requestOf({ runId, stepRunId, config }), dependencies, agentQueryRegistry),
    );

    expect(execution.outcome).toStrictEqual({
      status: 'failed',
      errorKind: 'mcp_server_connection_failed',
      errorMessage: 'A(z) a csomópont MCP szervere nem csatlakozott: "docs" (mcp_server_connection_failed).',
    });
    expect(interruptSpy).toHaveBeenCalledTimes(1);
    expect(consumed).toStrictEqual([]);
    database.close();
  });

  it('a megszakítás hibája mellett is a megnevezett mcp_server_connection_failed ok marad (O-46)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    okOrThrow(
      database.mcpServerDefinitions.saveDefinition({
        name: 'docs',
        definition: { type: 'http', url: 'http://127.0.0.1:4100/mcp', authEnvName: null },
      }),
    );
    const messages = [
      {
        type: 'system',
        subtype: 'init',
        session_id: 's',
        uuid: 'u',
        mcp_servers: [{ name: 'docs', status: 'needs-auth' }],
      },
    ];
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: {
        run: () => ({
          kind: 'ok',
          value: { messages: messageIterable(messages), interrupt: () => Promise.reject(new Error('lezárt folyam')) },
        }),
      },
    });
    const config = agentStepConfig({ mcpServerReferences: { docs: { envBindings: {}, authEnvName: null } } });

    const execution = okOrThrow(
      await runAgentStep(requestOf({ runId, stepRunId, config }), dependencies, agentQueryRegistry),
    );

    expect(execution.outcome).toMatchObject({ status: 'failed', errorKind: 'mcp_server_connection_failed' });
    database.close();
  });

  it('a csatlakozott MCP szerver mellett a lépés lefut (O-46)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    okOrThrow(
      database.mcpServerDefinitions.saveDefinition({
        name: 'docs',
        definition: { type: 'http', url: 'http://127.0.0.1:4100/mcp', authEnvName: null },
      }),
    );
    const messages = fixtureMessages('sikeres').map((message: unknown) =>
      isRecord(message) && message['subtype'] === 'init'
        ? { ...message, mcp_servers: [{ name: 'docs', status: 'connected' }] }
        : message,
    );
    const dependencies = dependenciesOf({ database, agentQueryRunner: fakeRunner(messages, newCapture()) });
    const config = agentStepConfig({ mcpServerReferences: { docs: { envBindings: {}, authEnvName: null } } });

    const execution = okOrThrow(
      await runAgentStep(requestOf({ runId, stepRunId, config }), dependencies, agentQueryRegistry),
    );

    expect(execution.outcome.status).toBe('succeeded');
    database.close();
  });

  it('az agent definíciók skill és MCP hivatkozásai a kimenő agents mezőben oldódnak fel, a lépés kiválasztott skilljével (M-147, O-47)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    okOrThrow(
      database.mcpServerDefinitions.saveDefinition({
        name: 'docs',
        definition: { type: 'http', url: 'http://127.0.0.1:4100/mcp', authEnvName: 'DOCS_AUTH' },
      }),
    );
    const environment = new Map([['DOCS_AUTH_SEGITO', 'Bearer agent-titok-docs']]);
    const captured = newCapture();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
      processEnvironment: { read: (name) => environment.get(name) ?? null, readAll: () => ({}) },
      skillLibrary: {
        readSkillLibrary: () => ({
          rootDirectory: '/skill-konyvtar',
          pluginName: 'skill-konyvtar',
          skillNames: ['alfa'],
        }),
      },
    });
    const config = agentStepConfig({
      skills: ['alfa'],
      agents: {
        segito: {
          description: 'Segítő',
          prompt: 'Segíts.',
          skills: ['alfa'],
          mcpServerReferences: { docs: { envBindings: {}, authEnvName: 'DOCS_AUTH_SEGITO' } },
        },
      },
    });

    const execution = okOrThrow(
      await runAgentStep(requestOf({ runId, stepRunId, config }), dependencies, agentQueryRegistry),
    );

    expect(execution.outcome.status).toBe('succeeded');
    expect(captured.request?.options['agents']).toStrictEqual({
      segito: {
        description: 'Segítő',
        prompt: 'Segíts.',
        skills: ['skill-konyvtar:alfa'],
        mcpServers: [
          {
            docs: {
              type: 'http',
              url: 'http://127.0.0.1:4100/mcp',
              headers: { Authorization: 'Bearer agent-titok-docs' },
            },
          },
        ],
      },
    });
    expect(captured.request?.options['plugins']).toStrictEqual([{ type: 'local', path: '/skill-konyvtar' }]);
    expect(captured.request?.options['skills']).toStrictEqual(['skill-konyvtar:alfa']);
    const events = okOrThrow(database.events.readEventsForStep(stepRunId, 100));
    expect(JSON.stringify(events)).not.toContain('agent-titok');

    database.close();
  });

  it('az érvénytelen alakú agent definíció malformed_node_config, futtatás nélkül', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const captured = newCapture();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
    });
    const config = agentStepConfig({ agents: { segito: { description: 'd', prompt: 'p', skills: 7 } } });

    const request = requestOf({ runId, stepRunId, config });
    const failure = failedOutcomeOf(okOrThrow(await runAgentStep(request, dependencies, agentQueryRegistry)));

    expect(failure).toStrictEqual({
      kind: 'malformed_node_config',
      message: 'A(z) a csomópont "segito" agent definíciója érvénytelen alakú (malformed_node_config).',
    });
    expect(captured.request).toBeUndefined();

    database.close();
  });

  it('a null skills lépésen az agent definíció skillje agent_skill_not_in_step, futtatás nélkül (O-47)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const captured = newCapture();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
      skillLibrary: {
        readSkillLibrary: () => ({
          rootDirectory: '/skill-konyvtar',
          pluginName: 'skill-konyvtar',
          skillNames: ['alfa'],
        }),
      },
    });
    const config = agentStepConfig({
      skills: null,
      agents: { segito: { description: 'Segítő', prompt: 'Segíts.', skills: ['alfa'] } },
    });

    const request = requestOf({ runId, stepRunId, config });
    const failure = failedOutcomeOf(okOrThrow(await runAgentStep(request, dependencies, agentQueryRegistry)));

    expect(failure).toStrictEqual({
      kind: 'agent_skill_not_in_step',
      message:
        'A(z) a csomópont "segito" agent definíciója a(z) "alfa" skillre hivatkozik, ami nincs a lépés kiválasztott skilljei között (agent_skill_not_in_step).',
    });
    expect(captured.request).toBeUndefined();

    database.close();
  });

  it('a futás indítása után törölt központi definícióra mcp_server_not_found, futtatás nélkül (O-43)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const captured = newCapture();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
    });
    const config = agentStepConfig({ mcpServerReferences: { torolt: { envBindings: {}, authEnvName: null } } });

    const request = requestOf({ runId, stepRunId, config });
    const failure = failedOutcomeOf(okOrThrow(await runAgentStep(request, dependencies, agentQueryRegistry)));

    expect(failure).toStrictEqual({
      kind: 'mcp_server_not_found',
      message:
        'A(z) a csomópont a(z) "torolt" MCP szerverre hivatkozik, ami nincs a központi MCP szerver listában (mcp_server_not_found).',
    });
    expect(captured.request).toBeUndefined();

    database.close();
  });

  it('a hiányzó szerver oldali MCP változó missing_mcp_server_env, futtatás nélkül (O-18)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    okOrThrow(
      database.mcpServerDefinitions.saveDefinition({
        name: 'docs',
        definition: { type: 'sse', url: 'http://127.0.0.1:4200/sse', authEnvName: 'DOCS_AUTH' },
      }),
    );
    const captured = newCapture();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
    });
    const config = agentStepConfig({ mcpServerReferences: { docs: { envBindings: {}, authEnvName: null } } });

    const request = requestOf({ runId, stepRunId, config });
    const failure = failedOutcomeOf(okOrThrow(await runAgentStep(request, dependencies, agentQueryRegistry)));

    expect(failure.kind).toBe('missing_mcp_server_env');
    expect(failure.message).toContain('"DOCS_AUTH"');
    expect(captured.request).toBeUndefined();

    database.close();
  });

  it('a központi MCP lista olvasásának adatbázis hibája a hivatkozó lépés Outcome hibaágán jelenik meg', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const dependencies = dependenciesOf({
      database: failingListDatabase(database),
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), newCapture()),
    });
    const stepReference = agentStepConfig({ mcpServerReferences: { docs: { envBindings: {}, authEnvName: null } } });
    const agentReference = agentStepConfig({
      agents: {
        kutato: {
          description: 'd',
          prompt: 'p',
          mcpServerReferences: { docs: { envBindings: {}, authEnvName: null } },
        },
      },
    });

    for (const config of [stepReference, agentReference]) {
      expect(
        await runAgentStep(requestOf({ runId, stepRunId, config }), dependencies, agentQueryRegistry),
      ).toStrictEqual({
        kind: 'error',
        message: 'olvasási hiba (corrupt_mcp_server_definition).',
      });
    }

    database.close();
  });

  it('MCP hivatkozás nélkül a központi lista hibája nem állítja meg a lépést (T-012-27)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const captured = newCapture();
    const dependencies = dependenciesOf({
      database: failingListDatabase(database),
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
    });

    const execution = okOrThrow(await runAgentStep(requestOf({ runId, stepRunId }), dependencies, agentQueryRegistry));

    expect(execution.outcome.status).toBe('succeeded');
    expect(captured.request).toBeDefined();

    database.close();
  });

  it('a kimenő env a folyamat környezetéből épül: a PATH és a HOME átmegy, a tiltott név nem (SPEC-012 2.1 hiba)', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const captured = newCapture();
    const request = requestOf({
      runId,
      stepRunId,
      // A `claude-subscription` leíró alakja: nincs kötelező env, van tiltott név.
      descriptor: {
        requiredEnv: [],
        disallowedEnv: [
          { name: 'ANTHROPIC_API_KEY', reason: 'teszt', evidence: [{ kind: 'measurement', id: 'M-01' }] },
        ],
      },
    });
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
      processEnvironment: {
        read: () => null,
        readAll: () => ({ PATH: '/usr/bin', HOME: '/home/teszt', ANTHROPIC_API_KEY: 'nem-jut-ki' }),
      },
    });

    okOrThrow(await runAgentStep(request, dependencies, agentQueryRegistry));

    expect(captured.request?.options['env']).toStrictEqual({
      PATH: '/usr/bin',
      HOME: '/home/teszt',
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
    });

    database.close();
  });

  it('a futtató port hibaága provider_call_failed', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: { run: () => ({ kind: 'error', message: 'a futtatás nem indult' }) },
    });

    const execution = okOrThrow(await runAgentStep(requestOf({ runId, stepRunId }), dependencies, agentQueryRegistry));

    expect(failedOutcomeOf(execution)).toStrictEqual({
      kind: 'provider_call_failed',
      message: 'Az agent futtatás nem indult el: a futtatás nem indult (provider_call_failed).',
    });

    database.close();
  });

  it('az esemény hozzáfűzés adatbázis hibája az Outcome hibaágán jelenik meg', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    // A futás sora létezik (a lépés indulásakor a beépített skillek feloldása olvassa, SPEC-009
    // O-44), ezért a hozzáfűzés hibáját a port adja.
    const dependencies = dependenciesOf({
      database: {
        ...database,
        events: {
          ...database.events,
          appendSdkEvent: () => ({ kind: 'error', message: 'a hozzáfűzés elbukott (not_found)' }),
        },
      },
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), newCapture()),
    });

    const outcome = await runAgentStep(requestOf({ runId, stepRunId }), dependencies, agentQueryRegistry);

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('not_found');

    database.close();
  });

  it('a session csatolás adatbázis hibája az Outcome hibaágán jelenik meg', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    // A kiadás a hozzáfűzés és a session csatolás **között** fut (SPEC-004
    // 5.2 6. és 7. pont), ezért itt zárjuk le a kapcsolatot: így a csatolás
    // hibaága valós adatbázis ellen, determinisztikusan előidézhető.
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), newCapture()),
      eventPublisher: {
        publish: () => {
          database.close();
        },
      },
    });

    const outcome = await runAgentStep(requestOf({ runId, stepRunId }), dependencies, agentQueryRegistry);

    expect(outcome.kind).toBe('error');
  });

  it('a query a hívás UTÁN AZONNAL regisztrálódik, a lépés zárásakor leiratkozik, és a megszakítás előtti ÉS utáni esemény is beíródik', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const registry = createAgentQueryRegistry();
    const controlled = controlledMessageIterable();
    const interruptSpy = vi.fn(() => {
      controlled.release();
      return Promise.resolve();
    });
    const runner: AgentQueryRunner = {
      run: () => ({ kind: 'ok', value: { messages: controlled.messages, interrupt: interruptSpy } }),
    };
    const dependencies = dependenciesOf({ database, agentQueryRunner: runner });

    const executionPromise = runAgentStep(requestOf({ runId, stepRunId }), dependencies, registry);

    // Azonnal, mikrotaszk-várakozás nélkül: a regisztráció a `run()` sikeres
    // visszatérése után, még a folyam olvasása előtt megtörténik.
    expect(registry.listForRunIds(new Set([runId]))).toHaveLength(1);

    // Megvárjuk, amíg a folyam feldolgozza a megszakítás ELŐTTI (init)
    // üzenetet - a generátor ezután a `release()` hívásig felfüggesztve marad.
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (okOrThrow(database.events.readEventsForStep(stepRunId, 10)).length === 1) {
        break;
      }
      await Promise.resolve();
    }
    expect(okOrThrow(database.events.readEventsForStep(stepRunId, 10))).toHaveLength(1);

    const [liveQuery] = registry.listForRunIds(new Set([runId]));
    if (liveQuery === undefined) {
      throw new Error('nincs élő query a regiszterben');
    }
    await liveQuery.interrupt();

    const execution = okOrThrow(await executionPromise);

    expect(interruptSpy).toHaveBeenCalledTimes(1);
    expect(execution.outcome.status).toBe('succeeded');
    // A lépés zárásakor leiratkozott.
    expect(registry.listForRunIds(new Set([runId]))).toHaveLength(0);

    // A megszakítás ELŐTT (init) ÉS UTÁN (result) érkezett esemény is beíródott.
    const events = okOrThrow(database.events.readEventsForStep(stepRunId, 10));
    expect(events).toHaveLength(2);

    database.close();
  });
});
