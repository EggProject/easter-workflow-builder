import { describe, expect, it, afterEach } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext, type WorkflowEdgeInput } from '@easter-workflow-builder/db';
import { createEngine } from '@easter-workflow-builder/engine';
import { createServerLogger, type DestinationStream, type ServerLogger } from '@easter-workflow-builder/logger';
import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import type { BinaryRouteHandler, BinaryRouteHandlerContext } from '../route-dispatch/binary-route-handler.ts';
import type { RouteHandler, RouteHandlerContext } from '../route-dispatch/route-handler.ts';
import type { RouteHandlers } from '../route-dispatch/route-handlers.ts';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { createSystemClock } from '../engine-assembly/create-system-clock.ts';
import { buildEngineDependencies } from '../engine-assembly/build-engine-dependencies.ts';
import { createStartRunHandler } from '../run-endpoint/start-run.ts';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import type { StreamConnectionDependencies } from '../stream-connection/handle-stream-connection.ts';
import { createHttpServer, readLastEventIdHeader, type HttpServerOptions } from './create-http-server.ts';
import { TEST_SKILL_LIBRARY } from '../skill-endpoint/test-skill-library.ts';

const DEFAULT_HANDLER: RouteHandler = () => Promise.resolve({ kind: 'ok', value: { status: 200, body: { ok: true } } });
const DEFAULT_BINARY_HANDLER: BinaryRouteHandler = {
  maxBodyBytes: 0,
  handle: () => Promise.resolve({ kind: 'ok', value: { status: 200, body: { ok: true } } }),
};

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function buildStreamDependencies(): StreamConnectionDependencies {
  const database: DatabaseContext = okOrThrow(openDatabase(':memory:'));
  return {
    database,
    registry: createStreamRegistry(createRandomUuidIdGenerator()),
    clock: createSystemClock(),
    keepAliveIntervalMs: 60_000,
  };
}

interface MemorySink extends DestinationStream {
  readonly lines: () => readonly Record<string, unknown>[];
}

/**
 * Ugyanaz a mérő minta, mint a `packages/logger` `create-server-logger.spec.ts`-ben:
 * valódi `createServerLogger`, befecskendezett memória nyelővel, hogy a
 * naplósorok JSON alakban vizsgálhatók legyenek.
 */
function createMemorySink(): MemorySink {
  const chunks: string[] = [];
  return {
    write(message: string): void {
      chunks.push(message);
    },
    lines(): readonly Record<string, unknown>[] {
      return chunks
        .join('')
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => {
          const parsed: unknown = JSON.parse(line);
          if (!isRecord(parsed)) {
            throw new Error('a pino sor nem objektum alakú JSON');
          }
          return parsed;
        });
    },
  };
}

function buildCapturingLogger(): { logger: ServerLogger; sink: MemorySink } {
  const sink = createMemorySink();
  return { logger: createServerLogger({ secretValues: [] }, sink), sink };
}

/**
 * A `ROUTE_TABLE` mind a 26 kulcsára egy alapértelmezett, felülírható
 * kezelőt ad, hogy a `HttpServerOptions.handlers` kimerítő rekordja a
 * tesztben is előálljon, kézzel felsorolva - ugyanaz a minta, mint ahogy a
 * valós összeállítás (`route-registry` téma) is felépíti majd.
 */
function buildHandlers(overrides: Partial<RouteHandlers>): RouteHandlers {
  const base: RouteHandlers = {
    listWorkflows: DEFAULT_HANDLER,
    createWorkflow: DEFAULT_HANDLER,
    getWorkflow: DEFAULT_HANDLER,
    updateWorkflow: DEFAULT_HANDLER,
    deleteWorkflow: DEFAULT_HANDLER,
    summarizeWorkflowDeletion: DEFAULT_HANDLER,
    readWorkflowGraph: DEFAULT_HANDLER,
    replaceWorkflowGraph: DEFAULT_HANDLER,
    startRun: DEFAULT_HANDLER,
    listRuns: DEFAULT_HANDLER,
    getRun: DEFAULT_HANDLER,
    readRunSnapshot: DEFAULT_HANDLER,
    listStepRuns: DEFAULT_HANDLER,
    readRunEvents: DEFAULT_HANDLER,
    interruptRun: DEFAULT_HANDLER,
    restartRun: DEFAULT_HANDLER,
    listPendingApprovals: DEFAULT_HANDLER,
    decideApproval: DEFAULT_HANDLER,
    listProviders: DEFAULT_HANDLER,
    testProviderConnection: DEFAULT_HANDLER,
    readSettings: DEFAULT_HANDLER,
    updateSettings: DEFAULT_HANDLER,
    listConcurrencyLimits: DEFAULT_HANDLER,
    setConcurrencyLimit: DEFAULT_HANDLER,
    clearConcurrencyLimit: DEFAULT_HANDLER,
    replaceStreamSubscriptions: DEFAULT_HANDLER,
    listSkills: DEFAULT_HANDLER,
    uploadSkill: DEFAULT_BINARY_HANDLER,
    deleteSkill: DEFAULT_HANDLER,
  };
  return { ...base, ...overrides };
}

