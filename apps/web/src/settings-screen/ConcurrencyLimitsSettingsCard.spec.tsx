/* eslint-disable unicorn/no-null -- a ConcurrencyLimitView beállított korlátja és javaslata a dróton ténylegesen `null` értéket hordoz (packages/protocol/src/settings/concurrency-limit-view.ts). */
import type { ConcurrencyLimitView, ProviderSummary } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestState } from '../request-state/request-state.ts';
import {
  ConcurrencyLimitsSettingsCard,
  type ConcurrencyLimitsSettingsCardProperties,
} from './ConcurrencyLimitsSettingsCard.tsx';

const PROVIDERS: readonly ProviderSummary[] = [
  { id: 'claude-subscription', displayName: 'Claude előfizetés', models: [], requiredEnvNames: [] },
  { id: 'minimax', displayName: 'MiniMax', models: [], requiredEnvNames: [] },
];

const LIMITS: readonly ConcurrencyLimitView[] = [
  {
    providerId: 'claude-subscription',
    configuredMaxConcurrentSteps: 2,
    suggestion: { suggestedLimit: null, note: 'Nincs mért javaslat.' },
  },
  {
    providerId: 'minimax',
    configuredMaxConcurrentSteps: null,
    suggestion: { suggestedLimit: 3, note: 'Alsó korlát.' },
  },
];

function success<TValue>(value: TValue): RequestState<TValue> {
  return { status: 'success', value };
}

describe('ConcurrencyLimitsSettingsCard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function render(overrides: Partial<ConcurrencyLimitsSettingsCardProperties> = {}): void {
    act(() => {
      root.render(
        <ConcurrencyLimitsSettingsCard
          providersState={success(PROVIDERS)}
          limitsState={success(LIMITS)}
          saveLimit={vi.fn()}
          clearLimit={vi.fn()}
          {...overrides}
        />,
      );
    });
  }

  it('card szekció "Párhuzamossági korlát" címmel, a hozzáférhető nevét a fejléc adja', () => {
    render();

    const section = container.querySelector('section.card');
    const heading = section?.querySelector(':scope > .card__header > h3');
    expect(heading?.textContent).toBe('Párhuzamossági korlát');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('providerenként egy sort rajzol, a szerver sorrendjében, a provider megjelenített nevével', () => {
    render();

    const titles = [...container.querySelectorAll(':scope [role="group"] .preference-row__title')].map(
      (title) => title.textContent,
    );
    expect(titles).toEqual(['Claude előfizetés', 'MiniMax']);
  });

  it('ismeretlen provider sorának nevében a providerId áll', () => {
    render({ providersState: success([]) });

    const titles = [...container.querySelectorAll(':scope [role="group"] .preference-row__title')].map(
      (title) => title.textContent,
    );
    expect(titles).toEqual(['claude-subscription', 'minimax']);
  });

  it('a provider lista betöltési hibája danger Alertben áll, sorok nélkül', () => {
    render({ providersState: { status: 'failure', message: 'A szerver nem érhető el.' } });

    expect(container.querySelector('.alert--danger')?.textContent).toContain('A szerver nem érhető el.');
    expect(container.querySelector(':scope [role="group"]')).toBeNull();
  });

  it('a korlátok betöltési hibája danger Alertben áll, sorok nélkül', () => {
    render({ limitsState: { status: 'failure', message: 'Váratlan szerver hiba történt.' } });

    expect(container.querySelector('.alert--danger')?.textContent).toContain('Váratlan szerver hiba történt.');
    expect(container.querySelector(':scope [role="group"]')).toBeNull();
  });

  it.each([
    [
      'a provider lista',
      { providersState: { status: 'pending' } } satisfies Partial<ConcurrencyLimitsSettingsCardProperties>,
    ],
    ['a korlátok', { limitsState: { status: 'idle' } } satisfies Partial<ConcurrencyLimitsSettingsCardProperties>],
  ])('amíg %s nem érkezett meg, csontváz áll a helyén, sorok nélkül', (_name, overrides) => {
    render(overrides);

    expect(container.querySelector(':scope [aria-busy="true"] .skel')).not.toBeNull();
    expect(container.querySelector(':scope [role="group"]')).toBeNull();
  });
});
