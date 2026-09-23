import { describe, expect, it } from 'vitest';
import { request as httpRequest, type IncomingMessage, type Server } from 'node:http';
import type { AgentQueryRunner } from '@easter-workflow-builder/agent';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createEngine, type TemplateRendererPort } from '@easter-workflow-builder/engine';
import { decodeStreamFrame, type StreamFrame } from '@easter-workflow-builder/protocol';
import { createServerLogger, type DestinationStream } from '@easter-workflow-builder/logger';
import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import { createHttpServer } from '../http-server/create-http-server.ts';
import { buildRouteHandlers } from '../route-registry/build-route-handlers.ts';
import { buildEngineDependencies } from '../engine-assembly/build-engine-dependencies.ts';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { createSystemClock } from '../engine-assembly/create-system-clock.ts';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { runShutdownSequence } from './run-shutdown-sequence.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

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

function listen(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });
}

function baseUrlOf(server: Server): string {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('A teszt szerver nem kapott portot.');
  }
  return `http://127.0.0.1:${String(address.port)}`;
}

const PASS_THROUGH_TEMPLATE_RENDERER: TemplateRendererPort = {
  render: (template) => ({ kind: 'ok', value: template }),
  compile: () => ({ kind: 'ok', value: undefined }),
};

/**
 * Egy `start -> human_approval` workflow, korlátlan várakozással: a futás a
 * jóváhagyáson áll, amíg valaki meg nem szakítja.
 */
/* eslint-disable unicorn/no-null -- a leírás, a `timeoutMs` (korlátlan várakozás, SPEC-004 5.8) és az él kezelő és ág kulcs mezői valódi NULL értéket tárolnak (SPEC-003 4.4) */
function seedWaitingApprovalWorkflow(database: DatabaseContext): string {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'leallas', description: null, providerId: 'claude-subscription' }),
  );
  okOrThrow(
    database.workflows.replaceGraph(
      workflow.id,
      [
        {
          id: 'start',
          label: 'start',
          positionX: 0,
          positionY: 0,
          config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
        },
        {
          id: 'jov',
          label: 'jov',
          positionX: 0,
          positionY: 0,
          config: {
            type: 'human_approval',
            title: 'Döntés',
            bodyTemplate: 'szöveg',
            timeoutMs: null,
            onUnhandledError: 'fail_run',
          },
        },
      ],
      [
        {
          id: 'e1',
          sourceNodeId: 'start',
          targetNodeId: 'jov',
          sourceHandle: null,
          targetHandle: null,
          branchKey: null,
        },
      ],
    ),
  );
  return workflow.id;
}
/* eslint-enable unicorn/no-null */

/**
 * Egy `start -> agent_step` workflow a valódi `claude-subscription` leíróval
 * (a szerver saját `buildProviderDescriptorLookup` portja dönt róla).
 */
/* eslint-disable unicorn/no-null -- a node config nullázható mezői és az él kezelő és ág kulcs mezői valódi NULL értéket tárolnak (SPEC-003 4.4) */
function seedAgentStepWorkflow(database: DatabaseContext): string {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({
      name: 'leallas-kozbeni-inditas',
      description: null,
      providerId: 'claude-subscription',
    }),
  );
  okOrThrow(
    database.workflows.replaceGraph(
      workflow.id,
      [
        {
          id: 'start',
          label: 'start',
          positionX: 0,
          positionY: 0,
          config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
        },
        {
          id: 'a1',
          label: 'a1',
          positionX: 0,
          positionY: 0,
          config: {
            type: 'agent_step',
            onUnhandledError: 'fail_run',
            promptTemplate: 'szöveg',
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
            agentTools: [],
            sessionMode: 'isolated',
            structuredOutput: null,
          },
        },
      ],
      [
        {
          id: 'e1',
          sourceNodeId: 'start',
          targetNodeId: 'a1',
          sourceHandle: null,
          targetHandle: null,
          branchKey: null,
        },
      ],
    ),
  );
  return workflow.id;
}
/* eslint-enable unicorn/no-null */

