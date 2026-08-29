import { describe, expect, it } from 'vitest';
import type { Engine } from '@easter-workflow-builder/engine';
import { toConcurrencyLimitView } from './to-concurrency-limit-view.ts';

function unused<TValue>(): Promise<TValue> {
  return Promise.reject(new Error('nem várt hívás'));
}

function buildFakeEngine(overrides: Partial<Engine>): Engine {
  return {
    startRun: () => unused(),
    interruptRun: () => unused(),
    decideApproval: () => unused(),
    restartRun: () => unused(),
    suggestedConcurrencyLimit: () => {
      throw new Error('nem várt hívás');
    },
    testProviderConnection: () => unused(),
    shutdown: () => unused(),
    ...overrides,
  };
}

describe('toConcurrencyLimitView', () => {
  it('a beállított korlátot és a motor javaslatát együtt adja vissza', () => {
    const engine = buildFakeEngine({
      suggestedConcurrencyLimit: (providerId) => {
        expect(providerId).toBe('minimax');
        return { suggestedLimit: 4, note: 'mérésből' };
      },
    });

    const view = toConcurrencyLimitView('minimax', 3, engine);

    expect(view).toStrictEqual({
      providerId: 'minimax',
      configuredMaxConcurrentSteps: 3,
      suggestion: { suggestedLimit: 4, note: 'mérésből' },
    });
  });

  it('hiányzó configuredMaxConcurrentSteps és hiányzó suggestedLimit esetén null-t ad', () => {
    const engine = buildFakeEngine({
      suggestedConcurrencyLimit: () => ({ suggestedLimit: undefined, note: 'nincs mérés' }),
    });

    // eslint-disable-next-line unicorn/no-null -- a toConcurrencyLimitView bemenete valódi number | null
    const view = toConcurrencyLimitView('claude-subscription', null, engine);

    expect(view.configuredMaxConcurrentSteps).toBeNull();
    expect(view.suggestion.suggestedLimit).toBeNull();
  });
});
