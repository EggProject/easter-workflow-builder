import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext, type WorkflowEdgeInput } from '@easter-workflow-builder/db';
import { createEngine, type EventPublisherPort } from '@easter-workflow-builder/engine';
import { createServerLogger, type ServerLogger } from '@easter-workflow-builder/logger';
import { isRecord } from '@easter-workflow-builder/typeguards';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { createRandomUuidIdGenerator } from './create-random-uuid-id-generator.ts';
import { createSystemClock } from './create-system-clock.ts';
import { buildEngineDependencies } from './build-engine-dependencies.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

/**
 * Valódi naplózó, ami a sorokat egy tömbbe gyűjti.
 */
function collectingLogger(): { readonly logger: ServerLogger; readonly lines: string[] } {
  const lines: string[] = [];
  return {
    logger: createServerLogger(
      { secretValues: [] },
      {
        write: (line: string) => {
          lines.push(line);
        },
      },
    ),
    lines,
  };
}

function silentLogger(): ServerLogger {
  return collectingLogger().logger;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

/**
 * A `fan_out` kifejezése: egy egyelemű lista, amiben a szöveg elem a `"a"` után
 * `doublingCount` darab `x + x` összefűzéssel 2^doublingCount karakter hosszú.
 * A könyvtár ezt rope szövegként tartja, tehát a kiértékelés és a tárolás előtti
 * szerializálás olcsó (SPEC-010 O-18, research
 * `2026-10-21-spec010-blokkolo-meresek.md` 12. szekció).
 */
function longStringItemExpression(doublingCount: number): string {
  return `["a"]${'.map(x, x + x)'.repeat(doublingCount)}`;
}

/**
 * Egy `start -> fan_out -> join` workflow, a megadott `itemsExpression`
 * kifejezéssel.
 */
/* eslint-disable unicorn/no-null -- a leírás és az él kezelő és ág kulcs mezői valódi NULL értéket tárolnak (SPEC-003 4.4) */
function edgeOf(id: string, sourceNodeId: string, targetNodeId: string): WorkflowEdgeInput {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey: null };
}

