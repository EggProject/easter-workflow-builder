import { describe, expect, it, vi } from 'vitest';
import type { Outcome } from '@easter-workflow-builder/core';
import type { AgentQuery } from '@easter-workflow-builder/agent';
import type { RunCompletion } from '../error-policy/run-completion.ts';
import type { ActiveRunHandle } from '../run-supervisor/active-run-registry.ts';
import { createConcurrencyGate } from '../concurrency-gate/create-concurrency-gate.ts';
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
  let stopTargetStatus: 'cancelled' | 'interrupted' | undefined;
  const handle: ActiveRunHandle = {
    runId,
    rootRunId,
    workflowId: 'wf',
    completion,
    requestStop: (targetStatus) => {
      stopTargetStatus = targetStatus;
    },
    stopTargetStatus: () => stopTargetStatus,
  };
  return {
    handle,
    resolve: () => {
      resolveCompletion(SUCCEEDED);
    },
  };
}

/**
 * Korlát nélküli valódi szabályozó: ott, ahol a teszt tárgya nem a sorban
 * álló lépés, egyetlen kérés sem áll sorba, tehát az elutasítás nem hat.
 */
function openGate(): ReturnType<typeof createConcurrencyGate> {
  // eslint-disable-next-line unicorn/no-null -- a `ConcurrencyLimitLookup` `null` értéke valódi adat: a providerhez nincs beállított korlát (SPEC-003 11.)
  return createConcurrencyGate(() => null);
}

function fakeQuery(interrupt: () => Promise<void>): AgentQuery {
  return {
    messages: { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true, value: undefined }) }) },
    interrupt,
  };
}

describe('stopAndAwaitRunTree', () => {
  it.each(['cancelled', 'interrupted'] as const)(
    'minden kapott kézikönyvön requestStop-ot hív, a(z) %s célállapottal',
    async (stopTargetStatus) => {
      const registry = createAgentQueryRegistry();
      const first = controlledHandle('run-1', 'root-1');
      const second = controlledHandle('run-2', 'root-1');
      first.resolve();
      second.resolve();

      await stopAndAwaitRunTree(
        [first.handle, second.handle],
        stopTargetStatus,
        registry,
        createApprovalWaitRegistry(),
        openGate(),
      );

      expect(first.handle.stopTargetStatus()).toBe(stopTargetStatus);
      expect(second.handle.stopTargetStatus()).toBe(stopTargetStatus);
    },
  );

  it('interrupt()-et hív minden, a kapott futásokhoz tartozó élő query-n, máshoz tartozón nem', async () => {
    const registry = createAgentQueryRegistry();
    const interruptInTree = vi.fn(() => Promise.resolve());
    const interruptOutsideTree = vi.fn(() => Promise.resolve());
    registry.register('run-1', 'step-1', fakeQuery(interruptInTree));
    registry.register('run-other', 'step-other', fakeQuery(interruptOutsideTree));
    const { handle, resolve } = controlledHandle('run-1', 'root-1');
    resolve();

    await stopAndAwaitRunTree([handle], 'cancelled', registry, createApprovalWaitRegistry(), openGate());

    expect(interruptInTree).toHaveBeenCalledTimes(1);
    expect(interruptOutsideTree).not.toHaveBeenCalled();
  });

  it('megvárja MINDEN kapott kézikönyv completion Promise-át, mielőtt visszatér', async () => {
    const registry = createAgentQueryRegistry();
    const first = controlledHandle('run-1', 'root-1');
    const second = controlledHandle('run-2', 'root-1');

    let hasSettled = false;
    const call = (async (): Promise<void> => {
      await stopAndAwaitRunTree(
        [first.handle, second.handle],
        'cancelled',
        registry,
        createApprovalWaitRegistry(),
        openGate(),
      );
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
    // A `requestStop`-nak ebben a tesztben nincs szerepe: a lezárást a
    // jóváhagyás feloldása vezérli.
    const handle: ActiveRunHandle = { ...controlledHandle('run-1', 'root-1').handle, completion };
    void inTree.then(() => {
      resolve(SUCCEEDED);
    });

    await stopAndAwaitRunTree([handle], 'cancelled', registry, approvalRegistry, openGate());

    await expect(inTree).resolves.toStrictEqual({ kind: 'interrupted' });
    // A fán kívüli futás várakozója érintetlen: a döntése változatlanul megjön.
    approvalRegistry.notifyDecided('step-other', 'approved');
    await expect(outsideTree).resolves.toStrictEqual({ kind: 'decided', decision: 'approved' });
  });

  it('REGRESSZIÓ: a kapott futások sorban álló agent lépéseit kiveszi a szabályozó sorából, MIELŐTT a completion-re várna, más futásét nem (SPEC-004 9. szekció 2. pont)', async () => {
    const registry = createAgentQueryRegistry();
    // Egy hely, amit egy fán kívüli lépés foglal: minden további kérés sorba áll.
    const gate = createConcurrencyGate(() => 1);
    const events: string[] = [];
    gate.requestSlot(
      'minimax',
      'run-other',
      'step-running',
      () => {
        events.push('granted:step-running');
      },
      () => {
        events.push('denied:step-running');
      },
    );
    for (const [runId, stepId] of [
      ['run-1', 'step-1'],
      ['run-other', 'step-other'],
    ] as const) {
      gate.requestSlot(
        'minimax',
        runId,
        stepId,
        () => {
          events.push(`granted:${stepId}`);
        },
        () => {
          events.push(`denied:${stepId}`);
        },
      );
    }
    // A futás léptető hurka a valóságban a sorban álló lépésre is vár: a
    // `completion` csak az elutasítás után teljesül.
    const { promise: completion, resolve } = Promise.withResolvers<Outcome<RunCompletion>>();
    const handle: ActiveRunHandle = {
      ...controlledHandle('run-1', 'root-1').handle,
      completion,
      requestStop: () => {
        events.push('requestStop:run-1');
      },
    };
    const waiting = stopAndAwaitRunTree([handle], 'cancelled', registry, createApprovalWaitRegistry(), gate);

    expect(events).toStrictEqual(['granted:step-running', 'requestStop:run-1', 'denied:step-1']);
    expect(gate.waitingRequestCount('minimax')).toBe(1);
    resolve(SUCCEEDED);
    await waiting;

    // A felszabaduló hely a fán kívüli várakozóé, a kivett lépés nem kapja meg.
    gate.releaseSlot('step-running');
    expect(events).toStrictEqual(['granted:step-running', 'requestStop:run-1', 'denied:step-1', 'granted:step-other']);
  });

  it('üres kézikönyv listára azonnal visszatér, nem hív interrupt-ot', async () => {
    const registry = createAgentQueryRegistry();
    const interruptSpy = vi.fn(() => Promise.resolve());
    registry.register('run-x', 'step-x', fakeQuery(interruptSpy));

    await stopAndAwaitRunTree([], 'cancelled', registry, createApprovalWaitRegistry(), openGate());

    expect(interruptSpy).not.toHaveBeenCalled();
  });
});