function buildOptions(
  overrides: Partial<RouteHandlers>,
  developmentOrigin: string | undefined,
  logger: ServerLogger = buildCapturingLogger().logger,
): HttpServerOptions {
  return {
    handlers: buildHandlers(overrides),
    devOrigin: developmentOrigin,
    streamDependencies: buildStreamDependencies(),
    logger,
    idGenerator: createRandomUuidIdGenerator(),
  };
}

/* eslint-disable unicorn/no-null -- a leírás és az él kezelő és ág kulcs mezői valódi NULL értéket tárolnak (SPEC-003 4.4) */
function edgeOf(id: string, sourceNodeId: string, targetNodeId: string): WorkflowEdgeInput {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey: null };
}

/**
 * Egy `start -> fan_out -> join` workflow a valódi adatbázisban, a `fan_out`
 * két mezőjének kívülről adott szövegével: így egy fordíthatatlan sablon vagy
 * kifejezés a motor indítási ellenőrzésén (SPEC-010 9.2) bukik.
 */
function seedFanOutWorkflow(
  database: DatabaseContext,
  fields: { readonly itemsExpression: string; readonly branchLabelTemplate: string },
): string {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'forditas', description: null, providerId: 'claude-subscription' }),
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
          id: 'fo',
          label: 'fo',
          positionX: 0,
          positionY: 0,
          config: { type: 'fan_out', ...fields, onUnhandledError: 'fail_run' },
        },
        {
          id: 'j',
          label: 'j',
          positionX: 0,
          positionY: 0,
          config: { type: 'join', mode: 'merge', onUnhandledError: 'fail_run' },
        },
      ],
      [edgeOf('e1', 'start', 'fo'), edgeOf('e2', 'fo', 'j')],
    ),
  );
  return workflow.id;
}
/* eslint-enable unicorn/no-null */