/**
 * Hamis agent futtató, valós API hívás nélkül. Az ELSŐ hívás lépése az
 * `init` üzenet után addig áll, amíg a teszt a `release` hívással el nem
 * engedi, és az `interrupt()` NEM engedi el azonnal: így a leállás a futó
 * lépés leállítására várva "tart", ahogy a mért esetben. Minden további hívás
 * azonnal sikeres lépést ad, hogy egy javítás nélkül elinduló második futás
 * ne akassza el a tesztet, csak a hívásszám árulja el.
 */
function holdingAgentRunner(): {
  readonly runner: AgentQueryRunner;
  readonly runCalls: () => number;
  readonly firstStepStarted: Promise<undefined>;
  readonly interruptCalled: Promise<undefined>;
  readonly release: () => void;
} {
  let calls = 0;
  const started = Promise.withResolvers<undefined>();
  const interrupted = Promise.withResolvers<undefined>();
  const released = Promise.withResolvers<undefined>();
  const result = {
    type: 'result',
    subtype: 'success',
    num_turns: 1,
    usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  };

  async function* heldStream(): AsyncGenerator {
    yield { type: 'system', subtype: 'init', session_id: 's1', uuid: 's1-1' };
    started.resolve(undefined);
    await released.promise;
    yield { ...result, session_id: 's1', uuid: 's1-2' };
  }

  async function* immediateStream(index: number): AsyncGenerator {
    await Promise.resolve();
    yield { type: 'system', subtype: 'init', session_id: `s${String(index)}`, uuid: `s${String(index)}-1` };
    yield { ...result, session_id: `s${String(index)}`, uuid: `s${String(index)}-2` };
  }

  return {
    runner: {
      run: () => {
        calls += 1;
        return {
          kind: 'ok',
          value: {
            messages: calls === 1 ? heldStream() : immediateStream(calls),
            interrupt: () => {
              interrupted.resolve(undefined);
              return Promise.resolve();
            },
          },
        };
      },
    },
    runCalls: () => calls,
    firstStepStarted: started.promise,
    interruptCalled: interrupted.promise,
    release: () => {
      released.resolve(undefined);
    },
  };
}

/**
 * A válasz törzsének beolvasása szövegként.
 */
async function readResponseText(response: IncomingMessage): Promise<string> {
  let text = '';
  for await (const chunk of response) {
    text += String(chunk);
  }
  return text;
}

/**
 * Az SSE folyam olvasása, amíg a `isDone` igazat nem ad a már beérkezett
 * keretekre, vagy a szerver le nem zárja a kapcsolatot. Minden `data:` sor a
 * `protocol` `decodeStreamFrame` ellenőrzésén megy át.
 */
async function readFramesUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  isDone: (frames: readonly StreamFrame[]) => boolean,
): Promise<readonly StreamFrame[]> {
  const decoder = new TextDecoder();
  const frames: StreamFrame[] = [];
  let buffered = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return frames;
    }
    buffered += decoder.decode(value, { stream: true });
    const blocks = buffered.split('\n\n');
    buffered = blocks.pop() ?? '';
    for (const block of blocks) {
      const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
      if (dataLine !== undefined) {
        const parsed: unknown = JSON.parse(dataLine.slice('data: '.length));
        frames.push(okOrThrow(decodeStreamFrame(parsed)));
      }
    }
    if (isDone(frames)) {
      return frames;
    }
  }
}

