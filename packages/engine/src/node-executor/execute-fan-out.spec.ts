/* eslint-disable unicorn/no-null -- a `WorkflowRepository`/`WorkflowRunRepository` és a `NodeExecutionInstance.parentStepRunId` nullázható mezői (SPEC-003 5.1, 4.3) a teszt fixture valódi kezdő értékei, nem helyőrzők */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import type { ExpressionEvaluatorPort } from '../engine-port/expression-evaluator-port.ts';
import type { TemplateRendererPort } from '../engine-port/template-renderer-port.ts';
import type { RunContext } from '../run-context/run-context.ts';
import { executeFanOut, type ExecuteFanOutInput } from './execute-fan-out.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';
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

function seedRun(database: DatabaseContext): { readonly runId: string } {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'execute-fan-out teszt', description: null, providerId: null }),
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
  return { runId: run.id };
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

function portsOf(
  database: DatabaseContext,
  published: unknown[],
  evaluate: ExpressionEvaluatorPort['evaluate'],
  render: TemplateRendererPort['render'] = () => ({ kind: 'ok', value: 'renderelt' }),
): NodeExecutorPorts {
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
    expressionEvaluator: { evaluate, compile: notCalled },
    templateRenderer: { render, compile: notCalled },
  };
}

function instanceOf(runId: string): NodeExecutionInstance {
  return {
    runId,
    instance: { nodeId: 'fan_out', branchContext: [] },
    parentStepRunId: null,
    iteration: 0,
    attempt: 1,
    providerId: 'minimax',
  };
}

const emptyRunContext: RunContext = {
  input: {},
  steps: {},
  item: undefined,
  itemIndex: undefined,
  iteration: undefined,
  joinInputs: undefined,
  error: undefined,
};

function inputOf(runId: string): ExecuteFanOutInput {
  return {
    instance: instanceOf(runId),
    config: {
      type: 'fan_out',
      itemsExpression: 'elemek',
      branchLabelTemplate: 'cimke {{item}}',
      onUnhandledError: 'fail_run',
    },
    runContext: emptyRunContext,
  };
}

function cancelRunningStep(database: DatabaseContext, runId: string): void {
  const rows = okOrThrow(database.stepRuns.listStepRuns(runId));
  const running = rows.find((row) => row.status === 'running');
  if (running !== undefined) {
    database.stepRuns.markStepCancelled(running.id);
  }
}

