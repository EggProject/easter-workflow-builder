import { describe, expect, it } from 'vitest';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { createStreamRegistry } from './create-stream-registry.ts';

describe('createStreamRegistry', () => {
  it('a serverInstanceId az idGenerator porton generálódik, egyszer', () => {
    let calls = 0;
    const registry = createStreamRegistry({
      nextId: () => {
        calls += 1;
        return 'fixed-id';
      },
    });
    expect(registry.serverInstanceId).toBe('fixed-id');
    expect(calls).toBe(1);
  });

  it('ismeretlen streamId-ra üres feliratkozás listát ad', () => {
    const registry = createStreamRegistry(createRandomUuidIdGenerator());
    expect(registry.getSubscriptions('ismeretlen')).toStrictEqual([]);
  });

  it('replaceSubscriptions teljes cserét végez, és a getSubscriptions ezt tükrözi', () => {
    const registry = createStreamRegistry(createRandomUuidIdGenerator());
    registry.replaceSubscriptions('s1', [{ runId: 'run-1', fromEventId: 0, replayLimit: 10 }]);
    expect(registry.getSubscriptions('s1')).toStrictEqual([{ runId: 'run-1', fromEventId: 0, replayLimit: 10 }]);

    registry.replaceSubscriptions('s1', [{ runId: 'run-2', fromEventId: 5, replayLimit: 20 }]);
    expect(registry.getSubscriptions('s1')).toStrictEqual([{ runId: 'run-2', fromEventId: 5, replayLimit: 20 }]);
  });

  it('replaceSubscriptions a nyitott kapcsolatokat onReplaced hívással értesíti', () => {
    const registry = createStreamRegistry(createRandomUuidIdGenerator());
    let received: unknown;
    registry.openConnection('s1', {
      onReplaced: (entries) => {
        received = entries;
      },
      onSignal: () => {
        // szándékosan üres
      },
      forceClose: () => {
        // szándékosan üres
      },
    });

    registry.replaceSubscriptions('s1', [{ runId: 'run-1', fromEventId: 0, replayLimit: 10 }]);

    expect(received).toStrictEqual([{ runId: 'run-1', fromEventId: 0, replayLimit: 10 }]);
  });

  it('openConnection visszaadott leiratkozó után a kapcsolat nem kap több értesítést', () => {
    const registry = createStreamRegistry(createRandomUuidIdGenerator());
    let callCount = 0;
    const unregister = registry.openConnection('s1', {
      onReplaced: () => {
        callCount += 1;
      },
      onSignal: () => {
        // szándékosan üres
      },
      forceClose: () => {
        // szándékosan üres
      },
    });

    unregister();
    registry.replaceSubscriptions('s1', [{ runId: 'run-1', fromEventId: 0, replayLimit: 10 }]);

    expect(callCount).toBe(0);
  });

  it('notifyRunChanged csak a figyelt futásra feliratkozott streamId kapcsolatait értesíti', () => {
    const registry = createStreamRegistry(createRandomUuidIdGenerator());
    registry.replaceSubscriptions('s1', [{ runId: 'run-1', fromEventId: 0, replayLimit: 10 }]);
    registry.replaceSubscriptions('s2', [{ runId: 'run-2', fromEventId: 0, replayLimit: 10 }]);

    let isS1Notified = false;
    let isS2Notified = false;
    registry.openConnection('s1', {
      onReplaced: () => {
        // szándékosan üres
      },
      onSignal: () => {
        isS1Notified = true;
      },
      forceClose: () => {
        // szándékosan üres
      },
    });
    registry.openConnection('s2', {
      onReplaced: () => {
        // szándékosan üres
      },
      onSignal: () => {
        isS2Notified = true;
      },
      forceClose: () => {
        // szándékosan üres
      },
    });

    registry.notifyRunChanged({ runId: 'run-1', transientFrame: undefined });

    expect(isS1Notified).toBe(true);
    expect(isS2Notified).toBe(false);
  });

  it('notifyRunChanged olyan runId-ra, amire senki nem iratkozott fel, nem hív semmit', () => {
    const registry = createStreamRegistry(createRandomUuidIdGenerator());
    registry.replaceSubscriptions('s1', [{ runId: 'run-1', fromEventId: 0, replayLimit: 10 }]);
    let isNotified = false;
    registry.openConnection('s1', {
      onReplaced: () => {
        // szándékosan üres
      },
      onSignal: () => {
        isNotified = true;
      },
      forceClose: () => {
        // szándékosan üres
      },
    });

    registry.notifyRunChanged({ runId: 'run-nem-figyelt', transientFrame: undefined });

    expect(isNotified).toBe(false);
  });

  it('closeAllConnections minden nyitott kapcsolatot forceClose hívással zár, majd törli a nyilvántartást', () => {
    const registry = createStreamRegistry(createRandomUuidIdGenerator());
    let closedCount = 0;
    registry.openConnection('s1', {
      onReplaced: () => {
        // szándékosan üres
      },
      onSignal: () => {
        // szándékosan üres
      },
      forceClose: () => {
        closedCount += 1;
      },
    });
    registry.openConnection('s2', {
      onReplaced: () => {
        // szándékosan üres
      },
      onSignal: () => {
        // szándékosan üres
      },
      forceClose: () => {
        closedCount += 1;
      },
    });

    registry.closeAllConnections();

    expect(closedCount).toBe(2);

    // Egy második hívás nem hív már semmit, mert a nyilvántartás kiürült.
    registry.closeAllConnections();
    expect(closedCount).toBe(2);
  });
});
