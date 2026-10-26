import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
  RunEventRecordSchema,
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
import { createSystemClock } from '../engine-assembly/create-system-clock.ts';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { buildRouteHandlers } from '../route-registry/build-route-handlers.ts';
import { createHttpServer } from '../http-server/create-http-server.ts';

/**
 * SPEC-010 12.3, 16. szekció 48 ... 50. kritérium (PLAN-010 T-010-16):
 * végponttól végpontig próba a valódi `apps/server` modulokkal. Valódi HTTP
 * szerver `127.0.0.1` címen `port: 0` értékkel, a valódi útvonal kezelők,
 * stream nyilvántartás és motor, valódi `:memory:` adatbázis a commitolt
 * migrációkkal, a szállított Mustache és CEL port. **Kizárólag az
 * `agentQueryRunner` port hamis**: a commitolt fixture üzenetsorát adja, és
 * rögzíti a kapott promptot, tehát valódi provider hívás nincs. A
 * `continue-startup-with-database.ts` 5 ... 7. lépését a 46. kritériumos
 * harness mintájára építi fel, mert az a függvény a valódi
 * `buildAgentQueryRunner()`-t köti be. A futás végét a `GET /events` folyam
 * `run_finished` eseménye jelzi, kézi időzítés nélkül.
 */

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

function fixtureMessages(): readonly unknown[] {
  const text = readFileSync(new URL('agent-step-messages-fixture.json', import.meta.url), 'utf8');
  const parsed: unknown = JSON.parse(text);
  const sequence = isRecord(parsed) ? parsed['sikeres'] : undefined;
  if (!isUnknownArray(sequence)) {
    throw new Error('a sikeres fixture sorozat hiányzik vagy nem tömb');
  }
  return sequence;
}

