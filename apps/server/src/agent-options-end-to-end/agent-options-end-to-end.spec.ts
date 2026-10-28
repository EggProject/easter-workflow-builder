import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createServerLogger } from '@easter-workflow-builder/logger';
import { createEngine } from '@easter-workflow-builder/engine';
import type { AgentQueryRequest, AgentQueryRunner } from '@easter-workflow-builder/agent';
import {
  buildStreamUrl,
  decodeStreamFrame,
  RunDetailSchema,
  StartedRunResponseSchema,
  WorkflowDetailSchema,
  type StreamFrame,
  type WorkflowNodeInput,
} from '@easter-workflow-builder/protocol';
import { isRecord } from '@easter-workflow-builder/typeguards';
import { buildEngineDependencies } from '../engine-assembly/build-engine-dependencies.ts';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { describeServerConfigForLog } from '../server-config/describe-server-config-for-log.ts';
import { readServerConfig } from '../server-config/server-config.ts';
import { createSystemClock } from '../engine-assembly/create-system-clock.ts';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { buildRouteHandlers } from '../route-registry/build-route-handlers.ts';
import { createHttpServer } from '../http-server/create-http-server.ts';
import { buildTestZipArchive } from '../skill-endpoint/build-test-zip-archive.ts';
import { testZipFileEntry } from '../skill-endpoint/test-zip-file-entry.ts';

/**
 * SPEC-009 12. szekció 19. és 22. kritérium (PLAN-012 T-012-13): végponttól
 * végpontig próba a valódi `apps/server` modulokkal. Valódi HTTP szerver
 * `127.0.0.1` címen, a valódi útvonal kezelők, motor és stream
 * nyilvántartás, ideiglenes fájl adatbázis a commitolt migrációkkal, valódi
 * skill könyvtár ideiglenes könyvtárban, valódi `process.env` olvasó.
 * **Kizárólag az `agentQueryRunner` port hamis**: rögzíti a kapott kérést, és
 * egy rövid, kulcs nélküli üzenetsort ad, tehát valódi provider hívás nincs.
 *
 * A skill a `PUT /api/skills/:name`, a két MCP definíció a
 * `PUT /api/mcp-servers/:name` úton kerül be, a lépés a `skills` listával és a
 * `mcpServerReferences` hivatkozással a `PUT .../graph` úton. A rögzített
 * `Options` alakját a teszt mezőnként állítja, a próba env értékeit pedig a
 * kimenet minden olvasható felületén keresi: a REST válaszokban (a
 * `run_event` sorok és a pillanatkép a saját végpontján), a stream
 * kereteiben, a szerver naplójában (maszkolás nélküli loggerrel, hogy egy
 * kiírt érték ne bújhasson el a `REDACTED` mögött) és az adatbázis fájl nyers
 * bájtjaiban, a WAL fájllal együtt.
 */

const PLUGIN_NAME = 'easter-skills';
// A próba env értékei: egyedi jelölők, nem titkok. A nevük a központi
// definíció és a lépés felülírásának szerver oldali neve.
const STDIO_SECRET = 'vegpont-stdio-jelolo-4e1b7c9a-nem-kerulhet-kimenetbe';
const HTTP_DEFAULT_SECRET = 'vegpont-http-alap-jelolo-8d2f5a31-nem-kerulhet-kimenetbe';
const HTTP_OVERRIDE_SECRET = 'Bearer vegpont-http-felulirt-jelolo-c7a90e44-nem-kerulhet-kimenetbe';
const PROBE_ENVIRONMENT = {
  EASTER_VEGPONT_STDIO_TOKEN: STDIO_SECRET,
  EASTER_VEGPONT_HTTP_ALAP: HTTP_DEFAULT_SECRET,
  EASTER_VEGPONT_HTTP_FELULIRT: HTTP_OVERRIDE_SECRET,
} as const;
const PROBE_SECRETS: readonly string[] = Object.values(PROBE_ENVIRONMENT);

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

