/* eslint-disable unicorn/no-null -- a `WorkflowRepository`/`WorkflowRunRepository`, a `SnapshotEdge` és a `NodeExecutionInstance` nullázható mezői (SPEC-003 5.1, 4.7, SPEC-004 4.3) a teszt fixture valódi kezdő értékei, nem helyőrzők */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import type { DatabaseContext, GraphSnapshotDocument, RunStatus, WorkflowRunRecord } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import { createConcurrencyGate } from '../concurrency-gate/create-concurrency-gate.ts';
import type { ExecutedStepInstance } from '../run-context/executed-step-instance.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ChildWorkflowRunner, ChildWorkflowRunRequest } from './child-workflow-runner.ts';
import { executeSubWorkflow, type ExecuteSubWorkflowInput } from './execute-sub-workflow.ts';
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
 * Minden futáshoz kell egy pillanatkép; a tartalma a tesztek szempontjából
 * lényegtelen, csak a lenyomata legyen futásonként más, hogy a
 * `graph_snapshot_hash_collision` ág ne szólaljon meg.
 */
function snapshotFor(workflowId: string, name: string, seed: string): GraphSnapshotDocument {
  return {
    version: 1,
    sdkVersionPin: `0.0.0-teszt-${seed}`,
    workflow: { id: workflowId, name, description: null },
    nodes: [],
    edges: [],
  };
}

function createWorkflow(database: DatabaseContext, name: string, providerId: ProviderId | null): string {
  return okOrThrow(database.workflows.createWorkflow({ name, description: null, providerId })).id;
}

/**
 * A `sub_workflow` node és az egyetlen gráfbeli őse. A hivatkozás feloldás
 * (SPEC-004 6.2) gráfbeli ős feltételéhez kell a `start -> sub` él.
 */
function graphOf(): ExecutableGraph {
  return buildExecutableGraph({
    version: 1,
    sdkVersionPin: '0.0.0-teszt-graf',
    workflow: { id: 'wf', name: 'gráf', description: null },
    nodes: [],
    edges: [
      {
        id: 'e1',
        sourceNodeId: 'start',
        targetNodeId: 'sub',
        sourceHandle: null,
        targetHandle: null,
        branchKey: null,
      },
    ],
  });
}

const executedInstances: readonly ExecutedStepInstance[] = [
  { nodeId: 'start', branchContext: [], output: { megrendeles: 42 } },
];

/**
 * Az alapértelmezett leképezés: egyetlen mező, a `start` node kimenetéből.
 */
const DEFAULT_INPUT_MAPPING: Readonly<Record<string, string>> = { rendeles: 'start' };

function instanceOf(runId: string): NodeExecutionInstance {
  return {
    runId,
    instance: { nodeId: 'sub', branchContext: [] },
    parentStepRunId: null,
    iteration: 0,
    attempt: 1,
    providerId: 'minimax',
  };
}

function inputOf(
  runId: string,
  targetWorkflowId: string,
  inputMapping: Readonly<Record<string, string>> = DEFAULT_INPUT_MAPPING,
): ExecuteSubWorkflowInput {
  return {
    instance: instanceOf(runId),
    config: { type: 'sub_workflow', targetWorkflowId, inputMapping, onUnhandledError: 'fail_run' },
    graph: graphOf(),
    executedInstances,
  };
}

type TerminalChildStatus = Extract<RunStatus, 'succeeded' | 'failed' | 'cancelled' | 'interrupted'>;

const TERMINAL_MARKERS: Readonly<
  Record<TerminalChildStatus, (database: DatabaseContext, runId: string) => Outcome<WorkflowRunRecord>>
> = {
  succeeded: (database, runId) => database.runs.markRunSucceeded(runId),
  failed: (database, runId) => database.runs.markRunFailed(runId, 'provider_call_failed', 'a gyerek elbukott'),
  cancelled: (database, runId) => database.runs.markRunCancelled(runId),
  interrupted: (database, runId) => database.runs.markRunInterrupted(runId),
};

