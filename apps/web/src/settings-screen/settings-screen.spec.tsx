/* eslint-disable unicorn/no-null -- a SettingsRecord `defaultProviderId` mezője a dróton ténylegesen `null` értéket hordoz (packages/protocol/src/settings/settings-record.ts). */
import type { FetchFunction } from '@easter-workflow-builder/core';
import { UpdateSettingsRequestSchema, type SettingsRecord } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SettingsScreen } from './settings-screen.tsx';

const API_ORIGIN = 'https://api.example.test';

const PROVIDERS = [
  { id: 'claude-subscription', displayName: 'Claude előfizetés', models: [], requiredEnvNames: [] },
  { id: 'minimax', displayName: 'MiniMax', models: [], requiredEnvNames: [['ANTHROPIC_AUTH_TOKEN']] },
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

  it('a kártyákat egymás alatt, a SPEC-009 3.1 sorrendjében rajzolja (Provider, majd a szerkesztő)', async () => {
    await render(createFetchFunction({ defaultProviderId: null, persistStreamDeltas: false }).fetchFunction);

    expect(headings()).toEqual(['Provider', 'Szerkesztő']);
    expect(container.querySelector('.settings-screen')?.children).toHaveLength(2);
  });

  it('a provider listát és a beállítást egyszer tölti be, kártyánként ismételt kérés nélkül', async () => {
    const { fetchFunction, requests } = createFetchFunction({ defaultProviderId: null, persistStreamDeltas: false });
    await render(fetchFunction);

    expect(requests.toSorted((left, right) => left.localeCompare(right))).toEqual([
      'GET /api/providers',
      'GET /api/settings',
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
});