// Kulcs és szolgáltatói szöveg nélküli üzenetsor; az `init` a valódi SDK
// alakjához hasonlóan a szerverek nevét és állapotát hordozza, értéket nem.
function probeMessages(call: number): readonly unknown[] {
  const session = `session-vegpont-${String(call)}`;
  return [
    {
      type: 'system',
      subtype: 'init',
      session_id: session,
      uuid: `init-${String(call)}`,
      mcp_servers: [
        { name: 'fajl-eszkozok', status: 'connected' },
        { name: 'web-api', status: 'connected' },
      ],
    },
    { type: 'assistant', session_id: session, uuid: `assistant-${String(call)}`, message: { content: [] } },
    {
      type: 'result',
      subtype: 'success',
      session_id: session,
      uuid: `result-${String(call)}`,
      num_turns: 1,
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    },
  ];
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

function recordingAgentQueryRunner(requests: AgentQueryRequest[]): AgentQueryRunner {
  return {
    run: (request) => {
      requests.push(request);
      return {
        kind: 'ok',
        value: { messages: messageIterable(probeMessages(requests.length)), interrupt: () => Promise.resolve() },
      };
    },
  };
}

interface Probe {
  readonly baseUrl: string;
  readonly server: Server;
  readonly database: DatabaseContext;
  readonly directory: string;
  readonly databasePath: string;
  readonly skillRoot: string;
  readonly requests: AgentQueryRequest[];
  // Minden REST válasz és stream keret nyers szövege, és minden naplósor.
  readonly outputs: string[];
  readonly logLines: string[];
}

async function startProbe(directory: string, skillRoot: string): Promise<Probe> {
  const databasePath = path.join(directory, 'probe.db');
  const database = okOrThrow(openDatabase(databasePath));
  const requests: AgentQueryRequest[] = [];
  const logLines: string[] = [];
  // Maszkolás nélkül: egy kiírt próba érték a sorban szó szerint látszana.
  const logger = createServerLogger(
    { secretValues: [] },
    {
      write: (line: string) => {
        logLines.push(line);
      },
    },
  );
  // Az indulás 1. és 2. lépésének naplósora a valódi konfiguráció olvasóval és leíróval.
  const config = okOrThrow(readServerConfig(process.env));
  logger.info(describeServerConfigForLog(config), 'A szerver konfigurációja betöltve.');
  const clock = createSystemClock();
  const idGenerator = createRandomUuidIdGenerator();
  const streamRegistry = createStreamRegistry(idGenerator);
  const skillLibrary = {
    rootDirectory: config.skillLibraryDirectory,
    limits: {
      maxArchiveBytes: config.skillMaxArchiveBytes,
      maxUnpackedBytes: config.skillMaxUnpackedBytes,
      maxEntryCount: config.skillMaxEntryCount,
    },
  };
  // A szerver saját motor összeállítása, egyetlen cserével: a rögzítő `agentQueryRunner`.
  const engine = createEngine({
    ...buildEngineDependencies(database, streamRegistry, clock, logger, skillRoot),
    agentQueryRunner: recordingAgentQueryRunner(requests),
  });
  const server = createHttpServer({
    handlers: buildRouteHandlers(database, engine, streamRegistry, skillLibrary),
    devOrigin: undefined,
    streamDependencies: { database, registry: streamRegistry, clock, keepAliveIntervalMs: 30_000 },
    logger,
    idGenerator,
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('a teszt szerver nem kapott portot');
  }
  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    server,
    database,
    directory,
    databasePath,
    skillRoot,
    requests,
    outputs: [],
    logLines,
  };
}

async function request(
  probe: Probe,
  method: string,
  route: string,
  body?: unknown,
  zip?: Buffer,
): Promise<{ readonly status: number; readonly body: unknown }> {
  const init: RequestInit =
    zip === undefined
      ? {
          method,
          ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        }
      : { method, headers: { 'Content-Type': 'application/zip' }, body: new Uint8Array(zip) };
  const response = await fetch(`${probe.baseUrl}${route}`, init);
  const text = await response.text();
  probe.outputs.push(text);
  const parsed: unknown = text === '' ? undefined : JSON.parse(text);
  return { status: response.status, body: parsed };
}

// Az SSE folyam kereteinek dekódolása a `data:` sorokból; minden nyers darab a kimenetbe kerül.
async function* readStreamFrames(
  reader: ReadableStreamDefaultReader<string>,
  outputs: string[],
): AsyncGenerator<StreamFrame> {
  let buffer = '';
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) {
      return;
    }
    outputs.push(chunk.value);
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

async function waitForRunFinished(probe: Probe, runId: string): Promise<void> {
  const controller = new AbortController();
  const streamId = `vegpont-${randomUUID()}`;
  const response = await fetch(`${probe.baseUrl}${buildStreamUrl(streamId)}`, { signal: controller.signal });
  if (response.body === null) {
    throw new Error('a stream válasznak nincs törzse');
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  const frames = readStreamFrames(reader, probe.outputs);
  try {
    const ready = await frames.next();
    expect(ready.done === true ? undefined : ready.value.event).toBe('stream_ready');
    const subscribed = await request(probe, 'PUT', `/api/streams/${streamId}/subscriptions`, {
      runs: [{ runId, fromEventId: 0, replayLimit: 500 }],
    });
    expect(subscribed.status).toBe(200);
    for await (const frame of frames) {
      if (frame.event === 'run_event' && frame.runEvent.runId === runId && frame.runEvent.kind === 'run_finished') {
        return;
      }
    }
    throw new Error('a stream a run_finished esemény előtt véget ért');
  } finally {
    await reader.cancel();
    controller.abort();
  }
}

function skillArchive(name: string): Buffer {
  return buildTestZipArchive([
    testZipFileEntry('SKILL.md', `---\nname: ${name}\ndescription: Végponttól végpontig próba skill.\n---\n# Próba\n`),
  ]);
}

/* eslint-disable unicorn/no-null -- a node config nullázható mezői és az él kezelő és ág kulcs mezői valódi NULL értéket tárolnak (SPEC-003 4.4) */
const PROBE_NODES: readonly WorkflowNodeInput[] = [
  {
    id: 'start',
    type: 'start',
    label: 'start',
    positionX: 0,
    positionY: 0,
    config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
  },
  {
    id: 'agent',
    type: 'agent_step',
    label: 'agent',
    positionX: 0,
    positionY: 0,
    config: {
      type: 'agent_step',
      onUnhandledError: 'fail_run',
      promptTemplate: 'Próba',
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
      skills: ['alfa'],
      mcpServers: {},
      mcpServerReferences: {
        'fajl-eszkozok': { envBindings: {}, authEnvName: null },
        'web-api': { envBindings: {}, authEnvName: 'EASTER_VEGPONT_HTTP_FELULIRT' },
      },
      cwd: null,
      additionalDirectories: [],
      sandbox: null,
      sessionMode: 'isolated',
      structuredOutput: null,
    },
  },
];
const PROBE_EDGES = [
  { id: 'e1', sourceNodeId: 'start', targetNodeId: 'agent', sourceHandle: null, targetHandle: null, branchKey: null },
];
/* eslint-enable unicorn/no-null */

describe('végponttól végpontig próba: skill, MCP és izoláció a kimenő Options-ban (SPEC-009 19., 22. kritérium)', () => {
  let probe: Probe | undefined;

  async function stopProbe(running: Probe): Promise<void> {
    running.server.closeAllConnections();
    await new Promise<void>((resolve) => {
      running.server.close(() => {
        resolve();
      });
    });
    running.database.close();
  }

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (probe === undefined) {
      return;
    }
    const running = probe;
    probe = undefined;
    await stopProbe(running);
    await rm(running.directory, { recursive: true, force: true });
  });

  it('a REST úton feltöltött skill és mentett MCP definíció a rögzített Options-ban jelenik meg, és a próba env értékek sehol nincsenek a kimenetben', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'agent-options-vegpont-'));
    // A plugin neve a skill könyvtár gyökerének neve (M-136 4a), ezért a gyökér egy almappa.
    const skillRoot = path.join(directory, PLUGIN_NAME);
    const environment = { ...PROBE_ENVIRONMENT, EASTER_SKILL_LIBRARY_DIRECTORY: skillRoot };
    for (const [name, value] of Object.entries(environment)) {
      vi.stubEnv(name, value);
    }
    probe = await startProbe(directory, skillRoot);
    const current = probe;

    const uploaded = await request(current, 'PUT', '/api/skills/alfa', undefined, skillArchive('alfa'));
    expect(uploaded.status).toBe(200);
    const stdioSaved = await request(current, 'PUT', '/api/mcp-servers/fajl-eszkozok', {
      type: 'stdio',
      command: 'node',
      args: ['fajl-szerver.mjs', '--csak-olvas'],
      envNames: ['FAJL_TOKEN'],
      envBindings: { FAJL_TOKEN: 'EASTER_VEGPONT_STDIO_TOKEN' },
    });
    expect(stdioSaved.status).toBe(200);
    const httpSaved = await request(current, 'PUT', '/api/mcp-servers/web-api', {
      type: 'http',
      url: 'http://127.0.0.1:1/mcp',
      authEnvName: 'EASTER_VEGPONT_HTTP_ALAP',
    });
    expect(httpSaved.status).toBe(200);

    const created = await request(current, 'POST', '/api/workflows', {
      name: 'opciok',
      // eslint-disable-next-line unicorn/no-null -- a leírás valódi NULL érték (SPEC-005 4.2 A)
      description: null,
      // eslint-disable-next-line unicorn/no-null -- a workflow providerId mező valódi NULL érték (SPEC-005 4.2 A)
      providerId: null,
    });
    const workflowId = parsedOrThrow(WorkflowDetailSchema.safeParse(created.body)).id;
    const saved = await request(current, 'PUT', `/api/workflows/${workflowId}/graph`, {
      nodes: PROBE_NODES,
      edges: PROBE_EDGES,
    });
    expect(saved.status).toBe(200);
    const settings = await request(current, 'PUT', '/api/settings', { defaultProviderId: 'claude-subscription' });
    expect(settings.status).toBe(200);

    const started = await request(current, 'POST', `/api/workflows/${workflowId}/runs`, { input: {} });
    expect(started.status).toBe(200);
    const runId = parsedOrThrow(StartedRunResponseSchema.safeParse(started.body)).runId;
    await waitForRunFinished(current, runId);
    const run = await request(current, 'GET', `/api/runs/${runId}`);
    expect(parsedOrThrow(RunDetailSchema.safeParse(run.body)).status).toBe('succeeded');

    // A rögzített `Options` (19., 22. kritérium, SPEC-009 5.1, 5.3, 6.4, 7.1).
    expect(current.requests).toHaveLength(1);
    const options = current.requests[0]?.options ?? {};
    expect(options['plugins']).toStrictEqual([{ type: 'local', path: current.skillRoot }]);
    expect(options['skills']).toStrictEqual([`${PLUGIN_NAME}:alfa`]);
    expect(options['mcpServers']).toStrictEqual({
      'fajl-eszkozok': {
        type: 'stdio',
        command: 'node',
        args: ['fajl-szerver.mjs', '--csak-olvas'],
        env: { FAJL_TOKEN: STDIO_SECRET },
      },
      'web-api': { type: 'http', url: 'http://127.0.0.1:1/mcp', headers: { Authorization: HTTP_OVERRIDE_SECRET } },
    });
    expect(options['settingSources']).toStrictEqual([]);
    expect(options['strictMcpConfig']).toBe(true);
    const outgoingEnvironment = options['env'];
    expect(isRecord(outgoingEnvironment) ? outgoingEnvironment['CLAUDE_CODE_DISABLE_AUTO_MEMORY'] : undefined).toBe(
      '1',
    );

    // A kimenet minden olvasható felülete: a `run_event` sorok, a lépés futások és a pillanatkép
    // a saját végpontján, a központi lista, a skill lista és a csak neveket adó végpont.
    for (const route of [
      `/api/runs/${runId}/events?afterEventId=0&limit=1000`,
      `/api/runs/${runId}/steps`,
      `/api/runs/${runId}/snapshot`,
      '/api/mcp-servers',
      '/api/skills',
      '/api/server-environment-names',
      `/api/workflows/${workflowId}/graph`,
    ]) {
      const response = await request(current, 'GET', route);
      expect(response.status).toBe(200);
    }
    const names = await request(current, 'GET', '/api/server-environment-names');
    expect(names.body).toStrictEqual(expect.arrayContaining(Object.keys(PROBE_ENVIRONMENT)));

    // Az adatbázis fájl a lezárás után olvasható teljesen (a WAL addigra visszaíródik vagy megmarad).
    probe = undefined;
    await stopProbe(current);
    const databaseBytes = [current.databasePath, `${current.databasePath}-wal`]
      .filter((file) => existsSync(file))
      .map((file) => readFileSync(file).toString('latin1'));
    await rm(current.directory, { recursive: true, force: true });

    const surfaces = [...current.outputs, ...current.logLines, ...databaseBytes];
    expect(current.outputs.length).toBeGreaterThan(10);
    expect(current.logLines.length).toBeGreaterThan(0);
    for (const secret of PROBE_SECRETS) {
      expect(surfaces.filter((surface) => surface.includes(secret))).toStrictEqual([]);
    }
    // A nevek viszont ott vannak, ahol a spec szerint állniuk kell (a keresés tehát nem vak).
    expect(surfaces.some((surface) => surface.includes('EASTER_VEGPONT_STDIO_TOKEN'))).toBe(true);
  });
});
