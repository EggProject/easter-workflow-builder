import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createServerLogger, type DestinationStream } from '@easter-workflow-builder/logger';
import { createEngine } from '@easter-workflow-builder/engine';
import type { AgentQueryRunner } from '@easter-workflow-builder/agent';
import {
  buildStreamUrl,
  decodeStreamFrame,
  ProtocolErrorBodySchema,
  RunDetailSchema,
  StartedRunResponseSchema,
  StepRunRecordSchema,
  WorkflowDetailSchema,
  type StreamFrame,
  type WorkflowEdgeInput,
  type WorkflowNodeInput,
} from '@easter-workflow-builder/protocol';
import { isRecord } from '@easter-workflow-builder/typeguards';
import {
  createCelExpressionEvaluator,
  createMustacheTemplateRenderer,
} from '@easter-workflow-builder/workflow-language';
import { buildProviderDescriptorLookup } from '../engine-assembly/build-provider-descriptor-lookup.ts';
import { createRealEventPublisher } from '../engine-assembly/create-real-event-publisher.ts';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { createProcessEnvironmentReader } from '../engine-assembly/create-process-environment-reader.ts';
import { createSkillLibraryReader } from '../engine-assembly/create-skill-library-reader.ts';
import { createSystemClock } from '../engine-assembly/create-system-clock.ts';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { buildRouteHandlers } from '../route-registry/build-route-handlers.ts';
import { createHttpServer } from '../http-server/create-http-server.ts';
import { TEST_SKILL_LIBRARY } from '../skill-endpoint/test-skill-library.ts';
import { TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER } from '../engine-assembly/test-structured-output-schema-compiler.ts';
import { quickJsScriptRunner } from '../script-runner/quickjs-script-runner.ts';

/**
 * SPEC-014 5.5 ... 5.8, AC1 ... AC4 (PLAN-015 T-015-5): végponttól végpontig
 * próba a valódi `apps/server` modulokkal, a `workflow-language-end-to-end`
 * téma harness mintájára. Valódi HTTP szerver `127.0.0.1` címen `port: 0`
 * értékkel, valódi `:memory:` adatbázis, a szállított CEL kiértékelő és a
 * valódi QuickJS futtató (`quickJsScriptRunner`). Agent lépés a gráfokban
 * nincs, ezért az `agentQueryRunner` port hívása a teszt bukása: valódi
 * provider hívás nincs. A futás végét a `GET /events` folyam `run_finished`
 * eseménye jelzi, kézi időzítés nélkül.
 */

const NOT_CALLED_AGENT_QUERY_RUNNER: AgentQueryRunner = {
  run: () => {
    throw new Error('a szkript próbában agent lépés nem fut');
  },
};

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function parsedOrThrow<TValue>(result: { success: true; data: TValue } | { success: false; error: Error }): TValue {
  if (!result.success) {
    throw new Error(`a válasz nem illeszkedik a protokoll sémára: ${result.error.message}`);
  }
  return result.data;
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

interface RunningServer {
  readonly baseUrl: string;
  readonly server: Server;
  readonly database: DatabaseContext;
}

// A szerver naplója a próbában nem állítás tárgya (a 46. kritériumos harness mintája).
function collectingSink(): { readonly sink: DestinationStream; readonly lines: string[] } {
  const lines: string[] = [];
  return {
    sink: {
      write: (message: string) => {
        lines.push(message);
      },
    },
    lines,
  };
}

async function startServer(): Promise<RunningServer> {
  const database = okOrThrow(openDatabase(':memory:'));
  const clock = createSystemClock();
  const idGenerator = createRandomUuidIdGenerator();
  const streamRegistry = createStreamRegistry(idGenerator);
  const engine = createEngine({
    database,
    agentQueryRunner: NOT_CALLED_AGENT_QUERY_RUNNER,
    providerDescriptorLookup: buildProviderDescriptorLookup(),
    structuredOutputSchemaCompiler: TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER,
    scriptRunner: quickJsScriptRunner,
    expressionEvaluator: createCelExpressionEvaluator(),
    templateRenderer: createMustacheTemplateRenderer(),
    eventPublisher: createRealEventPublisher(streamRegistry, clock),
    clock,
    idGenerator,
    processEnvironment: createProcessEnvironmentReader(),
    skillLibrary: createSkillLibraryReader(TEST_SKILL_LIBRARY.rootDirectory),
  });
  const server = createHttpServer({
    handlers: buildRouteHandlers(
      database,
      engine,
      streamRegistry,
      TEST_SKILL_LIBRARY,
      TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER,
    ),
    devOrigin: undefined,
    allowedOrigin: 'http://localhost:5173',
    streamDependencies: { database, registry: streamRegistry, clock, keepAliveIntervalMs: 30_000 },
    logger: createServerLogger({ secretValues: [] }, collectingSink().sink),
    idGenerator,
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('a teszt szerver nem kapott portot');
  }
  return { baseUrl: `http://127.0.0.1:${String(address.port)}`, server, database };
}

async function requestJson(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ readonly status: number; readonly body: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const parsed: unknown = await response.json();
  return { status: response.status, body: parsed };
}

async function createWorkflowWithGraph(
  baseUrl: string,
  name: string,
  nodes: readonly WorkflowNodeInput[],
  edges: readonly WorkflowEdgeInput[],
): Promise<string> {
  // eslint-disable-next-line unicorn/no-null -- a leírás és a workflow providerId mező valódi NULL érték (SPEC-005 4.2 A)
  const created = await requestJson(baseUrl, 'POST', '/api/workflows', { name, description: null, providerId: null });
  expect(created.status).toBe(200);
  const workflowId = parsedOrThrow(WorkflowDetailSchema.safeParse(created.body)).id;

  const saved = await requestJson(baseUrl, 'PUT', `/api/workflows/${workflowId}/graph`, { nodes, edges });
  expect(saved.status).toBe(200);

  const settings = await requestJson(baseUrl, 'PUT', '/api/settings', { defaultProviderId: 'claude-subscription' });
  expect(settings.status).toBe(200);
  return workflowId;
}

// Az SSE folyam kereteinek dekódolása a `data:` sorokból (SPEC-005 5.3).
async function* readStreamFrames(reader: ReadableStreamDefaultReader<string>): AsyncGenerator<StreamFrame> {
  let buffer = '';
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) {
      return;
    }
    buffer += chunk.value;
    let separator = buffer.indexOf('\n\n');
    while (separator !== -1) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      separator = buffer.indexOf('\n\n');
      const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
      if (dataLine !== undefined) {
        const raw: unknown = JSON.parse(dataLine.slice('data: '.length));
        yield okOrThrow(decodeStreamFrame(raw));
      }
    }
  }
}

