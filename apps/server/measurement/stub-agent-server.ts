// A PRÓBA ELLENŐRZÉSÉNEK HAMIS ÁGENSES SZERVERE (PLAN-013 T-013-9): a valódi
// `apps/server` modulok (HTTP réteg, útvonalak, stream nyilvántartás, motor,
// `:memory:` helyett fájl adatbázis a commitolt migrációkkal), KIZÁRÓLAG az
// `agentQueryRunner` port hamis: a commitolt fixture üzenetsorát adja. Valódi
// provider hívás nincs. A `run-probe.spec.ts` ezt indítja a valódi
// `src/main.ts` helyett; a környezet és a leállítás ugyanaz (`EASTER_SERVER_PORT`,
// `EASTER_DB_FILE`, `SIGTERM`).
//
// A `STUB_AGENT_REQUEST_FILE` útvonalra a hamis ágens a kapott kérés
// ellenőrizhető részét írja (prompt, `maxTurns`, `model`, `effort`,
// `maxBudgetUsd` jelenléte, az adatbázis és a napló útvonala): az env ÉRTÉKEI nem, mert titkot hordozhatnak. A `STUB_AGENT_BEHAVIOR=fail` esetén a hamis ágens hibaágat ad.
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import type { AgentQueryRunner } from '@easter-workflow-builder/agent';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase } from '@easter-workflow-builder/db';
import { createEngine } from '@easter-workflow-builder/engine';
import { createServerLogger } from '@easter-workflow-builder/logger';
import { isRecord, isUnknownArray } from '@easter-workflow-builder/typeguards';
import {
  createCelExpressionEvaluator,
  createMustacheTemplateRenderer,
} from '@easter-workflow-builder/workflow-language';
import { buildProviderDescriptorLookup } from '../src/engine-assembly/build-provider-descriptor-lookup.ts';
import { createProcessEnvironmentReader } from '../src/engine-assembly/create-process-environment-reader.ts';
import { createSkillLibraryReader } from '../src/engine-assembly/create-skill-library-reader.ts';
import { createRandomUuidIdGenerator } from '../src/engine-assembly/create-random-uuid-id-generator.ts';
import { createRealEventPublisher } from '../src/engine-assembly/create-real-event-publisher.ts';
import { createSystemClock } from '../src/engine-assembly/create-system-clock.ts';
import { createHttpServer } from '../src/http-server/create-http-server.ts';
import { buildRouteHandlers } from '../src/route-registry/build-route-handlers.ts';
import { TEST_SKILL_LIBRARY } from '../src/skill-endpoint/test-skill-library.ts';
import { registerShutdownSignalHandlers } from '../src/shutdown-sequence/register-shutdown-signal-handlers.ts';
import { createStreamRegistry } from '../src/stream-registry/create-stream-registry.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

const STUB_RESULT_TEXT = 'hamis ágens válasz';

function readFixtureMessages(): readonly unknown[] {
  const text = readFileSync(
    new URL('../src/workflow-language-end-to-end/agent-step-messages-fixture.json', import.meta.url),
    'utf8',
  );
  const parsed: unknown = JSON.parse(text);
  const sequence = isRecord(parsed) ? parsed['sikeres'] : undefined;
  if (!isUnknownArray(sequence)) {
    throw new TypeError('a sikeres fixture sorozat hiányzik vagy nem tömb');
  }
  // A commitolt fixture `result` üzenete nem hordoz szöveget; a valódi SDK igen, ezért a hamis ágens ad
  // egyet, hogy a próba szöveg hossz útja is lefusson.
  return sequence.map((message) =>
    isRecord(message) && message['type'] === 'result' ? { ...message, result: STUB_RESULT_TEXT } : message,
  );
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

function describeRequest(prompt: string, options: Readonly<Record<string, unknown>>): string {
  return JSON.stringify({
    prompt,
    dbFile: process.env['EASTER_DB_FILE'],
    logDirectory: process.env['EASTER_LOG_DIRECTORY'],
    maxTurns: options['maxTurns'],
    model: options['model'],
    effort: options['effort'],
    hasMaxBudgetUsd: Object.hasOwn(options, 'maxBudgetUsd'),
  });
}

function buildStubAgentQueryRunner(requestFile: string | undefined, shouldFail: boolean): AgentQueryRunner {
  const fixture = readFixtureMessages();
  return {
    run: (request) => {
      if (requestFile !== undefined) {
        writeFileSync(requestFile, describeRequest(request.prompt, request.options));
      }
      if (shouldFail) {
        return { kind: 'error', message: 'hamis ágens hiba' };
      }
      return { kind: 'ok', value: { messages: messageIterable(fixture), interrupt: () => Promise.resolve() } };
    },
  };
}

function writeToStandardError(message: string): void {
  process.stderr.write(message);
}

const port = Number(process.env['EASTER_SERVER_PORT']);
const database = okOrThrow(openDatabase(process.env['EASTER_DB_FILE'] ?? ':memory:'));
const clock = createSystemClock();
const idGenerator = createRandomUuidIdGenerator();
const streamRegistry = createStreamRegistry(idGenerator);
const logger = createServerLogger({ secretValues: [] }, { write: writeToStandardError });
const engine = createEngine({
  database,
  agentQueryRunner: buildStubAgentQueryRunner(
    process.env['STUB_AGENT_REQUEST_FILE'],
    process.env['STUB_AGENT_BEHAVIOR'] === 'fail',
  ),
  providerDescriptorLookup: buildProviderDescriptorLookup(),
  expressionEvaluator: createCelExpressionEvaluator(),
  templateRenderer: createMustacheTemplateRenderer(),
  eventPublisher: createRealEventPublisher(streamRegistry, clock),
  clock,
  idGenerator,
  processEnvironment: createProcessEnvironmentReader(),
  skillLibrary: createSkillLibraryReader(TEST_SKILL_LIBRARY.rootDirectory),
});
const server = createHttpServer({
  handlers: buildRouteHandlers(database, engine, streamRegistry, TEST_SKILL_LIBRARY),
  devOrigin: undefined,
  streamDependencies: { database, registry: streamRegistry, clock, keepAliveIntervalMs: 30_000 },
  logger,
  idGenerator,
});
registerShutdownSignalHandlers({ server, engine, database, logger, streamRegistry });
server.listen(port, '127.0.0.1');
