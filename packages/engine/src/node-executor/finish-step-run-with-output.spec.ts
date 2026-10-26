/* eslint-disable unicorn/no-null -- a `WorkflowRepository`/`WorkflowRunRepository`/`CreateStepRunInput` nullázható mezői (SPEC-003 5.1, 9.2) a teszt fixture valódi kezdő értékei, nem helyőrzők */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import { finishStepRunWithOutput } from './finish-step-run-with-output.ts';
import { MAX_STORED_OUTPUT_LENGTH } from './max-stored-output-length.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function seedRunningStep(database: DatabaseContext): { readonly runId: string; readonly stepRunId: string } {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({
      name: 'finish-step-run-with-output teszt',
      description: null,
      providerId: null,
    }),
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
      nodeId: 'start',
      nodeType: 'start',
      parentStepRunId: null,
      providerId: 'minimax',
      modelId: null,
      sessionMode: null,
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    }),
  );
  okOrThrow(database.stepRuns.markStepRunning(stepRun.id));
  return { runId: run.id, stepRunId: stepRun.id };
}

const notCalled = (): never => {
  throw new Error('ebben a tesztben nem hívott port');
};

function fakeClock(): ClockPort {
  let now = 0;
  return {
    nowMs: () => {
      now += 5;
      return now;
    },
    sleep: notCalled,
  };
}

function portsOf(database: DatabaseContext, published: unknown[]): NodeExecutorPorts {
  const publisher: EventPublisherPort = {
    publish: (event) => {
      published.push(event);
    },
  };
  return {
    database,
    clock: fakeClock(),
    idGenerator: { nextId: notCalled },
    eventPublisher: publisher,
    expressionEvaluator: { evaluate: notCalled, compile: notCalled },
    templateRenderer: { render: notCalled, compile: notCalled },
  };
}

/**
 * A JSON szöveg kerete (két idézőjel) a szöveg hosszán felül.
 */
const STRING_FRAME_LENGTH = 2;

describe('finishStepRunWithOutput', () => {
  it('a korláttal egyenlő hosszú kimenetet tárolja, és succeeded ágat ad', () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRunningStep(database);
    const published: unknown[] = [];
    const output = 'a'.repeat(MAX_STORED_OUTPUT_LENGTH - STRING_FRAME_LENGTH);

    const finished = okOrThrow(
      finishStepRunWithOutput(
        { nodeId: 'start', runId, stepRunId, startedAtMs: 0, output },
        portsOf(database, published),
      ),
    );

    expect(finished.kind).toBe('succeeded');
    expect(finished.stepRun.status).toBe('succeeded');
    expect(finished.stepRun.output).toBe(output);
    expect(published).toHaveLength(1);
  });

  it('REGRESSZIÓ: a korlátnál hosszabb kimenetet nem tárolja, a lépést step_output_not_storable osztállyal zárja, a csomópont nevével (SPEC-010 O-21)', () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRunningStep(database);
    const published: unknown[] = [];
    const tokens = { inputTokens: 10, outputTokens: 20, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };

    const finished = okOrThrow(
      finishStepRunWithOutput(
        {
          nodeId: 'start',
          runId,
          stepRunId,
          startedAtMs: 0,
          output: 'a'.repeat(MAX_STORED_OUTPUT_LENGTH - STRING_FRAME_LENGTH + 1),
          tokens,
          resultSubtype: 'success',
          numTurns: 2,
        },
        portsOf(database, published),
      ),
    );

    const errorMessage = `A(z) "start" node kimenete túl nagy a tároláshoz (legfeljebb ${String(MAX_STORED_OUTPUT_LENGTH)} karakter) (step_output_not_storable).`;
    expect(finished).toMatchObject({ kind: 'failed', errorKind: 'step_output_not_storable', errorMessage });
    expect(finished.stepRun).toMatchObject({
      status: 'failed',
      errorKind: 'step_output_not_storable',
      errorMessage,
      output: null,
      inputTokens: 10,
      outputTokens: 20,
      resultSubtype: 'success',
      numTurns: 2,
    });
    expect(published).toStrictEqual([
      {
        kind: 'step_finished',
        runId,
        stepRunId,
        payload: { status: 'failed', errorKind: 'step_output_not_storable', durationMs: 5, tokens },
      },
    ]);
  });

  it('REGRESSZIÓ: a szerializáláskor kivételt dobó kimenet a nem tárolható mondatot kapja, nem a méretét (PLAN-010 T-010-21 A-8)', () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRunningStep(database);
    const output = {
      toJSON: (): never => {
        throw new TypeError('TITOK');
      },
    };

    const finished = okOrThrow(
      finishStepRunWithOutput({ nodeId: 'start', runId, stepRunId, startedAtMs: 0, output }, portsOf(database, [])),
    );

    expect(finished).toMatchObject({
      kind: 'failed',
      errorKind: 'step_output_not_storable',
      errorMessage:
        'A(z) "start" node kimenete nem tárolható, mert nem alakítható JSON szöveggé (step_output_not_storable).',
    });
  });

  it('a sikeres zárás hibáját továbbadja', () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRunningStep(database);
    okOrThrow(database.stepRuns.markStepCancelled(stepRunId));

    const outcome = finishStepRunWithOutput(
      { nodeId: 'start', runId, stepRunId, startedAtMs: 0, output: null },
      portsOf(database, []),
    );

    expect(outcome.kind).toBe('error');
  });

  it('a hibás zárás hibáját továbbadja', () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRunningStep(database);
    okOrThrow(database.stepRuns.markStepCancelled(stepRunId));

    const outcome = finishStepRunWithOutput(
      { nodeId: 'start', runId, stepRunId, startedAtMs: 0, output: 'a'.repeat(MAX_STORED_OUTPUT_LENGTH) },
      portsOf(database, []),
    );

    expect(outcome.kind).toBe('error');
  });
});
