/* eslint-disable unicorn/no-null -- a ConcurrencyLimitView beállított korlátja és javaslata a dróton ténylegesen `null` értéket hordoz (packages/protocol/src/settings/concurrency-limit-view.ts). */
import type { ConcurrencyLimitView } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { ConcurrencyLimitRow, type ConcurrencyLimitRowProperties } from './ConcurrencyLimitRow.tsx';

const UNCONFIGURED: ConcurrencyLimitView = {
  providerId: 'minimax',
  configuredMaxConcurrentSteps: null,
  suggestion: { suggestedLimit: 3, note: 'A javasolt érték alsó korlát.' },
};
const CONFIGURED: ConcurrencyLimitView = {
  providerId: 'claude-subscription',
  configuredMaxConcurrentSteps: 2,
  suggestion: { suggestedLimit: null, note: 'Nincs mért javaslat.' },
};

const SERVER_ERROR = { kind: 'error', message: 'Váratlan szerver hiba történt.', isTransient: false } as const;

function typeInto(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  act(() => {
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function clickAsync(target: HTMLElement): Promise<void> {
  await act(async () => {
    target.click();
    await Promise.resolve();
  });
}

describe('ConcurrencyLimitRow', () => {
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

  function render(overrides: Partial<ConcurrencyLimitRowProperties> = {}): void {
    act(() => {
      root.render(
        <ConcurrencyLimitRow
          limit={UNCONFIGURED}
          providerName="MiniMax"
          saveLimit={vi.fn()}
          clearLimit={vi.fn()}
          {...overrides}
        />,
      );
    });
  }

  function field(): HTMLInputElement {
    const found = container.querySelector('input');
    if (found === null) {
      throw new Error('a teszt nem találta a szám mezőt');
    }
    return found;
  }

  function button(label: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === label);
    if (found === undefined) {
      throw new Error(`a teszt nem találta a "${label}" gombot`);
    }
    return found;
  }

  it('a sor csoportja a provider nevét viseli, a szöveg a beállítatlan korlátot és a javaslatot a megjegyzésével mutatja', () => {
    render();

    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute('aria-labelledby')).toBe(container.querySelector('.preference-row__title')?.id);
    expect(container.querySelector('.preference-row__title')?.textContent).toBe('MiniMax');
    const hints = [...container.querySelectorAll('.settings-screen__hint')].map((hint) => hint.textContent);
    expect(hints).toEqual([
      'Nincs beállított párhuzamossági korlát.',
      'Javaslat: 3 egyszerre futó agent lépés. A javasolt érték alsó korlát.',
    ]);
  });

  it('beállított korlátnál a szövegben látszik az érték, javaslat híján a megjegyzés áll, a mező ettől még üres (alapérték nincs)', () => {
    render({ limit: CONFIGURED, providerName: 'Claude előfizetés' });

    const hints = [...container.querySelectorAll('.settings-screen__hint')].map((hint) => hint.textContent);
    expect(hints).toEqual(['Beállított korlát: 2 egyszerre futó agent lépés.', 'Nincs javaslat. Nincs mért javaslat.']);
    expect(field().value).toBe('');
  });

  it('a szám mező sm méretű, szám típusú, hozzáférhető neve a provider neve', () => {
    render();

    expect(field().type).toBe('number');
    expect(field().classList.contains('input--sm')).toBe(true);
    expect(field().getAttribute('aria-label')).toBe('Egyszerre futó agent lépések száma: MiniMax');
    expect(button('Mentés').classList.contains('btn--sm')).toBe(true);
    expect(button('Korlát törlése').classList.contains('btn--sm')).toBe(true);
  });

  it('a Korlát törlése gomb beállítatlan korlátnál tiltott, beállítottnál él', () => {
    render();
    expect(button('Korlát törlése').disabled).toBe(true);

    render({ limit: CONFIGURED });
    expect(button('Korlát törlése').disabled).toBe(false);
  });

  it('üres mezővel a Mentés a mező alatt hibát ad, és a mentés hívása elmarad', async () => {
    const saveLimit = vi.fn();
    render({ saveLimit });

    await clickAsync(button('Mentés'));

    expect(saveLimit).not.toHaveBeenCalled();
    const error = container.querySelector('.field__error');
    expect(error?.textContent).toBe('Pozitív egész számot adj meg.');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(field().getAttribute('aria-invalid')).toBe('true');
  });

  it.each(['0', '1.5', '-2'])('a nem pozitív egész "%s" értékre a Mentés hibát ad, hívás nélkül', async (value) => {
    const saveLimit = vi.fn();
    render({ saveLimit });
    typeInto(field(), value);

    await clickAsync(button('Mentés'));

    expect(saveLimit).not.toHaveBeenCalled();
    expect(container.querySelector('.field__error')?.textContent).toBe('Pozitív egész számot adj meg.');
  });

  it('érintetlen mezőn gépelés közben nincs hibaüzenet, elhagyás után az érvénytelen értéknél van', () => {
    render();
    typeInto(field(), '0');
    expect(container.querySelector('.field__error')).toBeNull();

    act(() => {
      field().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    expect(container.querySelector('.field__error')).not.toBeNull();
  });

  it('érvényes értékre a providerId-vel és a számmal hívja a mentést; futás alatt a gomb isLoading, mindkét gomb tiltott; siker után a mező üres és hibátlan', async () => {
    const pending = Promise.withResolvers<RouteOutcome<ConcurrencyLimitView>>();
    const saveLimit = vi.fn(() => pending.promise);
    render({ saveLimit, limit: CONFIGURED });
    typeInto(field(), '4');
    act(() => {
      field().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    await clickAsync(button('Mentés'));

    expect(saveLimit).toHaveBeenCalledWith('claude-subscription', 4);
    expect(button('Mentés').classList.contains('is-loading')).toBe(true);
    expect(button('Mentés').disabled).toBe(true);
    expect(button('Korlát törlése').disabled).toBe(true);

    await act(async () => {
      pending.resolve({ kind: 'ok', value: { ...CONFIGURED, configuredMaxConcurrentSteps: 4 } });
      await pending.promise;
    });

    expect(field().value).toBe('');
    expect(container.querySelector('.field__error')).toBeNull();
    expect(button('Mentés').classList.contains('is-loading')).toBe(false);
  });

  it('a mentés hibája danger Alertben jelenik meg, a beírt érték megmarad', async () => {
    render({ saveLimit: vi.fn(() => Promise.resolve(SERVER_ERROR)) });
    typeInto(field(), '4');

    await clickAsync(button('Mentés'));

    expect(container.querySelector('.alert--danger')?.textContent).toContain('Váratlan szerver hiba történt.');
    expect(field().value).toBe('4');
  });

  it('a Korlát törlése a providerId-vel hívja a törlést, futás alatt isLoading; a hibája danger Alert, az új művelet elrejti a másik hibáját', async () => {
    const pending = Promise.withResolvers<RouteOutcome<undefined>>();
    const clearLimit = vi.fn(() => pending.promise);
    render({ limit: CONFIGURED, clearLimit });

    await clickAsync(button('Korlát törlése'));

    expect(clearLimit).toHaveBeenCalledWith('claude-subscription');
    expect(button('Korlát törlése').classList.contains('is-loading')).toBe(true);
    expect(button('Mentés').disabled).toBe(true);

    await act(async () => {
      pending.resolve(SERVER_ERROR);
      await pending.promise;
    });
    expect(container.querySelector('.alert--danger')?.textContent).toContain('Váratlan szerver hiba történt.');

    typeInto(field(), '3');
    const saveLimit = vi.fn(() => Promise.withResolvers<RouteOutcome<ConcurrencyLimitView>>().promise);
    render({ limit: CONFIGURED, clearLimit, saveLimit });
    await clickAsync(button('Mentés'));
    expect(container.querySelector('.alert--danger')).toBeNull();
  });

  it('a mentés hibája után a törlés elrejti a mentés hibáját', async () => {
    const clearLimit = vi.fn(() => Promise.withResolvers<RouteOutcome<undefined>>().promise);
    render({ limit: CONFIGURED, clearLimit, saveLimit: vi.fn(() => Promise.resolve(SERVER_ERROR)) });
    typeInto(field(), '3');
    await clickAsync(button('Mentés'));
    expect(container.querySelector('.alert--danger')).not.toBeNull();

    await clickAsync(button('Korlát törlése'));

    expect(container.querySelector('.alert--danger')).toBeNull();
  });
});
