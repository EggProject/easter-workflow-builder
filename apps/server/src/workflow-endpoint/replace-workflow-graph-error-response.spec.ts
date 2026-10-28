/* eslint-disable unicorn/no-null -- a WorkflowEdgeInput nullázható mezői (sourceHandle, targetHandle, branchKey) a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et (workflow-graph-document.spec.ts mintája) */
import { afterEach, describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { ReplaceGraphRequestSchema, zodErrorToProtocolErrorBody } from '@easter-workflow-builder/protocol';
import { createServerLogger, type DestinationStream, type ServerLogger } from '@easter-workflow-builder/logger';
import { isRecord } from '@easter-workflow-builder/typeguards';
import { createHttpServer, type HttpServerOptions } from '../http-server/create-http-server.ts';
import type { BinaryRouteHandler } from '../route-dispatch/binary-route-handler.ts';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import type { RouteHandlers } from '../route-dispatch/route-handlers.ts';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { createSystemClock } from '../engine-assembly/create-system-clock.ts';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { createCreateWorkflowHandler } from './create-workflow.ts';
import { createReplaceWorkflowGraphHandler } from './replace-workflow-graph.ts';

/**
 * A mérés eszköze (SPEC-005/006 hibaválasz lépés, 2026-09-27, "Feladat" 1-2.
 * pont, `.claude/CLAUDE.md` 12. szekció "minden bizonyíték előállító eszköz
 * a repóba tartozik"): valódi `node:http` szerver, valódi `better-sqlite3`
 * `:memory:` adatbázis és valódi (memória nyelőre író) pino logger a
 * `PUT /api/workflows/{workflowId}/graph` öt hibás esetére. Hamis agent
 * nem kell, csak a `createWorkflow` és a `replaceWorkflowGraph` valódi
 * kezelője; a többi 24 útvonal alapértelmezett, sosem hívott stub.
 *
 * Az öt eset a nyers eredményt a `docs/research/2026-09-27-szerver-hibatorzs.md`
 * fájlba vezette át: a régi (fixetlen) kódon ugyanez a teszt a törzsben
 * nyers driver szöveget adott (`build-protocol-error-body.spec.ts` "előtte"
 * méréséhez hasonlóan), a mostani (fixelt) kódon az itt igazolt alakot adja.
 */

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

interface MemorySink extends DestinationStream {
  readonly lines: () => readonly Record<string, unknown>[];
}

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

function buildHandlers(database: DatabaseContext): RouteHandlers {
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
    listMcpServerDefinitions: DEFAULT_HANDLER,
    saveMcpServerDefinition: DEFAULT_HANDLER,
    deleteMcpServerDefinition: DEFAULT_HANDLER,
  };
  return {
    ...base,
    createWorkflow: createCreateWorkflowHandler(database),
    replaceWorkflowGraph: createReplaceWorkflowGraphHandler(database),
  };
}

function buildOptions(database: DatabaseContext, logger: ServerLogger): HttpServerOptions {
  return {
    handlers: buildHandlers(database),
    devOrigin: undefined,
    streamDependencies: {
      database,
      registry: createStreamRegistry(createRandomUuidIdGenerator()),
      clock: createSystemClock(),
      keepAliveIntervalMs: 60_000,
    },
    logger,
    idGenerator: createRandomUuidIdGenerator(),
  };
}

async function startTestServer(options: HttpServerOptions): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createHttpServer(options);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('a teszt szerver nem kapott portot.');
  }
  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}

function startNodeConfig(): Record<string, unknown> {
  return { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };
}

async function createWorkflowViaApi(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Teszt', description: null, providerId: null }),
  });
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body['id'] !== 'string') {
    throw new Error('a workflow létrehozás válasza nem hordoz string id mezőt');
  }
  return body['id'];
}

function branchNode(key: string): Record<string, unknown> {
  return {
    id: 'n-branch',
    type: 'branch',
    label: 'Elágazás',
    positionX: 0,
    positionY: 0,
    config: {
      type: 'branch',
      expression: 'x > 0',
      branches: [{ key, label: 'Pozitív' }],
      defaultBranchKey: null,
      onUnhandledError: 'fail_run',
    },
  };
}