async function startTestServer(options: HttpServerOptions): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createHttpServer(options);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('A teszt szerver nem kapott portot.');
  }
  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    close: () =>
      new Promise<void>((resolve) => {
        // A stream végpont szándékosan tartósan nyitott kapcsolatot hagyhat hátra
        // (SPEC-006 6. szekció): a teszt zárása ezért a valódi leállás mintáját
        // követi (SPEC-006 8.1 4. lépés), különben a `close()` visszahívás sosem futna le.
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}

describe('createHttpServer', () => {
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (closeServer === undefined) {
      return;
    }
    await closeServer();
    closeServer = undefined;
  });

  it('ismert útvonalon a kezelő válaszát adja vissza', async () => {
    const { baseUrl, close } = await startTestServer(
      buildOptions(
        { listWorkflows: () => Promise.resolve({ kind: 'ok', value: { status: 200, body: [{ id: '1' }] } }) },
        undefined,
      ),
    );
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows?limit=10`);
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual([{ id: '1' }]);
  });

  it('a kezelő megkapja az útvonal paramétert, a query stringet és a JSON törzset', async () => {
    let seen: RouteHandlerContext | undefined;
    const { baseUrl, close } = await startTestServer(
      buildOptions(
        {
          updateWorkflow: (context) => {
            seen = context;
            return Promise.resolve({ kind: 'ok', value: { status: 200, body: { received: true } } });
          },
        },
        undefined,
      ),
    );
    closeServer = close;

    await fetch(`${baseUrl}/api/workflows/wf-1?verbose=1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'új név' }),
    });

    expect(seen?.parameters).toStrictEqual({ workflowId: 'wf-1' });
    expect(seen?.query.get('verbose')).toBe('1');
    expect(seen?.body).toStrictEqual({ name: 'új név' });
  });

  it('ismeretlen útvonalra 404-et ad, not_found kóddal', async () => {
    const { baseUrl, close } = await startTestServer(buildOptions({}, undefined));
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/nincs-ilyen`);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'not_found' });
  });

  it('ismert útvonalon rossz metódusra 405-öt ad, Allow fejléccel', async () => {
    const { baseUrl, close } = await startTestServer(buildOptions({}, undefined));
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows`, { method: 'DELETE' });
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, POST');
    expect(await response.json()).toMatchObject({ code: 'not_found' });
  });

  it('rosszul formázott JSON törzsre 400-at ad, invalid_request kóddal, a nyers törzs visszhangzása nélkül', async () => {
    const { baseUrl, close } = await startTestServer(buildOptions({}, undefined));
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{titkos-token: "nem json',
    });
    expect(response.status).toBe(400);
    const payload: unknown = await response.json();
    expect(payload).toMatchObject({ code: 'invalid_request' });
    expect(JSON.stringify(payload)).not.toContain('titkos-token');
  });

  it('a kezelő Outcome hibaágát a mapOutcomeMessageToErrorCode szerinti státuszra képezi', async () => {
    const { baseUrl, close } = await startTestServer(
      buildOptions(
        {
          getWorkflow: () =>
            Promise.resolve({ kind: 'error', message: 'A(z) "x" workflow nem található (not_found).' }),
        },
        undefined,
      ),
    );
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows/x`);
    expect(response.status).toBe(404);
    expect(await response.json()).toStrictEqual({
      code: 'not_found',
      message: 'A(z) "x" workflow nem található (not_found).',
    });
  });

  it('a szótárban álló hibaosztályt errorClass mezőben is kiírja, 422-vel (SPEC-005 8.5)', async () => {
    const message = 'Nincs alapértelmezett provider beállítva (no_default_provider).';
    const { baseUrl, close } = await startTestServer(
      buildOptions({ startRun: () => Promise.resolve({ kind: 'error', message }) }, undefined),
    );
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows/wf-1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toStrictEqual({ code: 'unprocessable', message, errorClass: 'no_default_provider' });
  });

  // SPEC-010 9.3, 39. kritérium: a T-010-12 óta a motor a fordíthatatlan
  // sablont és kifejezést a futás indításakor elutasítja, de a két osztály a
  // leképezésben nem szerepelt, tehát a válasz 500 internal volt.
  it.each([
    {
      errorClass: 'template_render_failed',
      fields: { itemsExpression: '[1]', branchLabelTemplate: '{{#nyitott}}elem' },
    },
    {
      errorClass: 'expression_evaluation_failed',
      fields: { itemsExpression: '[1,', branchLabelTemplate: 'elem {{itemIndex}}' },
    },
  ])(
    'REGRESSZIÓ: a valódi motor $errorClass indítási elutasítása 422 unprocessable, futás sor nélkül (SPEC-010 9.3)',
    async ({ errorClass, fields }) => {
      const database = okOrThrow(openDatabase(':memory:'));
      const registry = createStreamRegistry(createRandomUuidIdGenerator());
      const engine = createEngine(
        buildEngineDependencies(
          database,
          registry,
          createSystemClock(),
          buildCapturingLogger().logger,
          TEST_SKILL_LIBRARY.rootDirectory,
        ),
      );
      const workflowId = seedFanOutWorkflow(database, fields);
      const { baseUrl, close } = await startTestServer(
        buildOptions({ startRun: createStartRunHandler(engine) }, undefined),
      );
      closeServer = close;

      const response = await fetch(`${baseUrl}/api/workflows/${workflowId}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: {} }),
      });

      expect(response.status).toBe(422);
      const payload: unknown = await response.json();
      expect(payload).toMatchObject({ code: 'unprocessable' });
      const message = isRecord(payload) ? payload['message'] : undefined;
      expect(isString(message) && message.endsWith(`(${errorClass}).`)).toBe(true);
      // A zárt szótár tagja (SPEC-005 8.5, user döntés 2026-10-25): a törzs `errorClass` mezőt is hordoz.
      expect(payload).toMatchObject({ errorClass });
      expect(okOrThrow(database.runs.listRuns())).toStrictEqual([]);
    },
  );

  it('a kezelő invalid_request hibaágát 400-ra képezi, nem 500-ra (regresszió, 2026-09-26)', async () => {
    const message = 'A kérés törzse érvénytelen, hibás mező(k): name (invalid_request).';
    const { baseUrl, close } = await startTestServer(
      buildOptions({ createWorkflow: () => Promise.resolve({ kind: 'error', message }) }, undefined),
    );
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toStrictEqual({ code: 'invalid_request', message });
  });

  it('az internal kódra képződő hibaválaszt error szinten naplózza, az EREDETI (osztály nélküli, egyébként szivárogtató) Outcome üzenettel és a szerver kontextussal (SPEC-006 7.2)', async () => {
    const { logger, sink } = buildCapturingLogger();
    const message = 'ismeretlen, zárójel nélküli belső hiba';
    const { baseUrl, close } = await startTestServer(
      buildOptions({ getWorkflow: () => Promise.resolve({ kind: 'error', message }) }, undefined, logger),
    );
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows/x`);
    expect(response.status).toBe(500);
    // A törzs a saját, nyers szöveget nem tartalmazó mondatot kapja (2026-09-27).
    const body: unknown = await response.json();
    expect(isRecord(body) ? body['message'] : undefined).not.toBe(message);

    const [entry] = sink.lines();
    expect(entry?.['level']).toBe(50);
    expect(entry?.['msg']).toBe(message);
    expect(entry?.['routeId']).toBe('getWorkflow');
    expect(typeof entry?.['serverInstanceId']).toBe('string');
    expect(typeof entry?.['requestId']).toBe('string');
  });

  it('a conflict és az unprocessable kódra képződő hibaválaszt warn szinten naplózza', async () => {
    const { logger, sink } = buildCapturingLogger();
    const message =
      'A gráf egy azonosítója már foglalt: UNIQUE constraint failed: workflow_node.id (graph_id_conflict).';
    const { baseUrl, close } = await startTestServer(
      buildOptions({ replaceWorkflowGraph: () => Promise.resolve({ kind: 'error', message }) }, undefined, logger),
    );
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows/x/graph`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes: [], edges: [] }),
    });
    expect(response.status).toBe(409);

    const [entry] = sink.lines();
    expect(entry?.['level']).toBe(40);
    expect(entry?.['msg']).toBe(message);
  });

  it('a not_found és az invalid_request kódra képződő hibaválaszt NEM naplózza', async () => {
    const { logger, sink } = buildCapturingLogger();
    const { baseUrl, close } = await startTestServer(buildOptions({}, undefined, logger));
    closeServer = close;

    await fetch(`${baseUrl}/api/nincs-ilyen`);
    await fetch(`${baseUrl}/api/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{nem json',
    });

    expect(sink.lines()).toHaveLength(0);
  });

  it('a kezelőben eldobott kivételt error szinten naplózza, a kivétellel', async () => {
    const { logger, sink } = buildCapturingLogger();
    const { baseUrl, close } = await startTestServer(
      buildOptions(
        {
          listWorkflows: () => {
            throw new Error('titkos verem nyomkövetési részlet');
          },
        },
        undefined,
        logger,
      ),
    );
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows`);
    expect(response.status).toBe(500);

    const [entry] = sink.lines();
    expect(entry?.['level']).toBe(50);
    expect(entry?.['msg']).toBe('Váratlan szerver hiba történt (internal).');
    const loggedError = entry?.['err'];
    expect(isRecord(loggedError) ? loggedError['message'] : undefined).toBe('titkos verem nyomkövetési részlet');
  });

  it('két kérés különböző requestId kontextussal naplózódik', async () => {
    const { logger, sink } = buildCapturingLogger();
    const { baseUrl, close } = await startTestServer(
      buildOptions(
        { getWorkflow: () => Promise.resolve({ kind: 'error', message: 'x (database_closed).' }) },
        undefined,
        logger,
      ),
    );
    closeServer = close;

    await fetch(`${baseUrl}/api/workflows/x`);
    await fetch(`${baseUrl}/api/workflows/y`);

    const [first, second] = sink.lines();
    expect(first?.['requestId']).not.toBe(second?.['requestId']);
  });

  it('204 státusznál nincs válasz törzs', async () => {
    const { baseUrl, close } = await startTestServer(
      buildOptions(
        { clearConcurrencyLimit: () => Promise.resolve({ kind: 'ok', value: { status: 204, body: undefined } }) },
        undefined,
      ),
    );
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/settings/concurrency-limits/minimax`, { method: 'DELETE' });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('a stream útvonalon konfigurált fejlesztői origin esetén CORS fejlécet küld, 200 státusszal és text/event-stream típussal', async () => {
    const { baseUrl, close } = await startTestServer(buildOptions({}, 'http://localhost:5173'));
    closeServer = close;

    const response = await fetch(`${baseUrl}/events?streamId=s1`);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    await response.body?.cancel();
  });

  it('a stream első kerete mindig stream_ready, ismeretlen streamId esetén is', async () => {
    const { baseUrl, close } = await startTestServer(buildOptions({}, undefined));
    closeServer = close;

    const response = await fetch(`${baseUrl}/events?streamId=ismeretlen`);
    const reader = response.body?.getReader();
    if (reader === undefined) {
      throw new Error('a stream válasz nem olvasható');
    }
    const { value } = await reader.read();
    const chunk = new TextDecoder().decode(value);
    expect(chunk).toContain('event: stream_ready');
    expect(chunk).toContain('"streamId":"ismeretlen"');
    await reader.cancel();
  });

  it('a stream útvonalon hiányzó streamId query paraméterre üres stringgel nyit kapcsolatot', async () => {
    const { baseUrl, close } = await startTestServer(buildOptions({}, undefined));
    closeServer = close;

    const response = await fetch(`${baseUrl}/events`);
    const reader = response.body?.getReader();
    if (reader === undefined) {
      throw new Error('a stream válasz nem olvasható');
    }
    const { value } = await reader.read();
    const chunk = new TextDecoder().decode(value);
    expect(chunk).toContain('"streamId":""');
    await reader.cancel();
  });

  it('nem stream útvonalon konfigurált origin mellett sem küld CORS fejlécet', async () => {
    const { baseUrl, close } = await startTestServer(buildOptions({}, 'http://localhost:5173'));
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows`);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('a kezelőben eldobott kivételre 500-at ad, a hiba részletei nélkül', async () => {
    const { baseUrl, close } = await startTestServer(
      buildOptions(
        {
          listWorkflows: () => {
            throw new Error('titkos verem nyomkövetési részlet');
          },
        },
        undefined,
      ),
    );
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows`);
    expect(response.status).toBe(500);
    const payload: unknown = await response.json();
    expect(payload).toStrictEqual({ code: 'internal', message: 'Váratlan szerver hiba történt (internal).' });
  });
});

function recordingBinaryHandler(maxBodyBytes: number, seen: BinaryRouteHandlerContext[]): BinaryRouteHandler {
  return {
    maxBodyBytes,
    handle: (context) => {
      seen.push(context);
      return Promise.resolve({ kind: 'ok', value: { status: 200, body: { received: true } } });
    },
  };
}

describe('createHttpServer: nyers ZIP törzsű végpont (SPEC-009 5.1, O-36)', () => {
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (closeServer === undefined) {
      return;
    }
    await closeServer();
    closeServer = undefined;
  });

  it('a korlátig érkező bináris törzset JSON értelmezés nélkül, az útvonal paraméterrel adja a kezelőnek', async () => {
    const seen: BinaryRouteHandlerContext[] = [];
    const { baseUrl, close } = await startTestServer(
      buildOptions({ uploadSkill: recordingBinaryHandler(4, seen) }, undefined),
    );
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/skills/pdf`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/zip' },
      body: Buffer.from([0x50, 0x4b, 0x7b, 0x00]),
    });

    expect(response.status).toBe(200);
    expect(seen).toStrictEqual([
      { parameters: { name: 'pdf' }, body: { kind: 'complete', bytes: Buffer.from([0x50, 0x4b, 0x7b, 0x00]) } },
    ]);
  });

  it('a kezelő korlátját túllépő törzsből csak a túllépés ténye jut el a kezelőhöz', async () => {
    const seen: BinaryRouteHandlerContext[] = [];
    const { baseUrl, close } = await startTestServer(
      buildOptions({ uploadSkill: recordingBinaryHandler(4, seen) }, undefined),
    );
    closeServer = close;

    await fetch(`${baseUrl}/api/skills/pdf`, { method: 'PUT', body: Buffer.alloc(5) });

    expect(seen).toStrictEqual([{ parameters: { name: 'pdf' }, body: { kind: 'too_large' } }]);
  });

  it('a bináris kezelő hibaágát a hibaosztály szerinti kódra és errorClass mezőre képezi', async () => {
    const message = 'A csomag túl nagy (skill_archive_too_large).';
    const failing: BinaryRouteHandler = {
      maxBodyBytes: 1,
      handle: () => Promise.resolve({ kind: 'error', message }),
    };
    const { baseUrl, close } = await startTestServer(buildOptions({ uploadSkill: failing }, undefined));
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/skills/pdf`, { method: 'PUT', body: Buffer.alloc(1) });

    expect(response.status).toBe(422);
    expect(await response.json()).toStrictEqual({
      code: 'unprocessable',
      message,
      errorClass: 'skill_archive_too_large',
    });
  });
});

describe('readLastEventIdHeader', () => {
  it('sima string fejléc értéket változatlanul ad vissza', () => {
    expect(readLastEventIdHeader('42')).toBe('42');
  });

  it('tömb alakú fejléc esetén az első elemet adja (az IncomingHttpHeaders index szignatúrája szerint elvben lehetséges alak)', () => {
    expect(readLastEventIdHeader(['5', '9'])).toBe('5');
  });

  it('hiányzó fejlécre undefined-et ad', () => {
    expect(readLastEventIdHeader(undefined)).toBeUndefined();
  });
});