// A `run_event` (run_id, sdk_uuid) párja egyedi, ezért minden hívás saját
// `uuid` és `session_id` utótagot kap a fixture értékei mögé.
function withCallSuffix(message: unknown, call: number): unknown {
  if (!isRecord(message)) {
    return message;
  }
  const suffixed: Record<string, unknown> = { ...message };
  for (const key of ['uuid', 'session_id']) {
    const value = message[key];
    if (typeof value === 'string') {
      suffixed[key] = `${value}-${String(call)}`;
    }
  }
  return suffixed;
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

function recordingAgentQueryRunner(prompts: string[]): AgentQueryRunner {
  const fixture = fixtureMessages();
  return {
    run: (request) => {
      prompts.push(request.prompt);
      const call = prompts.length;
      return {
        kind: 'ok',
        value: {
          messages: messageIterable(fixture.map((message) => withCallSuffix(message, call))),
          interrupt: () => Promise.resolve(),
        },
      };
    },
  };
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

async function startServer(agentQueryRunner: AgentQueryRunner): Promise<RunningServer> {
  const database = okOrThrow(openDatabase(':memory:'));
  const clock = createSystemClock();
  const idGenerator = createRandomUuidIdGenerator();
  const streamRegistry = createStreamRegistry(idGenerator);
  const engine = createEngine({
    database,
    agentQueryRunner,
    providerDescriptorLookup: buildProviderDescriptorLookup(),
    expressionEvaluator: createCelExpressionEvaluator(),
    templateRenderer: createMustacheTemplateRenderer(),
    eventPublisher: createRealEventPublisher(streamRegistry, clock),
    clock,
    idGenerator,
    processEnvironment: createProcessEnvironmentReader(),
  });
  const server = createHttpServer({
    handlers: buildRouteHandlers(database, engine, streamRegistry),
    devOrigin: undefined,
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
  const streamId = `vegpont-${randomUUID()}`;
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

/* eslint-disable unicorn/no-null -- a node config nullázható mezői és az él kezelő és ág kulcs mezői valódi NULL értéket tárolnak (SPEC-003 4.4) */
function agentStepNode(id: string, promptTemplate: string): WorkflowNodeInput {
  return {
    id,
    type: 'agent_step',
    label: id,
    positionX: 0,
    positionY: 0,
    config: {
      type: 'agent_step',
      onUnhandledError: 'fail_run',
      promptTemplate,
      providerId: null,
      modelId: 'claude-sonnet-5',
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
      sessionMode: 'isolated',
      structuredOutput: null,
    },
  };
}

const START_NODE: WorkflowNodeInput = {
  id: 'start',
  type: 'start',
  label: 'start',
  positionX: 0,
  positionY: 0,
  config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
};

function branchNode(id: string, expression: string): WorkflowNodeInput {
  return {
    id,
    type: 'branch',
    label: id,
    positionX: 0,
    positionY: 0,
    config: {
      type: 'branch',
      expression,
      branches: [
        { key: 'reszletes', label: 'Részletes' },
        { key: 'rovid', label: 'Rövid' },
      ],
      defaultBranchKey: null,
      onUnhandledError: 'fail_run',
    },
  };
}

function edge(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  branchKey: string | null = null,
): WorkflowEdgeInput {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey };
}
/* eslint-enable unicorn/no-null */

// A próba gráfja: agent_step, branch, fan_out + join, loop, egy-egy
// agent_step a fan_out ágon, a loop törzsében és a loop után; a `rovid` ág
// csomópontja (`nem_valasztott`) nem futhat le.
const PROBE_NODES: readonly WorkflowNodeInput[] = [
  START_NODE,
  agentStepNode('tema', 'Téma: {{input.tema}}'),
  branchNode('valaszto', 'input.mod == "reszletes" ? "reszletes" : "rovid"'),
  agentStepNode('nem_valasztott', 'Rövid: {{input.tema}}'),
  {
    id: 'szetoszt',
    type: 'fan_out',
    label: 'szetoszt',
    positionX: 0,
    positionY: 0,
    config: {
      type: 'fan_out',
      itemsExpression: 'input.elemek',
      branchLabelTemplate: '{{item}}',
      onUnhandledError: 'fail_run',
    },
  },
  agentStepNode('elem', 'Elem {{itemIndex}}: {{item}}'),
  {
    id: 'osszezar',
    type: 'join',
    label: 'osszezar',
    positionX: 0,
    positionY: 0,
    config: { type: 'join', mode: 'merge', settings: {}, onUnhandledError: 'fail_run' },
  },
  {
    id: 'ciklus',
    type: 'loop',
    label: 'ciklus',
    positionX: 0,
    positionY: 0,
    config: { type: 'loop', maxIterations: 3, continueExpression: 'iteration < 2', onUnhandledError: 'fail_run' },
  },
  agentStepNode('kor', 'Kör {{iteration}}'),
  agentStepNode('vege', 'Vége: {{input.tema}}'),
];

const PROBE_EDGES: readonly WorkflowEdgeInput[] = [
  edge('e1', 'start', 'tema'),
  edge('e2', 'tema', 'valaszto'),
  edge('e3', 'valaszto', 'szetoszt', 'reszletes'),
  edge('e4', 'valaszto', 'nem_valasztott', 'rovid'),
  edge('e5', 'szetoszt', 'elem'),
  edge('e6', 'elem', 'osszezar'),
  edge('e7', 'osszezar', 'ciklus'),
  edge('e8', 'ciklus', 'kor', 'continue'),
  edge('e9', 'kor', 'ciklus'),
  edge('e10', 'ciklus', 'vege', 'exit'),
];

const PROBE_INPUT = { tema: 'kert', mod: 'reszletes', elemek: ['alma', 'körte', 'szilva'] };

describe('végponttól végpontig próba valódi szerver ellen (SPEC-010 12.3, 48 ... 50. kritérium)', () => {
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

  it('a REST felületen létrehozott, mentett és elindított workflow succeeded állapotban zár, a renderelt promptokkal és a kifejezések szerinti eseményekkel (48., 49. kritérium)', async () => {
    const prompts: string[] = [];
    running = await startServer(recordingAgentQueryRunner(prompts));
    const { baseUrl } = running;
    const workflowId = await createWorkflowWithGraph(baseUrl, 'vegponttol-vegpontig', PROBE_NODES, PROBE_EDGES);

    const started = await requestJson(baseUrl, 'POST', `/api/workflows/${workflowId}/runs`, { input: PROBE_INPUT });
    expect(started.status).toBe(200);
    const runId = parsedOrThrow(StartedRunResponseSchema.safeParse(started.body)).runId;

    const finishedPayload = await waitForRunFinished(baseUrl, runId);
    expect(isRecord(finishedPayload) ? finishedPayload['status'] : undefined).toBe('succeeded');
    const run = await requestJson(baseUrl, 'GET', `/api/runs/${runId}`);
    expect(parsedOrThrow(RunDetailSchema.safeParse(run.body)).status).toBe('succeeded');

    // 49.: a promptok a `RunContext` adatával renderelt szövegek. A fan_out
    // példányai párhuzamosan futnak, ezért a középső három sorrendje kötetlen.
    expect(prompts).toHaveLength(7);
    expect(prompts[0]).toBe('Téma: kert');
    expect(new Set(prompts.slice(1, 4))).toStrictEqual(new Set(['Elem 0: alma', 'Elem 1: körte', 'Elem 2: szilva']));
    expect(prompts.slice(4)).toStrictEqual(['Kör 0', 'Kör 1', 'Vége: kert']);

    const eventsResponse = await requestJson(baseUrl, 'GET', `/api/runs/${runId}/events?afterEventId=0&limit=1000`);
    const rawEvents = isRecord(eventsResponse.body) ? eventsResponse.body['events'] : undefined;
    const events = (isUnknownArray(rawEvents) ? rawEvents : []).map((event) =>
      parsedOrThrow(RunEventRecordSchema.safeParse(event)),
    );
    const payloadsOf = (kind: string): readonly unknown[] =>
      events.filter((event) => event.kind === kind).map((event) => event.payload);

    expect(payloadsOf('branch_taken')).toStrictEqual([{ branchKey: 'reszletes', usedDefault: false }]);
    expect(payloadsOf('fan_out_expanded')).toStrictEqual([{ itemCount: 3 }]);
    expect(
      payloadsOf('loop_iteration_started').map((payload) => (isRecord(payload) ? payload['iteration'] : undefined)),
    ).toStrictEqual([0, 1]);

    const stepsResponse = await requestJson(baseUrl, 'GET', `/api/runs/${runId}/steps`);
    const steps = (isUnknownArray(stepsResponse.body) ? stepsResponse.body : []).map((step) =>
      parsedOrThrow(StepRunRecordSchema.safeParse(step)),
    );
    const nodeIds = steps.map((step) => step.nodeId);
    expect(nodeIds).not.toContain('nem_valasztott');
    expect(nodeIds.filter((nodeId) => nodeId === 'elem')).toHaveLength(3);
    expect(steps.every((step) => step.status === 'succeeded')).toBe(true);
  });

  it('a fordíthatatlan kifejezést tartalmazó gráf indítása 422, a csomópont és a mező nevével, futás sor nélkül (50. kritérium)', async () => {
    const prompts: string[] = [];
    running = await startServer(recordingAgentQueryRunner(prompts));
    const { baseUrl } = running;
    const workflowId = await createWorkflowWithGraph(
      baseUrl,
      'forditatlan-kifejezes',
      [START_NODE, branchNode('valaszto', 'input.mod =='), agentStepNode('nem_valasztott', 'Rövid')],
      [edge('e1', 'start', 'valaszto'), edge('e2', 'valaszto', 'nem_valasztott', 'rovid')],
    );

    const started = await requestJson(baseUrl, 'POST', `/api/workflows/${workflowId}/runs`, { input: {} });

    expect(started.status).toBe(422);
    const error = parsedOrThrow(ProtocolErrorBodySchema.safeParse(started.body));
    expect(error.code).toBe('unprocessable');
    expect(error.errorClass).toBe('expression_evaluation_failed');
    expect(error.message).toContain('valaszto');
    expect(error.message).toContain('expression');
    const runs = await requestJson(baseUrl, 'GET', `/api/runs?limit=10&workflowId=${workflowId}`);
    expect(runs.status).toBe(200);
    expect(runs.body).toStrictEqual([]);
    expect(prompts).toStrictEqual([]);
  });

  // 33.: a valódi portok elutasító üzenete a csomópontot, a mezőt és zárójelben az osztályt
  // nevezi meg, a hibás szöveg egyedi jelölőjét viszont nem idézi (SPEC-010 9.5).
  it.each([
    {
      name: 'sablon',
      marker: 'HOSSZU_EGYEDI_JELOLO_SABLON_7c1e9b_a_szoveg_nem_kerulhet_az_uzenetbe',
      nodes: (marker: string): readonly WorkflowNodeInput[] => [
        START_NODE,
        agentStepNode('ir', `Szia {{#${marker}}} vége`),
      ],
      edges: [edge('e1', 'start', 'ir')],
      nodeId: 'ir',
      field: 'promptTemplate',
      errorClass: 'template_render_failed',
    },
    {
      name: 'kifejezés',
      marker: 'HOSSZU_EGYEDI_JELOLO_KIFEJEZES_3f8a2d_a_szoveg_nem_kerulhet_az_uzenetbe',
      nodes: (marker: string): readonly WorkflowNodeInput[] => [
        START_NODE,
        branchNode('valaszto', `input.${marker} +`),
        agentStepNode('nem_valasztott', 'Rövid'),
      ],
      edges: [edge('e1', 'start', 'valaszto'), edge('e2', 'valaszto', 'nem_valasztott', 'rovid')],
      nodeId: 'valaszto',
      field: 'expression',
      errorClass: 'expression_evaluation_failed',
    },
  ])(
    'a fordíthatatlan $name elutasító üzenete a csomópontot, a mezőt és az osztályt nevezi meg, a hosszú egyedi jelölőt nem (33. kritérium)',
    async ({ marker, nodes, edges, nodeId, field, errorClass }) => {
      running = await startServer(recordingAgentQueryRunner([]));
      const { baseUrl } = running;
      const workflowId = await createWorkflowWithGraph(baseUrl, `jelolo-${field}`, nodes(marker), edges);

      const started = await requestJson(baseUrl, 'POST', `/api/workflows/${workflowId}/runs`, { input: {} });

      expect(started.status).toBe(422);
      const error = parsedOrThrow(ProtocolErrorBodySchema.safeParse(started.body));
      expect(error.errorClass).toBe(errorClass);
      expect(error.message).toContain(nodeId);
      expect(error.message).toContain(field);
      expect(error.message.endsWith(`(${errorClass}).`)).toBe(true);
      expect(error.message).not.toContain(marker);
      expect(error.message).not.toContain('HOSSZU_EGYEDI_JELOLO');
    },
  );
});
