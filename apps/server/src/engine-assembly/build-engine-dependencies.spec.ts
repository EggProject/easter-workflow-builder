import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext, type WorkflowEdgeInput } from '@easter-workflow-builder/db';
import { createEngine, type EventPublisherPort } from '@easter-workflow-builder/engine';
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

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

/**
 * Egy `start -> fan_out -> join` workflow: a `fan_out` kifejezése a `[1]` után
 * `doublingCount` darab `.map(x, [x, x])`, ami közös hivatkozású listát ad
 * (SPEC-010 O-15, research `2026-10-21-spec010-blokkolo-meresek.md` 10.2).
 */
/* eslint-disable unicorn/no-null -- a leírás és az él kezelő és ág kulcs mezői valódi NULL értéket tárolnak (SPEC-003 4.4) */
function edgeOf(id: string, sourceNodeId: string, targetNodeId: string): WorkflowEdgeInput {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey: null };
}

function seedDoublingFanOutWorkflow(database: DatabaseContext, doublingCount: number): string {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({
      name: 'fan-out-duplazas',
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
            itemsExpression: `[1]${'.map(x, [x, x])'.repeat(doublingCount)}`,
            branchLabelTemplate: 'elem {{itemIndex}}',
            onUnhandledError: 'fail_run',
          },
        },
        {
          id: 'j',
          label: 'j',
          positionX: 0,
          positionY: 0,
          config: { type: 'join', mode: 'merge', settings: {}, onUnhandledError: 'fail_run' },
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

describe('buildEngineDependencies', () => {
  it('a kapott database és clock referenciát változatlanul adja tovább, a nyolc portot pedig felépíti', () => {
    const database = openMemoryDatabase();
    const clock = createSystemClock();
    const dependencies = buildEngineDependencies(database, createStreamRegistry(createRandomUuidIdGenerator()), clock);

    expect(dependencies.database).toBe(database);
    expect(dependencies.clock).toBe(clock);
    expect(typeof dependencies.agentQueryRunner.run).toBe('function');
    expect(typeof dependencies.providerDescriptorLookup).toBe('function');
    expect(typeof dependencies.expressionEvaluator.evaluate).toBe('function');
    expect(typeof dependencies.templateRenderer.render).toBe('function');
    expect(typeof dependencies.eventPublisher.publish).toBe('function');
    expect(typeof dependencies.idGenerator.nextId).toBe('function');
    expect(typeof dependencies.processEnvironment.read).toBe('function');
  });

  it('a bekötött sablon és kifejezés port érvényes sablonra és kifejezésre ok eredményt ad (SPEC-010 3.1)', () => {
    const dependencies = buildEngineDependencies(
      openMemoryDatabase(),
      createStreamRegistry(createRandomUuidIdGenerator()),
      createSystemClock(),
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

  it('REGRESSZIÓ: a tároláskor szerializálhatatlanul nagy fan_out eredmény a lépést expression_evaluation_failed hibával zárja, nem a futást run_execution_failed hibával (SPEC-010 O-15, user döntés 2026-10-25)', async () => {
    const database = openMemoryDatabase();
    const clock = createSystemClock();
    const dependencies = buildEngineDependencies(database, createStreamRegistry(createRandomUuidIdGenerator()), clock);
    const watched = publisherWithRunFinished(dependencies.eventPublisher);
    const engine = createEngine({ ...dependencies, eventPublisher: watched.publisher });
    const workflowId = seedDoublingFanOutWorkflow(database, 27);

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

  it('az összeállított kilenc port a motor createEngine hívásának valódi bemenete lehet', () => {
    const dependencies = buildEngineDependencies(
      openMemoryDatabase(),
      createStreamRegistry(createRandomUuidIdGenerator()),
      createSystemClock(),
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