/**
 * A futás `run_finished` eseményének payloadja, a `GET /events` folyamból: a
 * kapcsolat felépülése (`stream_ready`) után a `PUT .../subscriptions` a
 * futásra a 0 padlóról iratkozik fel, tehát a már perzisztált záró eseményt
 * a pótlás is kézbesíti.
 */
async function waitForRunFinished(baseUrl: string, runId: string): Promise<unknown> {
  const controller = new AbortController();
  const streamId = `szkript-${randomUUID()}`;
  const response = await fetch(`${baseUrl}${buildStreamUrl(streamId)}`, { signal: controller.signal });
  if (response.body === null) {
    throw new Error('a stream válasznak nincs törzse');
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  const frames = readStreamFrames(reader);
  try {
    const ready = await frames.next();
    expect(ready.done === true ? undefined : ready.value.event).toBe('stream_ready');

    const subscribed = await requestJson(baseUrl, 'PUT', `/api/streams/${streamId}/subscriptions`, {
      runs: [{ runId, fromEventId: 0, replayLimit: 500 }],
    });
    expect(subscribed.status).toBe(200);

    for await (const frame of frames) {
      if (frame.event === 'run_event' && frame.runEvent.runId === runId && frame.runEvent.kind === 'run_finished') {
        return frame.runEvent.payload;
      }
    }
    throw new Error('a stream a run_finished esemény előtt véget ért');
  } finally {
    await reader.cancel();
    controller.abort();
  }
}

/* eslint-disable unicorn/no-null -- a JavaScript szkript nullázható mezői és az él kezelő és ág kulcs mezői valódi NULL értéket tárolnak (SPEC-003 4.4, SPEC-014 5.3) */
function nodeOf(id: string, config: WorkflowNodeInput['config']): WorkflowNodeInput {
  return { id, type: config.type, label: id, positionX: 0, positionY: 0, config };
}

function javaScript(source: string) {
  return {
    source,
    runtime: 'javascript',
    timeoutMs: null,
    cwd: null,
    memoryLimitMb: null,
    fetchResponseLimitMb: null,
    fileReadLimitMb: null,
  } as const;
}

function edge(id: string, sourceNodeId: string, targetNodeId: string): WorkflowEdgeInput {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey: null };
}
/* eslint-enable unicorn/no-null */

const START_NODE = nodeOf('start', { type: 'start', inputFields: [], onUnhandledError: 'fail_run' });

// A próba gráfja: fan_out, a példányokon CEL szkript, a join JavaScript
// szkript módban a `joinInputs` listával, végül egy JavaScript szkript node,
// ami a join kimenetét és a futás bemenetét olvassa.
const PROBE_NODES: readonly WorkflowNodeInput[] = [
  START_NODE,
  nodeOf('szetoszt', {
    type: 'fan_out',
    itemsExpression: 'input.elemek',
    branchLabelTemplate: '{{item}}',
    onUnhandledError: 'fail_run',
  }),
  nodeOf('elem', { type: 'script', source: 'item + "!"', runtime: 'expression', onUnhandledError: 'fail_run' }),
  nodeOf('osszegzo', {
    type: 'join',
    mode: 'script',
    settings: javaScript('return joinInputs.join(",");'),
    onUnhandledError: 'fail_run',
  }),
  nodeOf('vege', {
    type: 'script',
    ...javaScript('return { hossz: steps.osszegzo.length, tema: input.tema };'),
    onUnhandledError: 'fail_run',
  }),
];

