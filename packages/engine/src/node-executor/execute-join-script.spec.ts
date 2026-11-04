/* eslint-disable unicorn/no-null -- a `WorkflowRepository`/`WorkflowRunRepository`, a `NodeExecutionInstance.parentStepRunId` és a JavaScript szkript nullázható mezői (SPEC-003 5.1, 4.3, SPEC-014 5.3) a teszt fixture valódi kezdő értékei, nem helyőrzők */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext, JoinScriptNodeConfig } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import { isRecord } from '@easter-workflow-builder/typeguards';
import type { ScriptRunRequest } from '../engine-port/script-run-request.ts';
import type { ScriptRunResult } from '../engine-port/script-run-result.ts';
import type { RunContext } from '../run-context/run-context.ts';
import { executeJoinScript, type ExecuteJoinScriptInput } from './execute-join-script.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function seedRun(database: DatabaseContext): string {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'execute-join-script teszt', description: null, providerId: null }),
  );
  const snapshot = {
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: workflow.id, name: workflow.name, description: null },
    nodes: [],
    edges: [],
  } as const;
  return okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'minimax',
      graphSnapshotDocument: snapshot,
    }),
  ).id;
}

const notCalled = (): never => {
  throw new Error('ebben a tesztben nem hívott port');
};

const JOIN_INPUTS = ['elso', 'masodik'];
const RUN_CONTEXT: RunContext = {
  input: {},
  steps: {},
  item: undefined,
  itemIndex: undefined,
  iteration: undefined,
  joinInputs: JOIN_INPUTS,
  error: undefined,
};

const CONFIG: JoinScriptNodeConfig = {
  type: 'join',
  mode: 'script',
  settings: {
    runtime: 'javascript',
    source: 'return joinInputs.length;',
    timeoutMs: null,
    cwd: null,
    memoryLimitMb: null,
    fetchResponseLimitMb: null,
    fileReadLimitMb: null,
  },
  onUnhandledError: 'fail_run',
};

function harness(result: ScriptRunResult) {
  const database = okOrThrow(openDatabase(':memory:'));
  const runId = seedRun(database);
  const published: unknown[] = [];
  const requests: ScriptRunRequest[] = [];
  let now = 0;
  const ports: Parameters<typeof executeJoinScript>[1] = {
    database,
    clock: {
      nowMs: () => {
        now += 5;
        return now;
      },
      sleep: notCalled,
    },
    idGenerator: { nextId: notCalled },
    eventPublisher: {
      publish: (event) => {
        published.push(event);
      },
    },
    expressionEvaluator: { evaluate: notCalled, compile: notCalled },
    templateRenderer: { render: notCalled, compile: notCalled },
    scriptRunner: {
      compile: notCalled,
      run: (request) => {
        requests.push(request);
        return Promise.resolve(result);
      },
    },
  };
  const input: ExecuteJoinScriptInput = {
    instance: {
      runId,
      instance: { nodeId: 'j', branchContext: [] },
      parentStepRunId: null,
      iteration: 0,
      attempt: 1,
      providerId: 'minimax',
      failureStopsRun: false,
    },
    config: CONFIG,
    runContext: RUN_CONTEXT,
    joinInputs: JOIN_INPUTS,
    stopSignal: new AbortController().signal,
  };
  return { database, runId, published, requests, ports, input };
}

function joinResolvedEvents(published: readonly unknown[]): readonly unknown[] {
  return published.filter((event) => isRecord(event) && event['kind'] === 'join_resolved');
}

describe('executeJoinScript', () => {
  it('a settings szkriptje a joinInputs listát a kontextusban kapja, a sor join típusú, és join_resolved esemény íródik script móddal', async () => {
    const context = harness({ kind: 'succeeded', output: 2 });

    const result = okOrThrow(await executeJoinScript(context.input, context.ports));

    expect(context.requests.map((request) => [request.source, request.runContext.joinInputs])).toStrictEqual([
      ['return joinInputs.length;', JOIN_INPUTS],
    ]);
    expect(result.kind === 'succeeded' ? result.stepRun : undefined).toMatchObject({ nodeType: 'join', output: 2 });
    expect(joinResolvedEvents(context.published)).toStrictEqual([
      expect.objectContaining({ payload: { mode: 'script', inputCount: 2 } }),
    ]);
  });

  it('hibás záráskor is íródik join_resolved (az ai_synthesis mód mintájára)', async () => {
    const context = harness({ kind: 'failed', errorKind: 'script_evaluation_failed', message: 'dobott' });

    const result = okOrThrow(await executeJoinScript(context.input, context.ports));

    expect(result).toMatchObject({ kind: 'failed', errorKind: 'script_evaluation_failed' });
    expect(joinResolvedEvents(context.published)).toHaveLength(1);
  });

  it('megszakításkor interrupted, join_resolved nélkül', async () => {
    const context = harness({ kind: 'aborted' });

    const result = okOrThrow(await executeJoinScript(context.input, context.ports));

    expect(result).toStrictEqual({ kind: 'interrupted' });
    expect(joinResolvedEvents(context.published)).toStrictEqual([]);
  });

  it('a közös végrehajtó hibáját továbbadja, join_resolved nélkül', async () => {
    const context = harness({ kind: 'succeeded', output: 1 });

    const outcome = await executeJoinScript(
      { ...context.input, instance: { ...context.input.instance, runId: 'nincs-ilyen-futas' } },
      context.ports,
    );

    expect(outcome.kind).toBe('error');
    expect(joinResolvedEvents(context.published)).toStrictEqual([]);
  });

  it('a join_resolved esemény írásának hibáját továbbadja, ha a kapcsolat a step_finished után zárul le', async () => {
    const context = harness({ kind: 'succeeded', output: 1 });
    let appendCount = 0;
    const racyDatabase: DatabaseContext = {
      ...context.database,
      events: {
        ...context.database.events,
        appendEngineEvent: (input) => {
          appendCount += 1;
          if (appendCount === 3) {
            context.database.close();
          }
          return context.database.events.appendEngineEvent(input);
        },
      },
    };

    const outcome = await executeJoinScript(context.input, { ...context.ports, database: racyDatabase });

    expect(outcome.kind).toBe('error');
  });
});
