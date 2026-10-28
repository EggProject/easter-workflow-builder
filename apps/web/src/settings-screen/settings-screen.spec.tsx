/* eslint-disable unicorn/no-null -- a SettingsRecord `defaultProviderId` mezője a dróton ténylegesen `null` értéket hordoz (packages/protocol/src/settings/settings-record.ts). */
import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  UpdateSettingsRequestSchema,
  type ConcurrencyLimitView,
  type SettingsRecord,
} from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SettingsScreen } from './settings-screen.tsx';

const API_ORIGIN = 'https://api.example.test';

const PROVIDERS = [
  { id: 'claude-subscription', displayName: 'Claude előfizetés', models: [], requiredEnvNames: [] },
  { id: 'minimax', displayName: 'MiniMax', models: [], requiredEnvNames: [['ANTHROPIC_AUTH_TOKEN']] },
];

const CLAUDE_LIMIT: ConcurrencyLimitView = {
  providerId: 'claude-subscription',
  configuredMaxConcurrentSteps: null,
  suggestion: { suggestedLimit: null, note: 'Nincs mért javaslat.' },
};

const LIMITS: readonly ConcurrencyLimitView[] = [
  CLAUDE_LIMIT,
  { providerId: 'minimax', configuredMaxConcurrentSteps: 2, suggestion: { suggestedLimit: 3, note: 'Alsó korlát.' } },
];

function clickOn(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
}

/**
 * Állapottartó szerver mock: a `PUT` a kapott részleges törzset olvassa a
 * rekordra, és a teljes rekordot adja vissza (SPEC-005 4.2 E).
 */
function createFetchFunction(initial: SettingsRecord): { readonly fetchFunction: FetchFunction; requests: string[] } {
  let record = initial;
  const requests: string[] = [];
  const fetchFunction: FetchFunction = (input, init) => {
    const method = init.method ?? 'GET';
    requests.push(`${method} ${new URL(input).pathname}`);
    if (input.endsWith('/api/providers')) {
      return Promise.resolve(Response.json(PROVIDERS));
    }
    if (input.endsWith('/api/settings/concurrency-limits')) {
      return Promise.resolve(Response.json(LIMITS));
    }
    if (method === 'PUT' && typeof init.body === 'string') {
      const body: unknown = JSON.parse(init.body);
      const parsed = UpdateSettingsRequestSchema.safeParse(body);
      if (parsed.success) {
        record = {
          defaultProviderId: parsed.data.defaultProviderId ?? record.defaultProviderId,
          persistStreamDeltas: parsed.data.persistStreamDeltas ?? record.persistStreamDeltas,
        };
      }
    }
    return Promise.resolve(Response.json(record));
  };
  return { fetchFunction, requests };
}

describe('SettingsScreen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    globalThis.localStorage.clear();
  });

  async function render(fetchFunction: FetchFunction): Promise<void> {
    await act(async () => {
      root.render(<SettingsScreen apiOrigin={API_ORIGIN} fetchFunction={fetchFunction} />);
      await Promise.resolve();
    });
  }

  function headings(): string[] {
    return [...container.querySelectorAll(':scope section.card > .card__header > h3')].map(
      (heading) => heading.textContent,
    );
  }

  it('a kártyákat egymás alatt, a SPEC-009 3.1 sorrendjében rajzolja (Provider, Párhuzamossági korlát, Futás napló, majd a gráf szerkesztő)', async () => {
    await render(createFetchFunction({ defaultProviderId: null, persistStreamDeltas: false }).fetchFunction);

    expect(headings()).toEqual(['Provider', 'Párhuzamossági korlát', 'Futás napló', 'Gráf szerkesztő']);
    expect(container.querySelector('.settings-screen')?.children).toHaveLength(4);
  });

  it('a provider listát, a beállítást és a korlátokat egyszer tölti be, kártyánként ismételt kérés nélkül', async () => {
    const { fetchFunction, requests } = createFetchFunction({ defaultProviderId: null, persistStreamDeltas: false });
    await render(fetchFunction);

    expect(requests.toSorted((left, right) => left.localeCompare(right))).toEqual([
      'GET /api/providers',
      'GET /api/settings',
      'GET /api/settings/concurrency-limits',
    ]);
  });

  it('a provider választása PUT /api/settings hívással mentődik, és a válasz után a képernyő az új értéket mutatja', async () => {
    const { fetchFunction, requests } = createFetchFunction({ defaultProviderId: null, persistStreamDeltas: false });
    await render(fetchFunction);
    expect(container.querySelector('.alert--warning')).not.toBeNull();

    const trigger = container.querySelector<HTMLButtonElement>(':scope .settings-screen button.select');
    if (trigger === null) {
      throw new Error('a teszt nem találta a Provider választót');
    }
    clickOn(trigger);
    const option = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (candidate) => candidate.querySelector('.menu__text')?.textContent === 'MiniMax',
    );
    await act(async () => {
      option?.click();
      await Promise.resolve();
    });

    expect(requests).toContain('PUT /api/settings');
    expect(trigger.textContent).toBe('MiniMax');
    expect(container.querySelector('.alert--warning')).toBeNull();
  });

  it('a korlát mentése a sor providerére küld PUT hívást, és a válasz után a sor az új értéket mutatja', async () => {
    const { fetchFunction, requests } = createFetchFunction({ defaultProviderId: null, persistStreamDeltas: false });
    const limitFetchFunction: FetchFunction = (input, init) => {
      if (init.method === 'PUT' && input.endsWith('/api/settings/concurrency-limits/claude-subscription')) {
        requests.push('PUT limit');
        return Promise.resolve(
          Response.json({ ...CLAUDE_LIMIT, configuredMaxConcurrentSteps: 5 } satisfies ConcurrencyLimitView),
        );
      }
      return fetchFunction(input, init);
    };
    await render(limitFetchFunction);

    const claudeRow = [...container.querySelectorAll('[role="group"]')].find(
      (group) => group.querySelector('.preference-row__title')?.textContent === 'Claude előfizetés',
    );
    const input = claudeRow?.querySelector('input');
    const saveButton = [...(claudeRow?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent === 'Mentés',
    );
    if (input === null || input === undefined || saveButton === undefined) {
      throw new Error('a teszt nem találta a Claude sor mezőjét és Mentés gombját');
    }
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    act(() => {
      descriptor?.set?.call(input, '5');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
    });

    expect(requests).toContain('PUT limit');
    expect(claudeRow?.textContent).toContain('Beállított korlát: 5 egyszerre futó agent lépés.');
  });

  it('a delta kapcsoló váltása PUT /api/settings hívást küld a persistStreamDeltas mezővel, és a válasz után a kapcsoló az új értéket mutatja', async () => {
    const { fetchFunction, requests } = createFetchFunction({ defaultProviderId: null, persistStreamDeltas: false });
    await render(fetchFunction);
    const toggle = container.querySelector<HTMLInputElement>('input[role="switch"]');
    expect(toggle?.checked).toBe(false);

    await act(async () => {
      toggle?.click();
      await Promise.resolve();
    });

    expect(requests).toContain('PUT /api/settings');
    expect(container.querySelector<HTMLInputElement>('input[role="switch"]')?.checked).toBe(true);
  });
});