interface FakeRunnerOptions {
  readonly childStatus?: TerminalChildStatus;
  readonly output?: unknown;
  readonly startError?: string;
  readonly awaitError?: string;
  readonly beforeAwaitResolves?: () => Promise<void>;
}

/**
 * A `ChildWorkflowRunner` hamis, teszt-only implementációja. **Valós
 * adatbázis műveleteket végez**: a `startChildRun` ténylegesen `startRun`-t
 * hív a kapott `parent` kontextussal, tehát a `rootRunId`/`depth`/
 * `workflowAncestry` levezetését a `db` repository végzi, nem a teszt - így a
 * SPEC-004 5.9 3. pontja ténylegesen mérhető.
 *
 * A gyerek `providerId` értékét a **cél** workflow saját `provider_id`
 * felülírásából olvassa, nem a szülőéből (5.9 4. pont). Ez a 4.8 menet 2.
 * lépésének minimális szimulációja: a valódi, háromszintű feloldást a
 * `run-supervisor` (T-005-25) végzi majd.
 */
function fakeRunner(
  database: DatabaseContext,
  options: FakeRunnerOptions = {},
): { readonly runner: ChildWorkflowRunner; readonly requests: ChildWorkflowRunRequest[] } {
  const requests: ChildWorkflowRunRequest[] = [];
  const runner: ChildWorkflowRunner = {
    startChildRun: (request) => {
      requests.push(request);
      if (options.startError !== undefined) {
        return Promise.resolve({ kind: 'error', message: options.startError });
      }
      const target = okOrThrow(database.workflows.getWorkflow(request.targetWorkflowId));
      const snapshot = snapshotFor(request.targetWorkflowId, target.name, `gyerek-${String(requests.length)}`);
      const started = okOrThrow(
        database.runs.startRun({
          workflowId: request.targetWorkflowId,
          input: request.input,
          providerId: target.providerId ?? 'minimax',
          graphSnapshotDocument: snapshot,
          parent: request.parent,
        }),
      );
      okOrThrow(database.runs.markRunRunning(started.id));
      return Promise.resolve({ kind: 'ok', value: started });
    },
    awaitChildRun: async (childRunId) => {
      if (options.beforeAwaitResolves !== undefined) {
        await options.beforeAwaitResolves();
      }
      if (options.awaitError !== undefined) {
        return { kind: 'error', message: options.awaitError };
      }
      const run = okOrThrow(TERMINAL_MARKERS[options.childStatus ?? 'succeeded'](database, childRunId));
      return { kind: 'ok', value: { run, output: options.output ?? { eredmeny: 'kesz' } } };
    },
  };
  return { runner, requests };
}

/**
 * Egy szülő futás, tetszőleges mély ős lánccal. A lánc elemeit ugyanaz a
 * `startRun` építi, ami éles futásban is: minden szint egy-egy futás, a
 * `parent` kontextust az előző szint rekordjából adva.
 */
function seedRunChain(
  database: DatabaseContext,
  workflowIds: readonly string[],
): { readonly runs: readonly WorkflowRunRecord[] } {
  const runs: WorkflowRunRecord[] = [];
  for (const [index, workflowId] of workflowIds.entries()) {
    const previous = runs.at(-1);
    const workflow = okOrThrow(database.workflows.getWorkflow(workflowId));
    const snapshot = snapshotFor(workflowId, workflow.name, `szulo-${String(index)}`);
    const run = okOrThrow(
      database.runs.startRun({
        workflowId,
        input: {},
        providerId: 'minimax',
        graphSnapshotDocument: snapshot,
        ...(previous !== undefined && {
          parent: {
            rootRunId: previous.rootRunId,
            depth: previous.depth,
            workflowAncestry: previous.workflowAncestry,
          },
        }),
      }),
    );
    okOrThrow(database.runs.markRunRunning(run.id));
    runs.push(run);
  }
  return { runs };
}