describe('runShutdownSequence', () => {
  it('sikeres leállásra minden lépést végrehajt és 0 kilépési kódot ad', async () => {
    const database = openMemoryDatabase();
    const streamRegistry = createStreamRegistry(createRandomUuidIdGenerator());
    const clock = createSystemClock();
    const engine = createEngine(buildEngineDependencies(database, streamRegistry, clock));
    const server = createHttpServer({
      handlers: buildRouteHandlers(database, engine, streamRegistry),
      devOrigin: undefined,
      streamDependencies: { database, registry: streamRegistry, clock, keepAliveIntervalMs: 15_000 },
    });
    await listen(server);
    const { sink, lines } = collectingSink();
    const logger = createServerLogger({ secretValues: [] }, sink);

    const exitCode = await runShutdownSequence({ server, engine, database, logger, streamRegistry });

    expect(exitCode).toBe(0);
    expect(lines.some((line) => line.includes('A szerver leállt.'))).toBe(true);
  });

  it('nyitott SSE kapcsolat mellett nem akad el, és a run_interrupted keret élőben kimegy, mielőtt a kapcsolat lezárul', async () => {
    const database = openMemoryDatabase();
    const streamRegistry = createStreamRegistry(createRandomUuidIdGenerator());
    const clock = createSystemClock();
    // Az átengedő sablon renderelő az egyetlen eltérés a valódi
    // összeállítástól: a szállított, elutasító renderelő mellett a
    // `human_approval` lépés azonnal elbukna (SPEC-004 O-1), tehát nem lenne
    // várakozó futás, amit a leállás megszakíthat.
    const engine = createEngine({
      ...buildEngineDependencies(database, streamRegistry, clock),
      templateRenderer: PASS_THROUGH_TEMPLATE_RENDERER,
    });
    const server = createHttpServer({
      handlers: buildRouteHandlers(database, engine, streamRegistry),
      devOrigin: undefined,
      streamDependencies: { database, registry: streamRegistry, clock, keepAliveIntervalMs: 15_000 },
    });
    await listen(server);
    const { sink } = collectingSink();
    const logger = createServerLogger({ secretValues: [] }, sink);
    const workflowId = seedWaitingApprovalWorkflow(database);

    const stream = await fetch(`${baseUrlOf(server)}/events?streamId=s1`);
    const reader = stream.body?.getReader();
    if (reader === undefined) {
      throw new Error('a stream válasz nem olvasható');
    }
    const started = okOrThrow(await engine.startRun({ workflowId, input: {} }));
    streamRegistry.replaceSubscriptions('s1', [{ runId: started.run.id, fromEventId: 0, replayLimit: 500 }]);
    const beforeShutdown = await readFramesUntil(reader, (frames) =>
      frames.some((frame) => frame.event === 'run_event' && frame.runEvent.kind === 'approval_requested'),
    );

    const exitCode = await runShutdownSequence({ server, engine, database, logger, streamRegistry });
    const afterShutdown = await readFramesUntil(reader, () => false);

    expect(exitCode).toBe(0);
    const interruptedFrames = [...beforeShutdown, ...afterShutdown].filter(
      (frame) => frame.event === 'run_event' && frame.runEvent.kind === 'run_interrupted',
    );
    expect(interruptedFrames).toHaveLength(1);
    expect(interruptedFrames[0]).toMatchObject({
      delivery: 'live',
      runEvent: { runId: started.run.id, payload: { reason: 'graceful_shutdown' } },
    });
  });

  it('REGRESSZIÓ: a jel ELŐTT fejléccel megkezdett, de csak a leállás alatt befejezett indító kérés nem indít futást, hanem engine_shutting_down hibát kap (SPEC-006 8.2, SPEC-004 10.2 1. pont)', async () => {
    const database = openMemoryDatabase();
    const streamRegistry = createStreamRegistry(createRandomUuidIdGenerator());
    const clock = createSystemClock();
    const agent = holdingAgentRunner();
    // A valódi összeállítástól három eltérés van, mindhárom a tesztelhetőségé:
    // hamis agent futtató (valós API hívás nincs), átengedő sablon renderelő
    // (a szállított elutasító mellett az agent lépés el sem indulna, SPEC-004
    // O-1), és üres környezet olvasó (a gazdagép env változói ne döntsenek).
    const engine = createEngine({
      ...buildEngineDependencies(database, streamRegistry, clock),
      agentQueryRunner: agent.runner,
      templateRenderer: PASS_THROUGH_TEMPLATE_RENDERER,
      // eslint-disable-next-line unicorn/no-null -- a `ProcessEnvironmentPort.read` szerződése szerint a `null` a "nincs ilyen env változó" érték
      processEnvironment: { read: () => null },
    });
    const server = createHttpServer({
      handlers: buildRouteHandlers(database, engine, streamRegistry),
      devOrigin: undefined,
      streamDependencies: { database, registry: streamRegistry, clock, keepAliveIntervalMs: 15_000 },
    });
    await listen(server);
    const { sink } = collectingSink();
    const logger = createServerLogger({ secretValues: [] }, sink);
    const workflowId = seedAgentStepWorkflow(database);
    const runsUrl = `${baseUrlOf(server)}/api/workflows/${workflowId}/runs`;
    const body = JSON.stringify({ input: {} });

    const first = await fetch(runsUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    expect(first.status).toBe(200);
    await agent.firstStepStarted;

    // A második kérés fejléce a leállás ELŐTT megy ki és a szerver már
    // kiszolgálja (a kezelő a törzsre vár), a törzs csak a leállás alatt jön.
    const requestArrived = new Promise<void>((resolve) => {
      server.once('request', () => {
        resolve();
      });
    });
    const halfSent = httpRequest(runsUrl, {
      method: 'POST',
      agent: false,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    });
    const responsePromise = new Promise<IncomingMessage>((resolve) => {
      halfSent.once('response', resolve);
    });
    halfSent.flushHeaders();
    await requestArrived;

    const shutdown = runShutdownSequence({ server, engine, database, logger, streamRegistry });
    // A leállás a futó lépés leállítására vár: az `interrupt()` lefutott, a
    // lépés folyama viszont még nem ért véget.
    await agent.interruptCalled;
    halfSent.end(body);
    const response = await responsePromise;
    const responseBody: unknown = JSON.parse(await readResponseText(response));
    const runIdsDuringShutdown = okOrThrow(database.runs.listRuns()).map((run) => run.id);
    agent.release();
    const exitCode = await shutdown;

    expect(response.statusCode).toBe(500);
    expect(responseBody).toMatchObject({ code: 'internal' });
    expect(isRecord(responseBody) && isString(responseBody['message']) ? responseBody['message'] : '').toContain(
      '(engine_shutting_down)',
    );
    expect(runIdsDuringShutdown).toHaveLength(1);
    expect(agent.runCalls()).toBe(1);
    expect(exitCode).toBe(0);
  });

  it('a motor leállási hibaágán 1 kilépési kódot ad, az adatbázist mégis zárja', async () => {
    const database = openMemoryDatabase();
    const racyDatabase: DatabaseContext = {
      ...database,
      recovery: {
        ...database.recovery,
        recoverInterruptedRuns: () => ({ kind: 'error', message: 'teszt: helyreállítási hiba' }),
      },
    };
    const streamRegistry = createStreamRegistry(createRandomUuidIdGenerator());
    const clock = createSystemClock();
    const engine = createEngine(buildEngineDependencies(racyDatabase, streamRegistry, clock));
    const server = createHttpServer({
      handlers: buildRouteHandlers(racyDatabase, engine, streamRegistry),
      devOrigin: undefined,
      streamDependencies: { database: racyDatabase, registry: streamRegistry, clock, keepAliveIntervalMs: 15_000 },
    });
    await listen(server);
    const { sink, lines } = collectingSink();
    const logger = createServerLogger({ secretValues: [] }, sink);

    const exitCode = await runShutdownSequence({ server, engine, database: racyDatabase, logger, streamRegistry });

    expect(exitCode).toBe(1);
    expect(lines.some((line) => line.includes('A motor leállása hibával zárult.'))).toBe(true);
  });
});
