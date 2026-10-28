/* eslint-disable unicorn/no-null -- a ConnectionTestResponse `errorMessage` mezője a dróton ténylegesen `null` értéket hordoz (packages/protocol/src/provider/connection-test-response.ts). */
import type { ConnectionTestResponse } from '@easter-workflow-builder/protocol';
import { FieldErrorVisibilityContext } from '@easter-workflow-builder/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { ProviderSelect, type ProviderSelectProperties } from './ProviderSelect.tsx';
import type { ProviderConnectionTester } from './provider-connection-tester.ts';

const PROVIDERS = [
  { id: 'claude-subscription', displayName: 'Claude előfizetés' },
  { id: 'minimax', displayName: 'MiniMax' },
] as const;

function clickOn(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
}

function succeededOutcome(response: ConnectionTestResponse): RouteOutcome<ConnectionTestResponse> {
  return { kind: 'ok', value: response };
}

/**
 * Kézzel feloldható teszt hívás: a függő állapot (`isLoading`) csak így
 * figyelhető meg, a feloldás előtt.
 */
function deferredTester(): {
  readonly tester: ProviderConnectionTester;
  readonly resolve: (outcome: RouteOutcome<ConnectionTestResponse>) => Promise<void>;
  readonly calls: string[];
} {
  const calls: string[] = [];
  const pending = Promise.withResolvers<RouteOutcome<ConnectionTestResponse>>();
  const tester: ProviderConnectionTester = (providerId) => {
    calls.push(providerId);
    return pending.promise;
  };
  return {
    tester,
    calls,
    resolve: async (outcome) => {
      await act(async () => {
        pending.resolve(outcome);
        await pending.promise;
      });
    },
  };
}