describe('executeFanOut', () => {
  it('N elemre bontja a listát, minden elemre lerenderli a címkét, és fan_out_expanded eseményt ír', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const rendered: unknown[] = [];
    const ports = portsOf(
      database,
      published,
      () => ({ kind: 'ok', value: ['a', 'b', 'c'] }),
      (template, context) => {
        rendered.push(context);
        return { kind: 'ok', value: `${template}!` };
      },
    );

    const outcome = okOrThrow(executeFanOut(inputOf(runId), ports));

    expect(outcome.kind).toBe('fan_out_expanded');
    expect(outcome.kind === 'fan_out_expanded' ? outcome.items : []).toStrictEqual(['a', 'b', 'c']);
    expect(outcome.kind === 'fan_out_expanded' ? outcome.stepRun.status : 'nincs-ilyen-allapot').toBe('succeeded');
    expect(outcome.kind === 'fan_out_expanded' ? outcome.stepRun.output : undefined).toStrictEqual(['a', 'b', 'c']);
    expect(rendered).toHaveLength(3);
    expect(published).toContainEqual(expect.objectContaining({ kind: 'fan_out_expanded', payload: { itemCount: 3 } }));
  });

  it('N = 0 esetén nem hiba: üres lista, nincs renderelés, fan_out_expanded itemCount 0', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => ({ kind: 'ok', value: [] }));

    const outcome = okOrThrow(executeFanOut(inputOf(runId), ports));

    expect(outcome.kind).toBe('fan_out_expanded');
    expect(outcome.kind === 'fan_out_expanded' ? outcome.items : ['nincs-ilyen-elem']).toStrictEqual([]);
    expect(outcome.kind === 'fan_out_expanded' ? outcome.stepRun.status : 'nincs-ilyen-allapot').toBe('succeeded');
    expect(published).toContainEqual(expect.objectContaining({ kind: 'fan_out_expanded', payload: { itemCount: 0 } }));
  });

  it('a port hibáját expression_evaluation_failed hibaosztállyal zárja', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => ({ kind: 'error', message: 'teszt kiértékelési hiba' }));

    const outcome = okOrThrow(executeFanOut(inputOf(runId), ports));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' && outcome.errorKind).toBe('expression_evaluation_failed');
  });

  it('nem lista eredmény esetén fan_out_items_not_a_list hibaosztállyal zárja', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => ({ kind: 'ok', value: 'nem lista' }));

    const outcome = okOrThrow(executeFanOut(inputOf(runId), ports));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' && outcome.errorKind).toBe('fan_out_items_not_a_list');
  });

  it('a címke sablon renderelési hibáját template_render_failed hibaosztállyal zárja', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(
      database,
      published,
      () => ({ kind: 'ok', value: ['a'] }),
      () => ({ kind: 'error', message: 'teszt renderelési hiba' }),
    );

    const outcome = okOrThrow(executeFanOut(inputOf(runId), ports));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' && outcome.errorKind).toBe('template_render_failed');
  });

  it('a begin fázis hibáját továbbadja (nem létező runId)', () => {
    const database = openMemoryDatabase();
    const published: unknown[] = [];
    const ports = portsOf(database, published, notCalled);

    const outcome = executeFanOut(inputOf('nincs-ilyen-futas'), ports);

    expect(outcome.kind).toBe('error');
  });

  it('a hiba lezárásának Outcome hibáját továbbadja, ha a sor időközben más állapotba kerül', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => {
      cancelRunningStep(database, runId);
      return { kind: 'error', message: 'teszt kiértékelési hiba' };
    });

    const outcome = executeFanOut(inputOf(runId), ports);

    expect(outcome.kind).toBe('error');
  });

  it('a sikeres lezárás Outcome hibáját továbbadja, ha a sor időközben más állapotba kerül', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => {
      cancelRunningStep(database, runId);
      return { kind: 'ok', value: [] };
    });

    const outcome = executeFanOut(inputOf(runId), ports);

    expect(outcome.kind).toBe('error');
  });

  it('a záró fázis saját step_finished eseményének írási hibáját továbbadja, ha a kapcsolat időközben lezárul', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const racyDatabase: DatabaseContext = {
      ...database,
      stepRuns: {
        ...database.stepRuns,
        markStepSucceeded: (id, input) => {
          const succeeded = database.stepRuns.markStepSucceeded(id, input);
          database.close();
          return succeeded;
        },
      },
    };
    const ports = portsOf(racyDatabase, published, () => ({ kind: 'ok', value: [] }));

    const outcome = executeFanOut(inputOf(runId), ports);

    expect(outcome.kind).toBe('error');
  });

  it('a fan_out_expanded esemény írásának hibáját továbbadja, ha a kapcsolat a step_finished után zárul le', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    // A step_started (1.) és a záró step_finished (2.) esemény sikeresen íródik; csak a
    // harmadik, a `fan_out_expanded` motor esemény írásakor zárul le a kapcsolat, hogy a
    // `fan_out_expanded`-re szabott hibaágat a `finishStepRunSucceeded` saját hibaágától
    // (fentebb lefedve) elkülönítve lehessen tesztelni.
    let appendCount = 0;
    const racyDatabase: DatabaseContext = {
      ...database,
      events: {
        ...database.events,
        appendEngineEvent: (input) => {
          appendCount += 1;
          if (appendCount === 3) {
            database.close();
          }
          return database.events.appendEngineEvent(input);
        },
      },
    };
    const ports = portsOf(racyDatabase, published, () => ({ kind: 'ok', value: [] }));

    const outcome = executeFanOut(inputOf(runId), ports);

    expect(outcome.kind).toBe('error');
  });
});
