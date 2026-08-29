import { describe, expect, it, vi } from 'vitest';
import type { Outcome } from '@easter-workflow-builder/core';
import type { AgentQuery } from '@easter-workflow-builder/agent';
import type { RunCompletion } from '../error-policy/run-completion.ts';
import type { ActiveRunHandle } from '../run-supervisor/active-run-registry.ts';
import { createApprovalWaitRegistry } from '../node-executor/approval-wait-registry.ts';
import { createAgentQueryRegistry } from './agent-query-registry.ts';
import { stopAndAwaitRunTree } from './stop-and-await-run-tree.ts';

const SUCCEEDED: Outcome<RunCompletion> = {
  kind: 'ok',
  // eslint-disable-next-line unicorn/no-null -- a `RunCompletion` `succeeded` ágának valódi `null` mezői (error-policy/run-completion.ts)
  value: { status: 'succeeded', errorKind: null, errorMessage: null, failedBranchCount: 0 },
};

/**
 * Kézzel vezérelt kézikönyv: a `completion` csak akkor teljesül, amikor a
 * teszt explicit felold`resolve`-ja fut, tehát a sorrend (előbb `requestStop`
 * és `interrupt`, csak utána a várakozás vége) megfigyelhető.
 */
function controlledHandle(runId: string, rootRunId: string): { handle: ActiveRunHandle; resolve: () => void } {
  const { promise: completion, resolve: resolveCompletion } = Promise.withResolvers<Outcome<RunCompletion>>();
  let hasRequestedStop = false;
  const handle: ActiveRunHandle = {
    runId,
    rootRunId,
    workflowId: 'wf',
    completion,
    requestStop: () => {
      hasRequestedStop = true;
    },
    isStopRequested: () => hasRequestedStop,
  };
  return {
    handle,
    resolve: () => {
      resolveCompletion(SUCCEEDED);
    },
  };
}

function fakeQuery(interrupt: () => Promise<void>): AgentQuery {
  return {
    messages: { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true, value: undefined }) }) },
    interrupt,
  };
}

describe('stopAndAwaitRunTree', () => {
  it('minden kapott kézikönyvön requestStop-ot hív', async () => {
    const registry = createAgentQueryRegistry();
    const first = controlledHandle('run-1', 'root-1');
    const second = controlledHandle('run-2', 'root-1');
    first.resolve();
    second.resolve();

    await stopAndAwaitRunTree([first.handle, second.handle], registry, createApprovalWaitRegistry());

    expect(first.handle.isStopRequested()).toBe(true);
    expect(second.handle.isStopRequested()).toBe(true);
  });

  it('interrupt()-et hív minden, a kapott futásokhoz tartozó élő query-n, máshoz tartozón nem', async () => {
    const registry = createAgentQueryRegistry();
    const interruptInTree = vi.fn(() => Promise.resolve());
    const interruptOutsideTree = vi.fn(() => Promise.resolve());
    registry.register('run-1', 'step-1', fakeQuery(interruptInTree));
    registry.register('run-other', 'step-other', fakeQuery(interruptOutsideTree));
    const { handle, resolve } = controlledHandle('run-1', 'root-1');
    resolve();

    await stopAndAwaitRunTree([handle], registry, createApprovalWaitRegistry());

    expect(interruptInTree).toHaveBeenCalledTimes(1);
    expect(interruptOutsideTree).not.toHaveBeenCalled();
  });

  it('megvárja MINDEN kapott kézikönyv completion Promise-át, mielőtt visszatér', async () => {
    const registry = createAgentQueryRegistry();
    const first = controlledHandle('run-1', 'root-1');
    const second = controlledHandle('run-2', 'root-1');

    let hasSettled = false;
    const call = (async (): Promise<void> => {
      await stopAndAwaitRunTree([first.handle, second.handle], registry, createApprovalWaitRegistry());
      hasSettled = true;
    })();

    await Promise.resolve();
    await Promise.resolve();
    expect(hasSettled).toBe(false);

    first.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(hasSettled).toBe(false);

    second.resolve();
    await call;
    expect(hasSettled).toBe(true);
  });

  it('REGRESSZIÓ (AC-51): a kapott futások VÁRAKOZÓ human_approval lépéseit is lezárja, mielőtt a completion-re várna', async () => {
    const registry = createAgentQueryRegistry();
    const approvalRegistry = createApprovalWaitRegistry();
    const inTree = approvalRegistry.waitForDecision('run-1', 'step-1');
    const outsideTree = approvalRegistry.waitForDecision('run-other', 'step-other');
    // A `completion` szándékosan CSAK akkor teljesül, ha a várakozó jóváhagyás
    // már feloldódott: pontosan ez a valós lánc (a `human_approval`
    // végrehajtója a döntésre vár, tehát a léptető hurok addig nem lép ki).
    const { promise: completion, resolve } = Promise.withResolvers<Outcome<RunCompletion>>();
    const handle: ActiveRunHandle = {
      runId: 'run-1',
      rootRunId: 'root-1',
      workflowId: 'wf',
      completion,
      requestStop: () => {
        // ebben a tesztben nincs szerepe: a lezárást a jóváhagyás feloldása vezérli
      },
      isStopRequested: () => false,
    };
    void inTree.then(() => {
      resolve(SUCCEEDED);
    });

    await stopAndAwaitRunTree([handle], registry, approvalRegistry);

    await expect(inTree).resolves.toStrictEqual({ kind: 'interrupted' });
    // A fán kívüli futás várakozója érintetlen: a döntése változatlanul megjön.
    approvalRegistry.notifyDecided('step-other', 'approved');
    await expect(outsideTree).resolves.toStrictEqual({ kind: 'decided', decision: 'approved' });
  });

  it('üres kézikönyv listára azonnal visszatér, nem hív interrupt-ot', async () => {
    const registry = createAgentQueryRegistry();
    const interruptSpy = vi.fn(() => Promise.resolve());
    registry.register('run-x', 'step-x', fakeQuery(interruptSpy));

    await stopAndAwaitRunTree([], registry, createApprovalWaitRegistry());

    expect(interruptSpy).not.toHaveBeenCalled();
  });
});