describe('ProviderSelect', () => {
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

  function render(properties: Partial<ProviderSelectProperties> & Pick<ProviderSelectProperties, 'value'>): void {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value={true}>
          <ProviderSelect
            label="Provider"
            providers={PROVIDERS}
            onChange={vi.fn()}
            testConnection={vi.fn()}
            {...properties}
          />
        </FieldErrorVisibilityContext.Provider>,
      );
    });
  }

  function trigger(): HTMLButtonElement {
    const found = container.querySelector<HTMLButtonElement>(':scope button.select');
    if (found === null) {
      throw new Error('a teszt nem talált select triggert');
    }
    return found;
  }

  function testButton(): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find((candidate) =>
      candidate.textContent.includes('Kapcsolat teszt'),
    );
    if (found === undefined) {
      throw new Error('a teszt nem talált Kapcsolat teszt gombot');
    }
    return found;
  }

  function optionLabels(): string[] {
    clickOn(trigger());
    const panelId = trigger().getAttribute('aria-controls');
    const panel = [...document.body.querySelectorAll<HTMLElement>('[role="listbox"]')].find(
      (candidate) => candidate.id === panelId,
    );
    return [...(panel?.querySelectorAll(':scope [role="option"] .menu__text') ?? [])].map(
      (element) => element.textContent,
    );
  }

  it('a providereket a megjelenített nevükkel kínálja, üres opció nélkül, ha nincs emptyOptionLabel', () => {
    render({ value: 'minimax' });

    expect(optionLabels()).toEqual(['Claude előfizetés', 'MiniMax']);
  });

  it('az emptyOptionLabel feliratú üres opciót elöl kínálja', () => {
    render({ value: '', emptyOptionLabel: 'nincs felülírás (öröklés)' });

    expect(optionLabels()).toEqual(['nincs felülírás (öröklés)', 'Claude előfizetés', 'MiniMax']);
  });

  it('a választás a provider azonosítóját adja az onChange-nek', () => {
    const onChange = vi.fn();
    render({ value: 'minimax', onChange });
    clickOn(trigger());
    const option = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (candidate) => candidate.querySelector('.menu__text')?.textContent === 'Claude előfizetés',
    );
    expect(option).toBeDefined();
    if (option !== undefined) {
      clickOn(option);
    }

    expect(onChange).toHaveBeenCalledWith('claude-subscription');
  });

  it('a mező címkéjét, méretét és hibáját a SelectField kapja', () => {
    render({ value: 'minimax', size: 'sm', error: 'Ismeretlen provider' });

    expect(trigger().classList.contains('select--sm')).toBe(true);
    expect(container.querySelector('.field__label')?.textContent).toBe('Provider');
    expect(trigger().getAttribute('aria-invalid')).toBe('true');
  });

  it('örökölt (üres) választásnál a gomb tiltott, és a tiltás oka látszik, a gombhoz kötve', () => {
    render({ value: '', emptyOptionLabel: 'nincs felülírás (öröklés)' });

    const button = testButton();
    expect(button.disabled).toBe(true);
    const reason = container.querySelector('.provider-select__reason');
    expect(reason?.textContent).toBe('A kapcsolat teszthez válassz ki egy providert.');
    expect(button.getAttribute('aria-describedby')).toBe(reason?.id);
  });

  it('kiválasztott providernél a gomb engedélyezett, tiltási ok nélkül, sm méretű, nem küldő gomb', () => {
    render({ value: 'minimax' });

    const button = testButton();
    expect(button.disabled).toBe(false);
    expect(button.classList.contains('btn--sm')).toBe(true);
    expect(button.type).toBe('button');
    expect(button.hasAttribute('aria-describedby')).toBe(false);
    expect(container.querySelector('.provider-select__reason')).toBeNull();
  });

  it('a lista betöltése alatt a gomb tiltott, és a trigger a betöltés feliratot mutatja', () => {
    render({ value: 'minimax', loading: true, loadingLabel: 'Betöltés…' });

    expect(testButton().disabled).toBe(true);
    expect(trigger().textContent).toBe('Betöltés…');
  });

  it('a teszt futása alatt a gomb isLoading és tiltott, siker után success Alert jelenik meg', async () => {
    const { tester, resolve, calls } = deferredTester();
    render({ value: 'minimax', testConnection: tester });

    clickOn(testButton());

    expect(calls).toEqual(['minimax']);
    expect(testButton().classList.contains('is-loading')).toBe(true);
    expect(testButton().disabled).toBe(true);
    expect(container.querySelector('.alert')).toBeNull();

    await resolve(succeededOutcome({ succeeded: true, errorMessage: null }));

    expect(testButton().classList.contains('is-loading')).toBe(false);
    expect(testButton().disabled).toBe(false);
    const alert = container.querySelector('.alert');
    expect(alert?.classList.contains('alert--success')).toBe(true);
    expect(alert?.textContent).toContain('A kapcsolat teszt sikeres.');
  });

  it('a sikertelen teszt danger Alertben a motor szövegével jelenik meg', async () => {
    const { tester, resolve } = deferredTester();
    render({ value: 'minimax', testConnection: tester });
    clickOn(testButton());

    await resolve(succeededOutcome({ succeeded: false, errorMessage: 'Hiányzik az ANTHROPIC_AUTH_TOKEN' }));

    const alert = container.querySelector('.alert');
    expect(alert?.classList.contains('alert--danger')).toBe(true);
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.querySelector('.alert__title')?.textContent).toBe('A kapcsolat teszt sikertelen');
    expect(alert?.querySelector('.alert__message')?.textContent).toBe('Hiányzik az ANTHROPIC_AUTH_TOKEN');
  });

  it('a szöveg nélküli sikertelen teszt csak a címet mutatja', async () => {
    const { tester, resolve } = deferredTester();
    render({ value: 'minimax', testConnection: tester });
    clickOn(testButton());

    await resolve(succeededOutcome({ succeeded: false, errorMessage: null }));

    expect(container.querySelector('.alert__title')?.textContent).toBe('A kapcsolat teszt sikertelen');
    expect(container.querySelector('.alert__message')).toBeNull();
  });

  it('a hívás hibája danger Alertben a REST réteg magyar mondatával jelenik meg', async () => {
    const { tester, resolve } = deferredTester();
    render({ value: 'minimax', testConnection: tester });
    clickOn(testButton());

    await resolve({ kind: 'error', message: 'A szerver nem érhető el.', isTransient: true });

    const alert = container.querySelector('.alert');
    expect(alert?.classList.contains('alert--danger')).toBe(true);
    expect(alert?.textContent).toContain('A szerver nem érhető el.');
  });

  it('az eredmény csak a tesztelt providerhez tartozik: a választás váltása elrejti, a visszaváltás előhozza', async () => {
    const { tester, resolve } = deferredTester();
    render({ value: 'minimax', testConnection: tester });
    clickOn(testButton());
    await resolve(succeededOutcome({ succeeded: true, errorMessage: null }));
    expect(container.querySelector('.alert')).not.toBeNull();

    render({ value: 'claude-subscription', testConnection: tester });
    expect(container.querySelector('.alert')).toBeNull();
    expect(testButton().classList.contains('is-loading')).toBe(false);

    render({ value: 'minimax', testConnection: tester });
    expect(container.querySelector('.alert')).not.toBeNull();
  });

  it('a futó teszt alatt a választás váltása után a gomb tiltott marad, de nem mutat várakozást a másik providernél', () => {
    const { tester } = deferredTester();
    render({ value: 'minimax', testConnection: tester });
    clickOn(testButton());

    render({ value: 'claude-subscription', testConnection: tester });

    expect(testButton().disabled).toBe(true);
    expect(testButton().classList.contains('is-loading')).toBe(false);
  });
});