describe('executeSubWorkflow', () => {
  it('sikeres gyerek futásnál a lépés succeeded, a kimenete a gyerek futás kimenete', async () => {
    const database = openMemoryDatabase();
    const parentWorkflowId = createWorkflow(database, 'szülő', 'minimax');
    const targetWorkflowId = createWorkflow(database, 'gyerek', 'claude-subscription');
    const { runs } = seedRunChain(database, [parentWorkflowId]);
    const parentRun = runs[0] ?? notCalled();
    const published: unknown[] = [];
    const ports = portsOf(database, published);
    const { runner } = fakeRunner(database, { output: { szamla: 'ok' } });

    const outcome = okOrThrow(await executeSubWorkflow(inputOf(parentRun.id, targetWorkflowId), ports, runner));

    expect(outcome.kind).toBe('succeeded');
    expect(outcome.kind === 'succeeded' ? outcome.selectedBranchKey : 'nincs-ilyen-ag').toBeNull();
    expect(outcome.stepRun.status).toBe('succeeded');
    expect(outcome.stepRun.output).toStrictEqual({ szamla: 'ok' });
    expect(published).toHaveLength(4);
    expect(published[0]).toMatchObject({ kind: 'step_started' });
    expect(published[1]).toMatchObject({ kind: 'sub_workflow_started' });
    expect(published[2]).toMatchObject({ kind: 'sub_workflow_finished' });
    expect(published[3]).toMatchObject({ kind: 'step_finished' });
  });

  it('a targetWorkflowId és a leképezett bemenet változatlanul jut el a futtatóhoz', async () => {
    const database = openMemoryDatabase();
    const parentWorkflowId = createWorkflow(database, 'szülő', 'minimax');
    const targetWorkflowId = createWorkflow(database, 'gyerek', 'claude-subscription');
    const { runs } = seedRunChain(database, [parentWorkflowId]);
    const parentRun = runs[0] ?? notCalled();
    const ports = portsOf(database, []);
    const { runner, requests } = fakeRunner(database);

    okOrThrow(
      await executeSubWorkflow(
        inputOf(parentRun.id, targetWorkflowId, { rendeles: 'start', masolat: 'start' }),
        ports,
        runner,
      ),
    );

    expect(requests).toHaveLength(1);
    const request = requests[0] ?? notCalled();
    expect(request.targetWorkflowId).toBe(targetWorkflowId);
    expect(request.input).toStrictEqual({ rendeles: { megrendeles: 42 }, masolat: { megrendeles: 42 } });
    expect(request.parent).toStrictEqual({
      rootRunId: parentRun.rootRunId,
      depth: parentRun.depth,
      workflowAncestry: parentRun.workflowAncestry,
    });
  });

  it('a gyerek a SAJÁT workflow provider felülírását kapja, a szülőé nem szivárog át', async () => {
    const database = openMemoryDatabase();
    const parentWorkflowId = createWorkflow(database, 'szülő', 'minimax');
    const targetWorkflowId = createWorkflow(database, 'gyerek', 'claude-subscription');
    const { runs } = seedRunChain(database, [parentWorkflowId]);
    const parentRun = runs[0] ?? notCalled();
    const ports = portsOf(database, []);
    const { runner } = fakeRunner(database);

    const outcome = okOrThrow(await executeSubWorkflow(inputOf(parentRun.id, targetWorkflowId), ports, runner));

    const childRunId = outcome.stepRun.subWorkflowRunId ?? notCalled();
    const childRun = okOrThrow(database.runs.getRun(childRunId));
    expect(parentRun.providerId).toBe('minimax');
    expect(childRun.providerId).toBe('claude-subscription');
    expect(childRun.rootRunId).toBe(parentRun.rootRunId);
    expect(childRun.depth).toBe(parentRun.depth + 1);
    expect(childRun.workflowAncestry).toStrictEqual([parentWorkflowId, targetWorkflowId]);
  });

  it('a step_run.sub_workflow_run_id a gyerek futásra mutat, és a sub_workflow_started payload a gyerek mélységét adja', async () => {
    const database = openMemoryDatabase();
    const parentWorkflowId = createWorkflow(database, 'szülő', 'minimax');
    const targetWorkflowId = createWorkflow(database, 'gyerek', null);
    const { runs } = seedRunChain(database, [parentWorkflowId]);
    const parentRun = runs[0] ?? notCalled();
    const published: unknown[] = [];
    const ports = portsOf(database, published);
    const { runner } = fakeRunner(database);

    const outcome = okOrThrow(await executeSubWorkflow(inputOf(parentRun.id, targetWorkflowId), ports, runner));

    const childRunId = outcome.stepRun.subWorkflowRunId ?? notCalled();
    expect(published[1]).toMatchObject({
      kind: 'sub_workflow_started',
      payload: { subWorkflowRunId: childRunId, targetWorkflowId, depth: 1 },
    });
    expect(published[2]).toMatchObject({
      kind: 'sub_workflow_finished',
      payload: { subWorkflowRunId: childRunId, status: 'succeeded' },
    });
  });

  it('két szintű kört elfog, és a gyerek futás EL SEM INDUL (A -> B -> A)', async () => {
    const database = openMemoryDatabase();
    const workflowA = createWorkflow(database, 'A', 'minimax');
    const workflowB = createWorkflow(database, 'B', 'minimax');
    const { runs } = seedRunChain(database, [workflowA, workflowB]);
    const runB = runs[1] ?? notCalled();
    const published: unknown[] = [];
    const ports = portsOf(database, published);
    const { runner, requests } = fakeRunner(database);

    const outcome = okOrThrow(await executeSubWorkflow(inputOf(runB.id, workflowA), ports, runner));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' ? outcome.errorKind : 'nincs-ilyen-ag').toBe('workflow_recursion_detected');
    expect(outcome.stepRun.status).toBe('failed');
    expect(outcome.stepRun.subWorkflowRunId).toBeNull();
    expect(requests).toStrictEqual([]);
    expect(published).toHaveLength(2);
    expect(published[0]).toMatchObject({ kind: 'step_started' });
    expect(published[1]).toMatchObject({ kind: 'step_finished' });
  });

  it('három szintű kört elfog, mélységi küszöb nélkül (A -> B -> C -> A)', async () => {
    const database = openMemoryDatabase();
    const workflowA = createWorkflow(database, 'A', 'minimax');
    const workflowB = createWorkflow(database, 'B', 'minimax');
    const workflowC = createWorkflow(database, 'C', 'minimax');
    const { runs } = seedRunChain(database, [workflowA, workflowB, workflowC]);
    const runC = runs[2] ?? notCalled();
    const ports = portsOf(database, []);
    const { runner, requests } = fakeRunner(database);

    const outcome = okOrThrow(await executeSubWorkflow(inputOf(runC.id, workflowA), ports, runner));

    expect(runC.workflowAncestry).toStrictEqual([workflowA, workflowB, workflowC]);
    expect(outcome.kind === 'failed' ? outcome.errorKind : 'nincs-ilyen-ag').toBe('workflow_recursion_detected');
    expect(requests).toStrictEqual([]);
  });

  it('fel nem oldható inputMapping hivatkozásnál unresolvable_step_reference, gyerek futás nélkül', async () => {
    const database = openMemoryDatabase();
    const parentWorkflowId = createWorkflow(database, 'szülő', 'minimax');
    const targetWorkflowId = createWorkflow(database, 'gyerek', null);
    const { runs } = seedRunChain(database, [parentWorkflowId]);
    const parentRun = runs[0] ?? notCalled();
    const ports = portsOf(database, []);
    const { runner, requests } = fakeRunner(database);

    const outcome = okOrThrow(
      await executeSubWorkflow(
        inputOf(parentRun.id, targetWorkflowId, { rendeles: 'nincs-ilyen-node' }),
        ports,
        runner,
      ),
    );

    expect(outcome.kind === 'failed' ? outcome.errorKind : 'nincs-ilyen-ag').toBe('unresolvable_step_reference');
    expect(outcome.stepRun.status).toBe('failed');
    expect(requests).toStrictEqual([]);
  });

  it.each(['failed', 'cancelled', 'interrupted'] satisfies readonly TerminalChildStatus[])(
    'a %s állapotban záró gyerek futás a szülő lépést sub_workflow_failed osztállyal buktatja',
    async (childStatus) => {
      const database = openMemoryDatabase();
      const parentWorkflowId = createWorkflow(database, 'szülő', 'minimax');
      const targetWorkflowId = createWorkflow(database, 'gyerek', null);
      const { runs } = seedRunChain(database, [parentWorkflowId]);
      const parentRun = runs[0] ?? notCalled();
      const published: unknown[] = [];
      const ports = portsOf(database, published);
      const { runner } = fakeRunner(database, { childStatus });

      const outcome = okOrThrow(await executeSubWorkflow(inputOf(parentRun.id, targetWorkflowId), ports, runner));

      expect(outcome.kind === 'failed' ? outcome.errorKind : 'nincs-ilyen-ag').toBe('sub_workflow_failed');
      expect(outcome.stepRun.status).toBe('failed');
      expect(published[2]).toMatchObject({ kind: 'sub_workflow_finished', payload: { status: childStatus } });
    },
  );

  it('az el sem induló gyerek futás is sub_workflow_failed, a futtató üzenetével', async () => {
    const database = openMemoryDatabase();
    const parentWorkflowId = createWorkflow(database, 'szülő', 'minimax');
    const targetWorkflowId = createWorkflow(database, 'gyerek', null);
    const { runs } = seedRunChain(database, [parentWorkflowId]);
    const parentRun = runs[0] ?? notCalled();
    const published: unknown[] = [];
    const ports = portsOf(database, published);
    const { runner } = fakeRunner(database, { startError: 'érvénytelen gyerek gráf (unreachable_node).' });

    const outcome = okOrThrow(await executeSubWorkflow(inputOf(parentRun.id, targetWorkflowId), ports, runner));

    expect(outcome.kind === 'failed' ? outcome.errorKind : 'nincs-ilyen-ag').toBe('sub_workflow_failed');
    expect(outcome.stepRun.errorMessage).toContain('unreachable_node');
    expect(published).toHaveLength(2);
    expect(published[0]).toMatchObject({ kind: 'step_started' });
    expect(published[1]).toMatchObject({ kind: 'step_finished' });
  });

  it('a megvárás hibaága is sub_workflow_failed', async () => {
    const database = openMemoryDatabase();
    const parentWorkflowId = createWorkflow(database, 'szülő', 'minimax');
    const targetWorkflowId = createWorkflow(database, 'gyerek', null);
    const { runs } = seedRunChain(database, [parentWorkflowId]);
    const parentRun = runs[0] ?? notCalled();
    const ports = portsOf(database, []);
    const { runner } = fakeRunner(database, { awaitError: 'a léptetés megszakadt' });

    const outcome = okOrThrow(await executeSubWorkflow(inputOf(parentRun.id, targetWorkflowId), ports, runner));

    expect(outcome.kind === 'failed' ? outcome.errorKind : 'nincs-ilyen-ag').toBe('sub_workflow_failed');
    expect(outcome.stepRun.errorMessage).toContain('a léptetés megszakadt');
  });

  it('a begin fázis hibáját továbbadja (nem létező runId)', async () => {
    const database = openMemoryDatabase();
    const targetWorkflowId = createWorkflow(database, 'gyerek', null);
    const ports = portsOf(database, []);
    const { runner } = fakeRunner(database);

    const outcome = await executeSubWorkflow(inputOf('nincs-ilyen-futas', targetWorkflowId), ports, runner);

    expect(outcome.kind).toBe('error');
  });

  it('a szülő futás beolvasásának hibáját továbbadja', async () => {
    const database = openMemoryDatabase();
    const parentWorkflowId = createWorkflow(database, 'szülő', 'minimax');
    const targetWorkflowId = createWorkflow(database, 'gyerek', null);
    const { runs } = seedRunChain(database, [parentWorkflowId]);
    const parentRun = runs[0] ?? notCalled();
    const brokenDatabase: DatabaseContext = {
      ...database,
      runs: { ...database.runs, getRun: () => ({ kind: 'error', message: 'a futás olvasása elhasalt' }) },
    };
    const ports = portsOf(brokenDatabase, []);
    const { runner } = fakeRunner(database);

    const outcome = await executeSubWorkflow(inputOf(parentRun.id, targetWorkflowId), ports, runner);

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('a futás olvasása elhasalt');
  });

  it('a sub_workflow_run_id írásának hibáját továbbadja', async () => {
    const database = openMemoryDatabase();
    const parentWorkflowId = createWorkflow(database, 'szülő', 'minimax');
    const targetWorkflowId = createWorkflow(database, 'gyerek', null);
    const { runs } = seedRunChain(database, [parentWorkflowId]);
    const parentRun = runs[0] ?? notCalled();
    const brokenDatabase: DatabaseContext = {
      ...database,
      stepRuns: {
        ...database.stepRuns,
        attachSubWorkflowRun: () => ({ kind: 'error', message: 'az oszlop írása elhasalt' }),
      },
    };
    const ports = portsOf(brokenDatabase, []);
    const { runner } = fakeRunner(database);

    const outcome = await executeSubWorkflow(inputOf(parentRun.id, targetWorkflowId), ports, runner);

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('az oszlop írása elhasalt');
  });

  it('a sub_workflow_started esemény írásának hibáját továbbadja', async () => {
    const database = openMemoryDatabase();
    const parentWorkflowId = createWorkflow(database, 'szülő', 'minimax');
    const targetWorkflowId = createWorkflow(database, 'gyerek', null);
    const { runs } = seedRunChain(database, [parentWorkflowId]);
    const parentRun = runs[0] ?? notCalled();
    const brokenDatabase: DatabaseContext = {
      ...database,
      events: {
        ...database.events,
        appendEngineEvent: (input) =>
          input.kind === 'sub_workflow_started'
            ? { kind: 'error', message: 'az esemény írása elhasalt' }
            : database.events.appendEngineEvent(input),
      },
    };
    const ports = portsOf(brokenDatabase, []);
    const { runner } = fakeRunner(database);

    const outcome = await executeSubWorkflow(inputOf(parentRun.id, targetWorkflowId), ports, runner);

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('az esemény írása elhasalt');
  });

  it('a sub_workflow_finished esemény írásának hibáját továbbadja', async () => {
    const database = openMemoryDatabase();
    const parentWorkflowId = createWorkflow(database, 'szülő', 'minimax');
    const targetWorkflowId = createWorkflow(database, 'gyerek', null);
    const { runs } = seedRunChain(database, [parentWorkflowId]);
    const parentRun = runs[0] ?? notCalled();
    const brokenDatabase: DatabaseContext = {
      ...database,
      events: {
        ...database.events,
        appendEngineEvent: (input) =>
          input.kind === 'sub_workflow_finished'
            ? { kind: 'error', message: 'a záró esemény írása elhasalt' }
            : database.events.appendEngineEvent(input),
      },
    };
    const ports = portsOf(brokenDatabase, []);
    const { runner } = fakeRunner(database);

    const outcome = await executeSubWorkflow(inputOf(parentRun.id, targetWorkflowId), ports, runner);

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('a záró esemény írása elhasalt');
  });

  it('a záró fázis hibáját továbbadja, ha a sor a running és a succeeded átmenet között más állapotba kerül', async () => {
    const database = openMemoryDatabase();
    const parentWorkflowId = createWorkflow(database, 'szülő', 'minimax');
    const targetWorkflowId = createWorkflow(database, 'gyerek', null);
    const { runs } = seedRunChain(database, [parentWorkflowId]);
    const parentRun = runs[0] ?? notCalled();
    const racyDatabase: DatabaseContext = {
      ...database,
      stepRuns: {
        ...database.stepRuns,
        markStepRunning: (stepRunId) => {
          const running = database.stepRuns.markStepRunning(stepRunId);
          if (running.kind === 'ok') {
            database.stepRuns.markStepCancelled(stepRunId);
          }
          return running;
        },
      },
    };
    const ports = portsOf(racyDatabase, []);
    const { runner } = fakeRunner(database);

    const outcome = await executeSubWorkflow(inputOf(parentRun.id, targetWorkflowId), ports, runner);

    expect(outcome.kind).toBe('error');
  });

  it('a rekurzió hibaágán a záró fázis hibáját is továbbadja', async () => {
    const database = openMemoryDatabase();
    const workflowA = createWorkflow(database, 'A', 'minimax');
    const { runs } = seedRunChain(database, [workflowA]);
    const runA = runs[0] ?? notCalled();
    const racyDatabase: DatabaseContext = {
      ...database,
      stepRuns: {
        ...database.stepRuns,
        markStepRunning: (stepRunId) => {
          const running = database.stepRuns.markStepRunning(stepRunId);
          if (running.kind === 'ok') {
            database.stepRuns.markStepCancelled(stepRunId);
          }
          return running;
        },
      },
    };
    const ports = portsOf(racyDatabase, []);
    const { runner } = fakeRunner(database);

    const outcome = await executeSubWorkflow(inputOf(runA.id, workflowA), ports, runner);

    expect(outcome.kind).toBe('error');
  });
});

