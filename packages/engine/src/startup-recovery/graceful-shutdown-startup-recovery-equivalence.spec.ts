/* eslint-disable unicorn/no-null -- a `GraphSnapshotDocument.workflow.description` tárolt null értéke (SPEC-003 5.1) */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext, GraphSnapshotDocument } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import { isRecord } from '@easter-workflow-builder/typeguards';
import { createApprovalWaitRegistry } from '../node-executor/approval-wait-registry.ts';
import { createAgentQueryRegistry } from '../run-interrupt/agent-query-registry.ts';
import { shutdownActiveRuns } from '../run-interrupt/shutdown-active-runs.ts';
import type { RunSupervisor } from '../run-supervisor/run-supervisor.ts';
import { runStartupRecovery } from './run-startup-recovery.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function snapshotOf(workflowId: string, workflowName: string): GraphSnapshotDocument {
  return {
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: workflowId, name: workflowName, description: null },
    nodes: [],
    edges: [],
  };
}

interface SeededState {
  readonly database: DatabaseContext;
  readonly runId: string;
  readonly runningStepId: string;
  readonly pendingStepId: string;
}

/**
 * UGYANAZ a kiinduló állapot mindkét úton: egy `running` futás, egy `running`
 * és egy `pending` lépéssel (SPEC-004 T-005-27 elfogadási kritériuma: "egy
 * futó workflow, néhány `running`/`pending` lépéssel").
 */
function seedRunningWorkflow(): SeededState {
  const database = okOrThrow(openDatabase(':memory:'));
  const workflow = okOrThrow(database.workflows.createWorkflow({ name: 'futo', description: null, providerId: null }));
  const run = okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'minimax',
      graphSnapshotDocument: snapshotOf(workflow.id, workflow.name),
    }),
  );
  okOrThrow(database.runs.markRunRunning(run.id));
  const runningStep = okOrThrow(
    database.stepRuns.createStepRun({
      runId: run.id,
      nodeId: 'a1',
      nodeType: 'agent_step',
      parentStepRunId: null,
      providerId: 'minimax',
      modelId: 'modell-1',
      sessionMode: 'isolated',
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    }),
  );
  okOrThrow(database.stepRuns.markStepRunning(runningStep.id));
  const pendingStep = okOrThrow(
    database.stepRuns.createStepRun({
      runId: run.id,
      nodeId: 'a2',
      nodeType: 'agent_step',
      parentStepRunId: null,
      providerId: 'minimax',
      modelId: 'modell-1',
      sessionMode: 'isolated',
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    }),
  );
  return { database, runId: run.id, runningStepId: runningStep.id, pendingStepId: pendingStep.id };
}

interface FinalState {
  readonly runStatus: string;
  readonly runningStepStatus: string;
  readonly pendingStepStatus: string;
  readonly interruptedEventCount: number;
  readonly interruptedEventReason: unknown;
}

function readFinalState(seeded: SeededState): FinalState {
  const run = okOrThrow(seeded.database.runs.getRun(seeded.runId));
  const runningStep = okOrThrow(seeded.database.stepRuns.getStepRun(seeded.runningStepId));
  const pendingStep = okOrThrow(seeded.database.stepRuns.getStepRun(seeded.pendingStepId));
  const events = okOrThrow(seeded.database.events.readEventsSince(seeded.runId, 0, 20));
  const interrupted = events.filter((event) => event.kind === 'run_interrupted');
  return {
    runStatus: run.status,
    runningStepStatus: runningStep.status,
    pendingStepStatus: pendingStep.status,
    interruptedEventCount: interrupted.length,
    interruptedEventReason: isRecord(interrupted[0]?.payload) ? interrupted[0].payload['reason'] : undefined,
  };
}

describe('a szabályos leállás és a durva leállás utáni indulási helyreállítás egyenértékűsége (SPEC-004 10.2 szekció, AC-54)', () => {
  it('UGYANAZON kiinduló állapoton azonos futás- és lépésállapotot hagy, csak a run_interrupted esemény reason mezője tér el', async () => {
    const viaStartupRecovery = seedRunningWorkflow();
    const viaGracefulShutdown = seedRunningWorkflow();

    okOrThrow(runStartupRecovery(viaStartupRecovery.database));

    const noActiveRuns: Pick<RunSupervisor, 'listActiveRuns'> = { listActiveRuns: () => [] };
    okOrThrow(
      await shutdownActiveRuns({
        database: viaGracefulShutdown.database,
        runSupervisor: noActiveRuns,
        agentQueryRegistry: createAgentQueryRegistry(),
        approvalRegistry: createApprovalWaitRegistry(),
      }),
    );

    const startupResult = readFinalState(viaStartupRecovery);
    const shutdownResult = readFinalState(viaGracefulShutdown);

    // A futás és a lépések állapota azonos mindkét úton.
    expect(startupResult.runStatus).toBe('interrupted');
    expect(shutdownResult.runStatus).toBe('interrupted');
    expect(startupResult.runningStepStatus).toBe('interrupted');
    expect(shutdownResult.runningStepStatus).toBe('interrupted');
    expect(startupResult.pendingStepStatus).toBe('interrupted');
    expect(shutdownResult.pendingStepStatus).toBe('interrupted');
    expect(startupResult.interruptedEventCount).toBe(1);
    expect(shutdownResult.interruptedEventCount).toBe(1);

    // Kizárólag a run_interrupted esemény reason mezője tér el.
    expect(startupResult.interruptedEventReason).toBe('startup_recovery');
    expect(shutdownResult.interruptedEventReason).toBe('graceful_shutdown');

    // A két végállapot pontosan a reason mezőben tér el, minden más azonos:
    // ezt a `readFinalState` alakja fejezi ki - ha a két objektumot a
    // reason nélkül hasonlítjuk össze, azonosnak kell lenniük.
    const { interruptedEventReason: startupReason, ...startupRest } = startupResult;
    const { interruptedEventReason: shutdownReason, ...shutdownRest } = shutdownResult;
    expect(startupRest).toStrictEqual(shutdownRest);
    expect(startupReason).not.toBe(shutdownReason);

    viaStartupRecovery.database.close();
    viaGracefulShutdown.database.close();
  });
});
