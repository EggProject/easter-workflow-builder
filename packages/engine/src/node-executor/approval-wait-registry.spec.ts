import { describe, expect, it } from 'vitest';
import { createApprovalWaitRegistry } from './approval-wait-registry.ts';

describe('createApprovalWaitRegistry', () => {
  it('a waitForDecision Promise-a a notifyDecided hívás decision értékével oldódik fel', async () => {
    const registry = createApprovalWaitRegistry();

    const pending = registry.waitForDecision('run-1', 'step-1');
    registry.notifyDecided('step-1', 'approved');

    await expect(pending).resolves.toStrictEqual({ kind: 'decided', decision: 'approved' });
  });

  it('a notifyDecided után ugyanarra a stepRunId-ra érkező második hívás csendben hatástalan', async () => {
    const registry = createApprovalWaitRegistry();

    const pending = registry.waitForDecision('run-1', 'step-1');
    registry.notifyDecided('step-1', 'rejected');
    // A már feloldott bejegyzés törölve: a második hívás nem dob és nem fut le semmi látható hatása.
    registry.notifyDecided('step-1', 'approved');

    await expect(pending).resolves.toStrictEqual({ kind: 'decided', decision: 'rejected' });
  });

  it('ismeretlen stepRunId-ra érkező notifyDecided csendben hatástalan (nincs regisztrált várakozó)', () => {
    const registry = createApprovalWaitRegistry();

    expect(() => {
      registry.notifyDecided('nincs-ilyen-step', 'approved');
    }).not.toThrow();
  });

  it('a cancelWait törli a várakozót, a Promise ez után nem oldódik fel', async () => {
    const registry = createApprovalWaitRegistry();

    const pending = registry.waitForDecision('run-1', 'step-1');
    registry.cancelWait('step-1');
    // A cancelWait utáni notifyDecided már nem talál bejegyzést, tehát a Promise örökre függőben marad.
    registry.notifyDecided('step-1', 'approved');

    const decided = (async (): Promise<'decided'> => {
      await pending;
      return 'decided';
    })();
    const raced = await Promise.race([decided, Promise.resolve('nem-dontott' as const)]);
    expect(raced).toBe('nem-dontott');
  });

  it('ismeretlen stepRunId-ra érkező cancelWait csendben hatástalan', () => {
    const registry = createApprovalWaitRegistry();

    expect(() => {
      registry.cancelWait('nincs-ilyen-step');
    }).not.toThrow();
  });

  it('két különböző stepRunId egymástól függetlenül, keveredés nélkül oldódik fel', async () => {
    const registry = createApprovalWaitRegistry();

    const first = registry.waitForDecision('run-1', 'step-1');
    const second = registry.waitForDecision('run-1', 'step-2');

    registry.notifyDecided('step-2', 'rejected');
    registry.notifyDecided('step-1', 'approved');

    await expect(first).resolves.toStrictEqual({ kind: 'decided', decision: 'approved' });
    await expect(second).resolves.toStrictEqual({ kind: 'decided', decision: 'rejected' });
  });

  it('REGRESSZIÓ (AC-51): a cancelWaitingForRunIds interrupted jelzéssel oldja fel a futás minden várakozóját', async () => {
    const registry = createApprovalWaitRegistry();

    const first = registry.waitForDecision('run-1', 'step-1');
    const second = registry.waitForDecision('run-1', 'step-2');

    registry.cancelWaitingForRunIds(new Set(['run-1']));

    await expect(first).resolves.toStrictEqual({ kind: 'interrupted' });
    await expect(second).resolves.toStrictEqual({ kind: 'interrupted' });
  });

  it('a cancelWaitingForRunIds MÁS futás várakozóját nem érinti', async () => {
    const registry = createApprovalWaitRegistry();

    const target = registry.waitForDecision('run-1', 'step-1');
    const other = registry.waitForDecision('run-2', 'step-2');

    registry.cancelWaitingForRunIds(new Set(['run-1']));
    registry.notifyDecided('step-2', 'approved');

    await expect(target).resolves.toStrictEqual({ kind: 'interrupted' });
    await expect(other).resolves.toStrictEqual({ kind: 'decided', decision: 'approved' });
  });

  it('a cancelWaitingForRunIds törli is a bejegyzést: a később érkező döntés csendben hatástalan', async () => {
    const registry = createApprovalWaitRegistry();

    const pending = registry.waitForDecision('run-1', 'step-1');
    registry.cancelWaitingForRunIds(new Set(['run-1']));
    // Az elkésett döntés már nem talál bejegyzést: a Promise az interrupted
    // jelzésnél marad, nem íródik felül.
    registry.notifyDecided('step-1', 'approved');

    await expect(pending).resolves.toStrictEqual({ kind: 'interrupted' });
  });

  it('üres runId halmazra a cancelWaitingForRunIds egyetlen várakozót sem old fel', async () => {
    const registry = createApprovalWaitRegistry();

    const pending = registry.waitForDecision('run-1', 'step-1');
    registry.cancelWaitingForRunIds(new Set());
    registry.notifyDecided('step-1', 'approved');

    await expect(pending).resolves.toStrictEqual({ kind: 'decided', decision: 'approved' });
  });
});
