/* eslint-disable unicorn/no-null -- a `GraphSnapshotDocument.workflow.description` és a `createStepRun` bemenetének mezői itt tárolt `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext, StepRunStatus } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import { closeWaitingApprovalStepRuns } from './close-waiting-approval-step-runs.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function seedRunningRun(database: DatabaseContext, name: string): string {
  const workflow = okOrThrow(database.workflows.createWorkflow({ name, description: null, providerId: null }));
  const run = okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'minimax',
      graphSnapshotDocument: {
        version: 1,
        sdkVersionPin: '0.0.0-teszt',
        workflow: { id: workflow.id, name, description: null },
        nodes: [],
        edges: [],
      },
    }),
  );
  return okOrThrow(database.runs.markRunRunning(run.id)).id;
}

function createStep(database: DatabaseContext, runId: string, nodeId: string): string {
  return okOrThrow(
    database.stepRuns.createStepRun({
      runId,
      nodeId,
      nodeType: 'human_approval',
      parentStepRunId: null,
      providerId: 'minimax',
      modelId: null,
      sessionMode: null,
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    }),
  ).id;
}

// Egy döntésre váró jóváhagyás: `waiting_approval` sor, `decision` NULL.
function seedWaitingApproval(database: DatabaseContext, runId: string, nodeId: string): string {
  const stepRunId = createStep(database, runId, nodeId);
  okOrThrow(database.stepRuns.markStepRunning(stepRunId));
  okOrThrow(database.approvals.requestApproval({ runId, stepRunId, title: 'döntés', body: 'szöveg', payload: {} }));
  return stepRunId;
}

function statusOf(database: DatabaseContext, stepRunId: string): StepRunStatus {
  return okOrThrow(database.stepRuns.getStepRun(stepRunId)).status;
}

// A két záró állapot: a megszakítás és a `fail_run` (`cancelled`), illetve a szabályos leállás (`interrupted`).
const CLOSED_STATUSES = ['cancelled', 'interrupted'] as const;

describe('closeWaitingApprovalStepRuns', () => {
  it.each(CLOSED_STATUSES)(
    'a megnevezett futások waiting_approval sorát %s állapotba viszi, a döntés NULL marad',
    (closedStatus) => {
      const database = okOrThrow(openDatabase(':memory:'));
      const first = seedRunningRun(database, 'elso');
      const second = seedRunningRun(database, 'masodik');
      const firstApproval = seedWaitingApproval(database, first, 'jov-1');
      const secondApproval = seedWaitingApproval(database, second, 'jov-2');

      okOrThrow(closeWaitingApprovalStepRuns(new Set([first, second]), closedStatus, database));

      expect([statusOf(database, firstApproval), statusOf(database, secondApproval)]).toStrictEqual([
        closedStatus,
        closedStatus,
      ]);
      expect(okOrThrow(database.approvals.getApprovalForStep(firstApproval)).decision).toBeNull();
      database.close();
    },
  );

  it('más állapotú sort és más futás sorát nem érinti', () => {
    const database = okOrThrow(openDatabase(':memory:'));
    const target = seedRunningRun(database, 'cel');
    const other = seedRunningRun(database, 'masik');
    const pendingStep = createStep(database, target, 'sorban');
    const runningStep = createStep(database, target, 'fut');
    okOrThrow(database.stepRuns.markStepRunning(runningStep));
    const otherApproval = seedWaitingApproval(database, other, 'jov-masik');

    okOrThrow(closeWaitingApprovalStepRuns(new Set([target]), 'cancelled', database));

    expect([statusOf(database, pendingStep), statusOf(database, runningStep)]).toStrictEqual(['pending', 'running']);
    expect(statusOf(database, otherApproval)).toBe('waiting_approval');
    database.close();
  });

  it.each(CLOSED_STATUSES)(
    'a %s állapotba lezárt sorra érkező döntés illegal_status_transition hibával bukik, és a döntés sem íródik be',
    (closedStatus) => {
      const database = okOrThrow(openDatabase(':memory:'));
      const runId = seedRunningRun(database, 'kesei-dontes');
      const approval = seedWaitingApproval(database, runId, 'jov');

      okOrThrow(closeWaitingApprovalStepRuns(new Set([runId]), closedStatus, database));
      const late = database.approvals.decideApproval({ stepRunId: approval, decision: 'approved' });

      expect(late.kind === 'error' ? late.message : '').toContain('(illegal_status_transition)');
      expect(statusOf(database, approval)).toBe(closedStatus);
      expect(okOrThrow(database.approvals.getApprovalForStep(approval)).decision).toBeNull();
      database.close();
    },
  );

  it('a lépés sorok olvasásának hibáját továbbadja', () => {
    const database = okOrThrow(openDatabase(':memory:'));
    const runId = seedRunningRun(database, 'olvasasi-hiba');
    database.close();

    const outcome = closeWaitingApprovalStepRuns(new Set([runId]), 'cancelled', database);

    expect(outcome.kind === 'error' ? outcome.message : '').toContain('(database_closed)');
  });

  it.each(CLOSED_STATUSES)('a %s állapotváltás hibáját továbbadja', (closedStatus) => {
    const database = okOrThrow(openDatabase(':memory:'));
    const runId = seedRunningRun(database, 'irasi-hiba');
    const approval = seedWaitingApproval(database, runId, 'jov');
    const failing: DatabaseContext = {
      ...database,
      stepRuns: {
        ...database.stepRuns,
        markStepCancelled: () => ({ kind: 'error', message: 'teszt: a lépés nem zárható' }),
        markStepInterrupted: () => ({ kind: 'error', message: 'teszt: a lépés nem zárható' }),
      },
    };

    const outcome = closeWaitingApprovalStepRuns(new Set([runId]), closedStatus, failing);

    expect(outcome.kind === 'error' ? outcome.message : '').toBe('teszt: a lépés nem zárható');
    expect(statusOf(database, approval)).toBe('waiting_approval');
    database.close();
  });
});
