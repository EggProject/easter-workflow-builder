/* eslint-disable unicorn/no-null -- az EngineEvent.stepRunId mezője valódi string | null, futás szintű eseményre null */
import { describe, expect, it } from 'vitest';
import { createRandomUuidIdGenerator } from './create-random-uuid-id-generator.ts';
import { createSystemClock } from './create-system-clock.ts';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { createRealEventPublisher } from './create-real-event-publisher.ts';

describe('createRealEventPublisher', () => {
  it('EngineEvent alakú publish hívásra jelzi a stream-registry-t', () => {
    const registry = createStreamRegistry(createRandomUuidIdGenerator());
    let notified: string | undefined;
    registry.replaceSubscriptions('s1', [{ runId: 'run-1', fromEventId: 0, replayLimit: 10 }]);
    registry.openConnection('s1', {
      onReplaced: () => {
        // szándékosan üres
      },
      onSignal: (signal) => {
        notified = signal.runId;
      },
      forceClose: () => {
        // szándékosan üres
      },
    });

    const publisher = createRealEventPublisher(registry, createSystemClock());
    publisher.publish({ kind: 'run_started', runId: 'run-1', stepRunId: null, payload: {} });

    expect(notified).toBe('run-1');
  });

  it('nem osztályozható értékre nem hív jelzést', () => {
    const registry = createStreamRegistry(createRandomUuidIdGenerator());
    let notifyCount = 0;
    registry.replaceSubscriptions('s1', [{ runId: 'run-1', fromEventId: 0, replayLimit: 10 }]);
    registry.openConnection('s1', {
      onReplaced: () => {
        // szándékosan üres
      },
      onSignal: () => {
        notifyCount += 1;
      },
      forceClose: () => {
        // szándékosan üres
      },
    });

    const publisher = createRealEventPublisher(registry, createSystemClock());
    publisher.publish('nem osztályozható érték');

    expect(notifyCount).toBe(0);
  });
});