function seedFanOutWorkflow(database: DatabaseContext, itemsExpression: string): string {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({
      name: 'fan-out-nagy-kimenet',
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
          id: 'fo',
          label: 'fo',
          positionX: 0,
          positionY: 0,
          config: {
            type: 'fan_out',
            itemsExpression,
            branchLabelTemplate: 'elem {{itemIndex}}',
            onUnhandledError: 'fail_run',
          },
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

/**
 * A valódi `eventPublisher` port mellé egy figyelő, ami a `run_finished`
 * esemény kiadásakor teljesül: így a teszt a futás végét időzítő nélkül várja.
 */
function publisherWithRunFinished(publisher: EventPublisherPort): {
  readonly publisher: EventPublisherPort;
  readonly runFinished: Promise<undefined>;
} {
  const { promise: runFinished, resolve: resolveRunFinished } = Promise.withResolvers<undefined>();
  return {
    publisher: {
      publish: (event) => {
        publisher.publish(event);
        if (isRecord(event) && event['kind'] === 'run_finished') {
          resolveRunFinished(undefined);
        }
      },
    },
    runFinished,
  };
}

/**
 * A `"a"` 24 duplázása 2^24 karakteres szöveget ad, a lista JSON hossza ennél
 * négy karakterrel több: a `MAX_STORED_OUTPUT_LENGTH` (2^24 - 1) fölött van.
 */
const OVER_LIMIT_DOUBLING_COUNT = 24;

/**
 * A T-010-21 A-1 megkerülés olcsó alakja: három, 2^22 karakteres szöveg elem
 * (a lista JSON hossza a korlát alatt marad), és a `join` mindhárom ágtól a
 * teljes listát kapja, tehát a `join` kimenete a lista háromszorosa, a korlát
 * fölött.
 */
const JOIN_BYPASS_ITEMS_EXPRESSION = `${longStringItemExpression(22)}.map(s, [s, s, s])[0]`;

describe('buildEngineDependencies', () => {
  it('a kapott database és clock referenciát változatlanul adja tovább, a nyolc portot pedig felépíti', () => {
    const database = openMemoryDatabase();
    const clock = createSystemClock();
    const dependencies = buildEngineDependencies(
      database,
      createStreamRegistry(createRandomUuidIdGenerator()),
      clock,
      silentLogger(),
    );

    expect(dependencies.database).toBe(database);
    expect(dependencies.clock).toBe(clock);
    expect(typeof dependencies.agentQueryRunner.run).toBe('function');
    expect(typeof dependencies.providerDescriptorLookup).toBe('function');
    expect(typeof dependencies.expressionEvaluator.evaluate).toBe('function');
    expect(typeof dependencies.templateRenderer.render).toBe('function');
    expect(typeof dependencies.eventPublisher.publish).toBe('function');
    expect(typeof dependencies.idGenerator.nextId).toBe('function');
    expect(typeof dependencies.processEnvironment.read).toBe('function');
    expect(typeof dependencies.processEnvironment.readAll).toBe('function');
  });

  it('a bekötött sablon és kifejezés port érvényes sablonra és kifejezésre ok eredményt ad (SPEC-010 3.1)', () => {
    const dependencies = buildEngineDependencies(
      openMemoryDatabase(),
      createStreamRegistry(createRandomUuidIdGenerator()),
      createSystemClock(),
      silentLogger(),
    );

    expect(dependencies.templateRenderer.compile('Szia {{input.nev}}!')).toStrictEqual({
      kind: 'ok',
      value: undefined,
    });
    expect(dependencies.expressionEvaluator.compile('input.pontszam >= 50.0')).toStrictEqual({
      kind: 'ok',
      value: undefined,
    });
    expect(dependencies.templateRenderer.render('Szia {{input.nev}}!', { input: { nev: 'Anna' } })).toStrictEqual({
      kind: 'ok',
      value: 'Szia Anna!',
    });
  });

  it('REGRESSZIÓ: a korlátnál nagyobb tárolandó fan_out eredmény a lépést expression_evaluation_failed hibával zárja, nem a futást run_execution_failed hibával (SPEC-010 O-15 és O-18, user döntés 2026-10-25)', async () => {
    const database = openMemoryDatabase();
    const clock = createSystemClock();
    const dependencies = buildEngineDependencies(
      database,
      createStreamRegistry(createRandomUuidIdGenerator()),
      clock,
      silentLogger(),
    );
    const watched = publisherWithRunFinished(dependencies.eventPublisher);
    const engine = createEngine({ ...dependencies, eventPublisher: watched.publisher });
    const workflowId = seedFanOutWorkflow(database, longStringItemExpression(OVER_LIMIT_DOUBLING_COUNT));

    const started = okOrThrow(await engine.startRun({ workflowId, input: {} }));
    await watched.runFinished;

    const events = okOrThrow(database.events.readEventsSince(started.run.id, 0, 1000));
    const runFinished = events.find((event) => event.kind === 'run_finished');
    expect(runFinished?.payload).toMatchObject({ status: 'failed', errorKind: 'expression_evaluation_failed' });
    const stepRuns = okOrThrow(database.stepRuns.listStepRuns(started.run.id));
    const fanOutRow = stepRuns.find((row) => row.nodeId === 'fo');
    expect(fanOutRow?.status).toBe('failed');
    expect(fanOutRow?.errorKind).toBe('expression_evaluation_failed');
    expect(stepRuns.some((row) => row.status === 'running')).toBe(false);
  });

  it('REGRESSZIÓ: a közvetlenül join-ba kötött fan_out korlát alatti listájából a join korlát fölötti kimenete nem tárolódik, a join lépés step_output_not_storable hibával zár (SPEC-010 O-21, PLAN-010 T-010-21 A-1)', async () => {
    const database = openMemoryDatabase();
    const clock = createSystemClock();
    const dependencies = buildEngineDependencies(
      database,
      createStreamRegistry(createRandomUuidIdGenerator()),
      clock,
      silentLogger(),
    );
    const watched = publisherWithRunFinished(dependencies.eventPublisher);
    const engine = createEngine({ ...dependencies, eventPublisher: watched.publisher });
    const workflowId = seedFanOutWorkflow(database, JOIN_BYPASS_ITEMS_EXPRESSION);

    const started = okOrThrow(await engine.startRun({ workflowId, input: {} }));
    await watched.runFinished;

    const stepRuns = okOrThrow(database.stepRuns.listStepRuns(started.run.id));
    const fanOutRow = stepRuns.find((row) => row.nodeId === 'fo');
    expect(fanOutRow?.status).toBe('succeeded');
    const joinRow = stepRuns.find((row) => row.nodeId === 'j');
    expect(joinRow?.status).toBe('failed');
    expect(joinRow?.errorKind).toBe('step_output_not_storable');
    expect(joinRow?.output).toBeNull();
    const events = okOrThrow(database.events.readEventsSince(started.run.id, 0, 1000));
    expect(events.find((event) => event.kind === 'run_finished')?.payload).toMatchObject({
      status: 'failed',
      errorKind: 'step_output_not_storable',
    });
  });

  it('REGRESSZIÓ: a csomag tartalék ágára futó sablon és kifejezés hiba a naplóba a kivétel típusával kerül, az üzenete nélkül (SPEC-010 O-22, PLAN-010 T-010-21 A-7)', () => {
    const { logger, lines } = collectingLogger();
    const dependencies = buildEngineDependencies(
      openMemoryDatabase(),
      createStreamRegistry(createRandomUuidIdGenerator()),
      createSystemClock(),
      logger,
    );
    const throwingProxy: unknown = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new TypeError('TITOK_JELOLO_8f3a');
        },
      },
    );
    const throwingContext = {
      get input(): unknown {
        throw new RangeError('TITOK_JELOLO_8f3a');
      },
    };

    expect(dependencies.templateRenderer.render('{{v}}', { v: throwingProxy })).toMatchObject({
      kind: 'error',
      message: 'a sablon nem renderelhető',
    });
    expect(dependencies.expressionEvaluator.evaluate('input', throwingContext)).toMatchObject({
      kind: 'error',
      message: 'a kifejezés nem dolgozható fel',
    });
    expect(dependencies.expressionEvaluator.compile('input.x')).toStrictEqual({ kind: 'ok', value: undefined });

    const entries = lines.map((line): unknown => JSON.parse(line));
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ level: 50, operation: 'template_render', errorType: 'TypeError' });
    expect(entries[1]).toMatchObject({ level: 50, operation: 'expression_evaluate', errorType: 'RangeError' });
    expect(lines.join('\n')).not.toContain('TITOK_JELOLO_8f3a');
  });

  it('az összeállított kilenc port a motor createEngine hívásának valódi bemenete lehet', () => {
    const dependencies = buildEngineDependencies(
      openMemoryDatabase(),
      createStreamRegistry(createRandomUuidIdGenerator()),
      createSystemClock(),
      silentLogger(),
    );
    const engine = createEngine(dependencies);

    expect(typeof engine.startRun).toBe('function');
    expect(typeof engine.interruptRun).toBe('function');
    expect(typeof engine.decideApproval).toBe('function');
    expect(typeof engine.restartRun).toBe('function');
    expect(typeof engine.suggestedConcurrencyLimit).toBe('function');
    expect(typeof engine.testProviderConnection).toBe('function');
    expect(typeof engine.shutdown).toBe('function');
  });
});