const PROBE_EDGES: readonly WorkflowEdgeInput[] = [
  edge('e1', 'start', 'szetoszt'),
  edge('e2', 'szetoszt', 'elem'),
  edge('e3', 'elem', 'osszegzo'),
  edge('e4', 'osszegzo', 'vege'),
];

async function stepsOf(baseUrl: string, runId: string) {
  const stepsResponse = await requestJson(baseUrl, 'GET', `/api/runs/${runId}/steps`);
  return (isUnknownArray(stepsResponse.body) ? stepsResponse.body : []).map((step) =>
    parsedOrThrow(StepRunRecordSchema.safeParse(step)),
  );
}

describe('a szkript lépés végponttól végpontig, valódi szerver és valódi QuickJS ellen (SPEC-014 AC1 ... AC4)', () => {
  let running: RunningServer | undefined;

  afterEach(async () => {
    if (running === undefined) {
      return;
    }
    const { server, database } = running;
    running = undefined;
    server.closeAllConnections();
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    database.close();
  });

  it('a CEL és a JavaScript szkript lépés lefut, a join script módja a joinInputs listát kapja, a futás succeeded', async () => {
    running = await startServer();
    const { baseUrl } = running;
    const workflowId = await createWorkflowWithGraph(baseUrl, 'szkript-proba', PROBE_NODES, PROBE_EDGES);

    const started = await requestJson(baseUrl, 'POST', `/api/workflows/${workflowId}/runs`, {
      input: { tema: 'kert', elemek: ['alma', 'körte'] },
    });
    expect(started.status).toBe(200);
    const runId = parsedOrThrow(StartedRunResponseSchema.safeParse(started.body)).runId;

    const finishedPayload = await waitForRunFinished(baseUrl, runId);
    expect(isRecord(finishedPayload) ? finishedPayload['status'] : undefined).toBe('succeeded');
    const run = await requestJson(baseUrl, 'GET', `/api/runs/${runId}`);
    expect(parsedOrThrow(RunDetailSchema.safeParse(run.body)).status).toBe('succeeded');

    const steps = await stepsOf(baseUrl, runId);
    expect(new Set(steps.filter((step) => step.nodeId === 'elem').map((step) => step.output))).toStrictEqual(
      new Set(['alma!', 'körte!']),
    );
    expect(steps.find((step) => step.nodeId === 'osszegzo')?.output).toBe('alma!,körte!');
    expect(steps.find((step) => step.nodeId === 'vege')?.output).toStrictEqual({ hossz: 12, tema: 'kert' });
  });

  it('a JavaScript futásidejű hibája a lépést script_evaluation_failed osztállyal zárja, a futás failed', async () => {
    running = await startServer();
    const { baseUrl } = running;
    const workflowId = await createWorkflowWithGraph(
      baseUrl,
      'szkript-hiba',
      [
        START_NODE,
        nodeOf('js', { type: 'script', ...javaScript('throw new Error("eltört");'), onUnhandledError: 'fail_run' }),
      ],
      [edge('e1', 'start', 'js')],
    );

    const started = await requestJson(baseUrl, 'POST', `/api/workflows/${workflowId}/runs`, { input: {} });
    const runId = parsedOrThrow(StartedRunResponseSchema.safeParse(started.body)).runId;

    const finishedPayload = await waitForRunFinished(baseUrl, runId);
    expect(isRecord(finishedPayload) ? finishedPayload['errorKind'] : undefined).toBe('script_evaluation_failed');
    const steps = await stepsOf(baseUrl, runId);
    const step = steps.find((candidate) => candidate.nodeId === 'js');
    expect(step?.status).toBe('failed');
    expect(step?.errorMessage).toContain('Error: eltört');
  });

  it('a fordíthatatlan JavaScript forrás indítása 422 script_compile_failed, a csomópont és a mező nevével, futás sor nélkül', async () => {
    running = await startServer();
    const { baseUrl } = running;
    const workflowId = await createWorkflowWithGraph(
      baseUrl,
      'szkript-forditas',
      [START_NODE, nodeOf('js', { type: 'script', ...javaScript('return (;'), onUnhandledError: 'fail_run' })],
      [edge('e1', 'start', 'js')],
    );

    const started = await requestJson(baseUrl, 'POST', `/api/workflows/${workflowId}/runs`, { input: {} });

    expect(started.status).toBe(422);
    const error = parsedOrThrow(ProtocolErrorBodySchema.safeParse(started.body));
    expect(error.code).toBe('unprocessable');
    expect(error.errorClass).toBe('script_compile_failed');
    expect(error.message).toContain('A(z) js csomópont source mezője');
    const runs = await requestJson(baseUrl, 'GET', `/api/runs?limit=10&workflowId=${workflowId}`);
    expect(runs.body).toStrictEqual([]);
  });
});