/**
 * SPEC-004 5.9 5. pont és 7.2 táblázat, PLAN-005 T-005-23 elfogadási
 * kritériuma: "a lépés **nem** foglal párhuzamossági helyet, és egy egy
 * helyes szabályozó mellett a futás végigfut (holtpont mentesség)".
 *
 * A teszt egy **egy helyes** valódi `ConcurrencyGate`-tel fut. A gyerek futás
 * lépését az `awaitChildRun` szimulálja: helyet kér ugyanattól a
 * szabályozótól, amiből a szülő is kérne, ha kérne. Ha a `sub_workflow`
 * végrehajtó helyet tartana a várakozás alatt, a gyerek kérése soha nem
 * teljesülne, és ez a teszt időtúllépéssel bukna. Mivel a végrehajtó nem hív
 * `requestSlot`-ot, az egyetlen hely mindvégig szabad marad a gyereknek.
 */
describe('executeSubWorkflow holtpont mentesség', () => {
  it('egy helyes szabályozó mellett a gyerek lépése megkapja a helyet, amíg a szülő lépés vár', async () => {
    const database = openMemoryDatabase();
    const parentWorkflowId = createWorkflow(database, 'szülő', 'minimax');
    const targetWorkflowId = createWorkflow(database, 'gyerek', null);
    const { runs } = seedRunChain(database, [parentWorkflowId]);
    const parentRun = runs[0] ?? notCalled();
    const ports = portsOf(database, []);

    const gate = createConcurrencyGate(() => 1);
    const grants: string[] = [];
    const { runner } = fakeRunner(database, {
      beforeAwaitResolves: async () => {
        await new Promise<void>((resolve) => {
          gate.requestSlot('minimax', 'gyerek-lepes', () => {
            grants.push('gyerek-lepes');
            resolve();
          });
        });
        okOrThrow(gate.releaseSlot('gyerek-lepes'));
      },
    });

    const outcome = okOrThrow(await executeSubWorkflow(inputOf(parentRun.id, targetWorkflowId), ports, runner));

    expect(outcome.kind).toBe('succeeded');
    expect(grants).toStrictEqual(['gyerek-lepes']);
    // A szülő lépés soha nem kért helyet, tehát a szabályozó a futás után is üres.
    expect(gate.occupiedSlotCount('minimax')).toBe(0);
    expect(gate.waitingRequestCount('minimax')).toBe(0);
  });
});
