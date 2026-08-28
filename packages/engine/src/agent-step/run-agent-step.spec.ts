/* eslint-disable unicorn/no-null -- a `SnapshotEdge`, a `SnapshotWorkflow.description`, a `CreateStepRunInput` és az `AgentStepConfig` nullázható mezői a tárolt alakban `null` értéket hordoznak (SPEC-003 4.3, 4.4, 5.1, 9.2), nem helyőrző `undefined`-et */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AgentQueryRequest, AgentQueryRunner } from '@easter-workflow-builder/agent';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type {
  AgentStepConfig,
  DatabaseContext,
  NodeType,
  SnapshotEdge,
  SnapshotNode,
} from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import type { TemplateRendererPort } from '../engine-port/template-renderer-port.ts';
import type { AgentStepCapabilityDecisions } from './agent-step-capability-decisions.ts';
import type { AgentStepExecution } from './agent-step-execution.ts';
import type { AgentStepRequest } from './agent-step-request.ts';
import { runAgentStep } from './run-agent-step.ts';

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
    enabledEngineHooks: [],
    cwd: null,
    additionalDirectories: [],
    sandbox: null,
    agentTools: [],
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
function seedRun(database: DatabaseContext): { readonly runId: string; readonly stepRunId: string } {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'agent-step teszt', description: null, providerId: null }),
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

interface DependencyParts {
  readonly database: DatabaseContext;
  readonly agentQueryRunner: AgentQueryRunner;
  readonly templateRenderer?: TemplateRendererPort;
  readonly processEnvironment?: ProcessEnvironmentPort;
  readonly eventPublisher?: EventPublisherPort;
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
    processEnvironment: parts.processEnvironment ?? { read: () => null },
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
    ...overrides,
  };
}

function failedOutcomeOf(execution: AgentStepExecution): { readonly kind: string; readonly message: string } {
  return execution.outcome.status === 'failed'
    ? { kind: execution.outcome.errorKind, message: execution.outcome.errorMessage }
    : { kind: 'succeeded', message: '' };
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
      config: agentStepConfig({ structuredOutput: { strategy: 'sdk_output_format', schema: {} } }),
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

    const execution = okOrThrow(await runAgentStep(request, dependencies));

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

    const execution = okOrThrow(await runAgentStep(request, dependencies));
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

    const execution = okOrThrow(await runAgentStep(request, dependencies));

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
      config: agentStepConfig({ structuredOutput: { strategy: 'emit_output_tool', schema: {} } }),
    });
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('strukturaltKimenetNelkul'), newCapture()),
    });

    const execution = okOrThrow(await runAgentStep(request, dependencies));

    expect(failedOutcomeOf(execution).kind).toBe('missing_structured_output');
    expect(execution.tokens?.inputTokens).toBe(1);

    database.close();
  });

  it('strukturált kimenetet nem váró lépés a kimenet hiánya ellenére sikeres', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('strukturaltKimenetNelkul'), newCapture()),
    });

    const execution = okOrThrow(await runAgentStep(requestOf({ runId, stepRunId }), dependencies));

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

    const execution = okOrThrow(await runAgentStep(requestOf({ runId, stepRunId }), dependencies));

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

    const execution = okOrThrow(await runAgentStep(requestOf({ runId, stepRunId }), dependencies));

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

    const execution = okOrThrow(await runAgentStep(requestOf({ runId, stepRunId }), dependencies));
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

    const execution = okOrThrow(await runAgentStep(requestOf({ runId, stepRunId }), dependencies));

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

    const failure = failedOutcomeOf(okOrThrow(await runAgentStep(request, dependencies)));

    expect(failure.kind).toBe('missing_provider_env');
    expect(failure.message).toContain('PROVIDER_KULCS');

    database.close();
  });

  it('a futtató port hibaága provider_call_failed', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRun(database);
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: { run: () => ({ kind: 'error', message: 'a futtatás nem indult' }) },
    });

    const execution = okOrThrow(await runAgentStep(requestOf({ runId, stepRunId }), dependencies));

    expect(failedOutcomeOf(execution)).toStrictEqual({
      kind: 'provider_call_failed',
      message: 'Az agent futtatás nem indult el: a futtatás nem indult (provider_call_failed).',
    });

    database.close();
  });

  it('az esemény hozzáfűzés adatbázis hibája az Outcome hibaágán jelenik meg', async () => {
    const database = openMemoryDatabase();
    const { stepRunId } = seedRun(database);
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), newCapture()),
    });

    const outcome = await runAgentStep(requestOf({ runId: 'nincs-ilyen-futas', stepRunId }), dependencies);

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

    const outcome = await runAgentStep(requestOf({ runId, stepRunId }), dependencies);

    expect(outcome.kind).toBe('error');
  });
});