function putGraph(baseUrl: string, workflowId: string, graph: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/workflows/${workflowId}/graph`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(graph),
  });
}

describe('PUT /api/workflows/{workflowId}/graph - öt hibás eset (SPEC-005/006, 2026-09-27)', () => {
  let closeServer: (() => Promise<void>) | undefined;
  let database: DatabaseContext | undefined;

  afterEach(async () => {
    if (closeServer !== undefined) {
      await closeServer();
      closeServer = undefined;
    }
    database?.close();
    database = undefined;
  });

  async function setup(): Promise<{ baseUrl: string; sink: MemorySink; workflowId: string }> {
    database = okOrThrow(openDatabase(':memory:'));
    const sink = createMemorySink();
    const logger = createServerLogger({ secretValues: [] }, sink);
    const { baseUrl, close } = await startTestServer(buildOptions(database, logger));
    closeServer = close;
    const workflowId = await createWorkflowViaApi(baseUrl);
    return { baseUrl, sink, workflowId };
  }

  it('(a) két azonos csomópont azonosító egy kérésben: 400 invalid_request, mező útvonallal, nem naplózva', async () => {
    const { baseUrl, sink, workflowId } = await setup();

    const response = await putGraph(baseUrl, workflowId, {
      nodes: [
        { id: 'n1', type: 'start', label: 'A', positionX: 0, positionY: 0, config: startNodeConfig() },
        { id: 'n1', type: 'start', label: 'B', positionX: 1, positionY: 1, config: startNodeConfig() },
      ],
      edges: [],
    });

    expect(response.status).toBe(400);
    const body: unknown = await response.json();
    if (!isRecord(body)) {
      throw new Error('a hiba törzs nem objektum alakú');
    }
    expect(body['code']).toBe('invalid_request');
    expect(body['message']).toContain('nodes.1.id');
    expect(sink.lines()).toHaveLength(0);
  });

  it('(b) két azonos él azonosító egy kérésben: 400 invalid_request, mező útvonallal, nem naplózva', async () => {
    const { baseUrl, sink, workflowId } = await setup();

    const response = await putGraph(baseUrl, workflowId, {
      nodes: [
        { id: 'n1', type: 'start', label: 'A', positionX: 0, positionY: 0, config: startNodeConfig() },
        { id: 'n2', type: 'start', label: 'B', positionX: 1, positionY: 1, config: startNodeConfig() },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', sourceHandle: null, targetHandle: null, branchKey: null },
        { id: 'e1', sourceNodeId: 'n2', targetNodeId: 'n1', sourceHandle: null, targetHandle: null, branchKey: null },
      ],
    });

    expect(response.status).toBe(400);
    const body: unknown = await response.json();
    if (!isRecord(body)) {
      throw new Error('a hiba törzs nem objektum alakú');
    }
    expect(body['code']).toBe('invalid_request');
    expect(body['message']).toContain('edges.1.id');
    expect(sink.lines()).toHaveLength(0);
  });

  it('(c) egy MÁSIK workflow gráfjában már létező node azonosító: 409 conflict, graph_id_conflict mondat, errorClass nélkül, warn napló a driver szöveggel', async () => {
    const { baseUrl, sink, workflowId } = await setup();
    await putGraph(baseUrl, workflowId, {
      nodes: [{ id: 'shared-node', type: 'start', label: 'A', positionX: 0, positionY: 0, config: startNodeConfig() }],
      edges: [],
    });
    const otherWorkflowId = await createWorkflowViaApi(baseUrl);

    const response = await putGraph(baseUrl, otherWorkflowId, {
      nodes: [{ id: 'shared-node', type: 'start', label: 'B', positionX: 0, positionY: 0, config: startNodeConfig() }],
      edges: [],
    });

    expect(response.status).toBe(409);
    const body: unknown = await response.json();
    if (!isRecord(body)) {
      throw new Error('a hiba törzs nem objektum alakú');
    }
    expect(body).toStrictEqual({
      code: 'conflict',
      message: 'A gráf egy azonosítója már foglalt (graph_id_conflict).',
    });
    expect(Object.hasOwn(body, 'errorClass')).toBe(false);
    expect(JSON.stringify(body)).not.toContain('constraint failed');
    expect(JSON.stringify(body)).not.toContain('shared-node');

    const warnEntry = sink.lines().find((line) => line['level'] === 40);
    expect(warnEntry).toBeDefined();
    expect(warnEntry?.['msg']).toContain('UNIQUE constraint failed');
    expect(warnEntry?.['msg']).toContain('(graph_id_conflict)');
  });

  it('(d) egy MÁSIK workflow gráfjában már létező él azonosító: 409 conflict, graph_id_conflict mondat, warn napló a driver szöveggel', async () => {
    const { baseUrl, sink, workflowId } = await setup();
    await putGraph(baseUrl, workflowId, {
      nodes: [
        { id: 'n1', type: 'start', label: 'A', positionX: 0, positionY: 0, config: startNodeConfig() },
        { id: 'n2', type: 'start', label: 'B', positionX: 1, positionY: 1, config: startNodeConfig() },
      ],
      edges: [
        {
          id: 'shared-edge',
          sourceNodeId: 'n1',
          targetNodeId: 'n2',
          sourceHandle: null,
          targetHandle: null,
          branchKey: null,
        },
      ],
    });
    const otherWorkflowId = await createWorkflowViaApi(baseUrl);

    const response = await putGraph(baseUrl, otherWorkflowId, {
      nodes: [
        { id: 'b-n1', type: 'start', label: 'A', positionX: 0, positionY: 0, config: startNodeConfig() },
        { id: 'b-n2', type: 'start', label: 'B', positionX: 1, positionY: 1, config: startNodeConfig() },
      ],
      edges: [
        {
          id: 'shared-edge',
          sourceNodeId: 'b-n1',
          targetNodeId: 'b-n2',
          sourceHandle: null,
          targetHandle: null,
          branchKey: null,
        },
      ],
    });

    expect(response.status).toBe(409);
    const body: unknown = await response.json();
    if (!isRecord(body)) {
      throw new Error('a hiba törzs nem objektum alakú');
    }
    expect(body).toStrictEqual({
      code: 'conflict',
      message: 'A gráf egy azonosítója már foglalt (graph_id_conflict).',
    });

    const warnEntry = sink.lines().find((line) => line['level'] === 40);
    expect(warnEntry).toBeDefined();
    expect(warnEntry?.['msg']).toContain('(graph_id_conflict)');
  });

  it('(e) nem létező node-ra mutató él: 409 conflict, foreign_key_violation mondat, warn napló a driver szöveggel', async () => {
    const { baseUrl, sink, workflowId } = await setup();

    const response = await putGraph(baseUrl, workflowId, {
      nodes: [{ id: 'n1', type: 'start', label: 'A', positionX: 0, positionY: 0, config: startNodeConfig() }],
      edges: [
        {
          id: 'e1',
          sourceNodeId: 'n1',
          targetNodeId: 'nincs-ilyen-node',
          sourceHandle: null,
          targetHandle: null,
          branchKey: null,
        },
      ],
    });

    expect(response.status).toBe(409);
    const body: unknown = await response.json();
    if (!isRecord(body)) {
      throw new Error('a hiba törzs nem objektum alakú');
    }
    expect(body).toStrictEqual({
      code: 'conflict',
      message: 'A kérés nem létező elemre hivatkozik (foreign_key_violation).',
    });
    expect(Object.hasOwn(body, 'errorClass')).toBe(false);
    expect(JSON.stringify(body)).not.toContain('constraint failed');

    const warnEntry = sink.lines().find((line) => line['level'] === 40);
    expect(warnEntry).toBeDefined();
    expect(warnEntry?.['msg']).toContain('FOREIGN KEY constraint failed');
    expect(warnEntry?.['msg']).toContain('(foreign_key_violation)');
  });

  it('(f) üres kötelező szöveg mező: 400 invalid_request a mező útvonalával, a tárolt gráf változatlan, nem naplózva (SPEC-008 5.4, O-21)', async () => {
    const { baseUrl, sink, workflowId } = await setup();
    const stored = await putGraph(baseUrl, workflowId, { nodes: [branchNode('pos')], edges: [] });
    expect(stored.status).toBe(200);
    const before = database?.workflows.readGraph(workflowId);

    const response = await putGraph(baseUrl, workflowId, { nodes: [branchNode('  ')], edges: [] });

    expect(response.status).toBe(400);
    const body: unknown = await response.json();
    if (!isRecord(body)) {
      throw new Error('a hiba törzs nem objektum alakú');
    }
    expect(body['code']).toBe('invalid_request');
    expect(body['message']).toContain('nodes.0.config.branches.0.key');
    expect(database?.workflows.readGraph(workflowId)).toStrictEqual(before);
    expect(sink.lines()).toHaveLength(0);
  });

  for (const { label, node, path } of [
    {
      label: '(g) null onUnhandledError (SPEC-008 5.4, O-29)',
      node: {
        id: 'n-start',
        type: 'start',
        label: 'Start',
        positionX: 0,
        positionY: 0,
        config: { type: 'start', inputFields: [], onUnhandledError: null },
      },
      path: 'nodes.0.config.onUnhandledError',
    },
    {
      label: '(h) választatlan join mód (SPEC-008 5.4, O-33)',
      node: {
        id: 'n-join',
        type: 'join',
        label: 'Összefésülés',
        positionX: 0,
        positionY: 0,
        config: { type: 'join', mode: null, onUnhandledError: 'fail_run' },
      },
      path: 'nodes.0.config.mode',
    },
  ]) {
    it(`${label}: 400 invalid_request a mező útvonalával, a tárolt gráf változatlan, nem naplózva`, async () => {
      const { baseUrl, sink, workflowId } = await setup();
      const stored = await putGraph(baseUrl, workflowId, { nodes: [branchNode('pos')], edges: [] });
      expect(stored.status).toBe(200);
      const before = database?.workflows.readGraph(workflowId);

      const response = await putGraph(baseUrl, workflowId, { nodes: [node], edges: [] });

      expect(response.status).toBe(400);
      const body: unknown = await response.json();
      if (!isRecord(body)) {
        throw new Error('a hiba törzs nem objektum alakú');
      }
      expect(body['code']).toBe('invalid_request');
      expect(body['message']).toContain(path);
      expect(database?.workflows.readGraph(workflowId)).toStrictEqual(before);
      expect(sink.lines()).toHaveLength(0);
    });
  }
  for (const { label, config, paths } of [
    {
      label: '(i) a felvett ciklus kezdő konfigja (SPEC-008 81. kritérium)',
      config: { type: 'loop', maxIterations: NaN, continueExpression: '', onUnhandledError: null },
      paths: ['nodes.0.config.maxIterations', 'nodes.0.config.continueExpression', 'nodes.0.config.onUnhandledError'],
    },
    {
      label: '(j) a felvett hibakezelő kezdő konfigja (SPEC-008 81. kritérium)',
      config: {
        type: 'error_handler',
        maxAttempts: NaN,
        backoffMs: [],
        handledErrorKinds: [],
        onUnhandledError: null,
      },
      paths: ['nodes.0.config.maxAttempts', 'nodes.0.config.onUnhandledError'],
    },
  ]) {
    it(`${label}: 400 invalid_request minden hibás mező útvonalával, ugyanazzal az üzenettel, mint a kliens mentés előtti ellenőrzése`, async () => {
      const { baseUrl, sink, workflowId } = await setup();
      const stored = await putGraph(baseUrl, workflowId, { nodes: [branchNode('pos')], edges: [] });
      expect(stored.status).toBe(200);
      const before = database?.workflows.readGraph(workflowId);
      const graph = {
        nodes: [{ id: 'n-added', type: config.type, label: '', positionX: 0, positionY: 0, config }],
        edges: [],
      };

      // A kliens a `NaN` értékkel ellenőriz, a dróton a JSON `null`-t ír
      // helyette: a két bemenet ugyanazt a mezőútvonal listát adja.
      const clientCheck = ReplaceGraphRequestSchema.safeParse(graph);
      if (clientCheck.success) {
        throw new Error('a kliens oldali ellenőrzésnek el kell utasítania a kezdő konfigot');
      }
      const response = await putGraph(baseUrl, workflowId, graph);

      expect(response.status).toBe(400);
      const body: unknown = await response.json();
      expect(body).toStrictEqual({
        code: 'invalid_request',
        message: `A kérés törzse érvénytelen, hibás mező(k): ${paths.join(', ')} (invalid_request).`,
      });
      expect(body).toStrictEqual(zodErrorToProtocolErrorBody(clientCheck.error));
      expect(database?.workflows.readGraph(workflowId)).toStrictEqual(before);
      expect(sink.lines()).toHaveLength(0);
    });
  }

  /**
   * A pozitív egész szám mezők (SPEC-008 5.4, O-37, 116. kritérium): mezőnként a
   * 0, a -3 és az 1,5 érték, a `backoffMs` lista minden helyén is. A JSON a
   * három értéket változatlanul viszi át, tehát a kliens és a szerver
   * ugyanazt az üzenetet adja.
   */
  const POSITIVE_INTEGER_FIELD_CASES: readonly {
    readonly label: string;
    readonly path: string;
    readonly build: (value: number) => Record<string, unknown>;
  }[] = [
    {
      label: 'loop maxIterations',
      path: 'nodes.0.config.maxIterations',
      build: (value) => ({
        type: 'loop',
        maxIterations: value,
        continueExpression: 'i < 3',
        onUnhandledError: 'fail_run',
      }),
    },
    {
      label: 'error_handler maxAttempts',
      path: 'nodes.0.config.maxAttempts',
      build: (value) => ({
        type: 'error_handler',
        maxAttempts: value,
        backoffMs: [100, 200, 400],
        handledErrorKinds: [],
        onUnhandledError: 'fail_run',
      }),
    },
    ...[0, 1, 2].map((index) => ({
      label: `error_handler backoffMs[${String(index)}]`,
      path: `nodes.0.config.backoffMs.${String(index)}`,
      build: (value: number) => ({
        type: 'error_handler',
        maxAttempts: 3,
        backoffMs: [100, 200, 400].map((delay, position) => (position === index ? value : delay)),
        handledErrorKinds: [],
        onUnhandledError: 'fail_run',
      }),
    })),
  ];

  for (const { label, path, build } of POSITIVE_INTEGER_FIELD_CASES) {
    for (const value of [0, -3, 1.5]) {
      it(`(k) ${label} = ${String(value)}: 400 invalid_request a mező útvonalával, ugyanazzal az üzenettel, mint a kliens ellenőrzése, a tárolt gráf változatlan, nem naplózva (SPEC-008 5.4, O-37)`, async () => {
        const { baseUrl, sink, workflowId } = await setup();
        const stored = await putGraph(baseUrl, workflowId, { nodes: [branchNode('pos')], edges: [] });
        expect(stored.status).toBe(200);
        const before = database?.workflows.readGraph(workflowId);
        const config = build(value);
        const graph = {
          nodes: [{ id: 'n-number', type: config['type'], label: '', positionX: 0, positionY: 0, config }],
          edges: [],
        };
        const clientCheck = ReplaceGraphRequestSchema.safeParse(graph);
        if (clientCheck.success) {
          throw new Error('a kliens oldali ellenőrzésnek el kell utasítania a nem pozitív egész számot');
        }

        const response = await putGraph(baseUrl, workflowId, graph);

        expect(response.status).toBe(400);
        const body: unknown = await response.json();
        expect(body).toStrictEqual({
          code: 'invalid_request',
          message: `A kérés törzse érvénytelen, hibás mező(k): ${path} (invalid_request).`,
        });
        expect(body).toStrictEqual(zodErrorToProtocolErrorBody(clientCheck.error));
        expect(database?.workflows.readGraph(workflowId)).toStrictEqual(before);
        expect(sink.lines()).toHaveLength(0);
      });
    }

    it(`(k) ${label} pozitív egész értékkel: 200, a gráf tárolódik`, async () => {
      const { baseUrl, workflowId } = await setup();
      const config = build(5);

      const response = await putGraph(baseUrl, workflowId, {
        nodes: [{ id: 'n-number', type: config['type'], label: '', positionX: 0, positionY: 0, config }],
        edges: [],
      });

      expect(response.status).toBe(200);
      const graph = database?.workflows.readGraph(workflowId);
      expect(graph?.kind === 'ok' && graph.value.nodes.map((node) => node.config)).toStrictEqual([config]);
    });
  }
});
