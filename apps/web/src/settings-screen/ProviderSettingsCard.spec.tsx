/* eslint-disable unicorn/no-null -- a SettingsRecord `defaultProviderId` mezője a dróton ténylegesen `null` értéket hordoz (packages/protocol/src/settings/settings-record.ts). */
import type { ProviderSummary, SettingsRecord } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestState } from '../request-state/request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { ProviderSettingsCard, type ProviderSettingsCardProperties } from './ProviderSettingsCard.tsx';

const PROVIDERS: readonly ProviderSummary[] = [
  { id: 'claude-subscription', displayName: 'Claude előfizetés', models: [], requiredEnvNames: [] },
  {
    id: 'minimax',
    displayName: 'MiniMax',
    models: [],
    requiredEnvNames: [['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'], ['ANTHROPIC_BASE_URL']],
  },
];

const NO_DEFAULT: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };
const MINIMAX_DEFAULT: SettingsRecord = { defaultProviderId: 'minimax', persistStreamDeltas: false };

const ROW_LABEL = 'Globális alapértelmezett provider';

function clickOn(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
}

function success<TValue>(value: TValue): RequestState<TValue> {
  return { status: 'success', value };
}

describe('ProviderSettingsCard', () => {
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

  function render(overrides: Partial<ProviderSettingsCardProperties> = {}): void {
    act(() => {
      root.render(
        <ProviderSettingsCard
          providersState={success(PROVIDERS)}
          settingsState={success(NO_DEFAULT)}
          saveSettings={vi.fn()}
          testConnection={vi.fn()}
          {...overrides}
        />,
      );
    });
  }

  function trigger(): HTMLButtonElement {
    const label = [...container.querySelectorAll('label')].find((candidate) => candidate.textContent === ROW_LABEL);
    const found = [...container.querySelectorAll('button')].find((candidate) => candidate.id === label?.htmlFor);
    if (found === undefined) {
      throw new Error('a teszt nem találta a választó triggerét');
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

  function chooseOption(optionLabel: string): void {
    clickOn(trigger());
    const option = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (candidate) => candidate.querySelector('.menu__text')?.textContent === optionLabel,
    );
    if (option === undefined) {
      throw new Error(`a teszt nem talált "${optionLabel}" opciót`);
    }
    clickOn(option);
  }

  it('card szekció "Provider" címmel, a hozzáférhető nevét a fejléc adja', () => {
    render();

    const section = container.querySelector('section.card');
    const heading = section?.querySelector(':scope > .card__header > h3');
    expect(heading?.textContent).toBe('Provider');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('a provider lista betöltési hibája danger Alertben áll, választó nélkül', () => {
    render({ providersState: { status: 'failure', message: 'A szerver nem érhető el.' } });

    expect(container.querySelector('.alert--danger')?.textContent).toContain('A szerver nem érhető el.');
    expect(container.querySelector('button.select')).toBeNull();
  });

  it('a beállítás betöltési hibája danger Alertben áll, választó nélkül', () => {
    render({ settingsState: { status: 'failure', message: 'Váratlan szerver hiba történt.' } });

    expect(container.querySelector('.alert--danger')?.textContent).toContain('Váratlan szerver hiba történt.');
    expect(container.querySelector('button.select')).toBeNull();
  });

  it.each([
    ['a provider lista', { providersState: { status: 'pending' } } satisfies Partial<ProviderSettingsCardProperties>],
    ['a beállítás', { settingsState: { status: 'idle' } } satisfies Partial<ProviderSettingsCardProperties>],
  ])('amíg %s nem érkezett meg, csontváz áll a helyén, választó nélkül', (_name, overrides) => {
    render(overrides);

    expect(container.querySelector(':scope [aria-busy="true"] .skel')).not.toBeNull();
    expect(container.querySelector('button.select')).toBeNull();
  });

  it('alapértelmezés nélkül warning Alert mondja ki, hogy az agent lépés nem indul, és a választó a helyőrzőt mutatja', () => {
    render();

    const alert = container.querySelector('.alert--warning');
    expect(alert?.textContent).toContain('Nincs alapértelmezett provider');
    expect(alert?.textContent).toContain('nem indul el');
    expect(trigger().textContent).toBe('Válassz providert');
    expect(container.textContent).not.toContain('Szükséges környezeti változók');
  });

  it('a választóban nincs "nincs" opció, csak a providerek', () => {
    render();

    expect(optionLabels()).toEqual(['Claude előfizetés', 'MiniMax']);
  });

  it('beállított alapértelmezésnél nincs figyelmeztetés, a választó a provider nevét és a kötelező env változók NEVÉT mutatja', () => {
    render({ settingsState: success(MINIMAX_DEFAULT) });

    expect(container.querySelector('.alert--warning')).toBeNull();
    expect(trigger().textContent).toBe('MiniMax');
    expect(trigger().classList.contains('select--sm')).toBe(true);
    expect(container.querySelector('.settings-screen__hint')?.textContent).toBe(
      'Szükséges környezeti változók: ANTHROPIC_AUTH_TOKEN vagy ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL',
    );
  });

  it('a Kapcsolat teszt gomb a választó része: alapértelmezés nélkül tiltott, beállítottnál a providert hívja', async () => {
    const testConnection = vi.fn(() =>
      Promise.resolve({ kind: 'ok', value: { succeeded: true, errorMessage: null } } as const),
    );
    render({ testConnection });
    const findTestButton = (): HTMLButtonElement | undefined =>
      [...container.querySelectorAll('button')].find((candidate) => candidate.textContent.includes('Kapcsolat teszt'));
    expect(findTestButton()?.disabled).toBe(true);

    render({ testConnection, settingsState: success(MINIMAX_DEFAULT) });
    await act(async () => {
      findTestButton()?.click();
      await Promise.resolve();
    });

    expect(testConnection).toHaveBeenCalledWith('minimax');
    expect(container.querySelector('.alert--success')).not.toBeNull();
  });

  it('a választás PUT-ra szánt részleges törzzsel hívja a mentést, és a mentés alatt a választó betöltés feliratot mutat', async () => {
    const pending = Promise.withResolvers<RouteOutcome<SettingsRecord>>();
    const saveSettings = vi.fn(() => pending.promise);
    render({ saveSettings });

    chooseOption('MiniMax');

    expect(saveSettings).toHaveBeenCalledWith({ defaultProviderId: 'minimax' });
    expect(trigger().textContent).toBe('Mentés…');
    expect(trigger().disabled).toBe(true);

    await act(async () => {
      pending.resolve({ kind: 'ok', value: MINIMAX_DEFAULT });
      await pending.promise;
    });

    expect(trigger().textContent).not.toBe('Mentés…');
    expect(container.querySelector('.alert--danger')).toBeNull();
  });

  it('a mentés hibája danger Alertben jelenik meg, a megjelenített érték nem változik', async () => {
    const saveSettings = vi.fn(() =>
      Promise.resolve({ kind: 'error', message: 'Váratlan szerver hiba történt.', isTransient: false } as const),
    );
    render({ saveSettings });

    await act(async () => {
      chooseOption('MiniMax');
      await Promise.resolve();
    });

    expect(container.querySelector('.alert--danger')?.textContent).toContain('Váratlan szerver hiba történt.');
    expect(trigger().textContent).toBe('Válassz providert');
  });
});
