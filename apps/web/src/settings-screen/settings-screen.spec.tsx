/* eslint-disable unicorn/no-null -- a SettingsRecord `defaultProviderId` mezője a dróton ténylegesen `null` értéket hordoz (packages/protocol/src/settings/settings-record.ts). */
import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  UpdateSettingsRequestSchema,
  type ConcurrencyLimitView,
  type SettingsRecord,
  type SkillSummary,
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
    if (input.endsWith('/api/skills')) {
      return Promise.resolve(Response.json([]));
    }
    if (input.endsWith('/api/mcp-servers')) {
      return Promise.resolve(Response.json([]));
    }
    if (input.endsWith('/api/server-environment-names')) {
      return Promise.resolve(Response.json([]));
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

  it('a kártyákat egymás alatt, a SPEC-009 3.1 sorrendjében rajzolja (Provider, Párhuzamossági korlát, Futás napló, Skill könyvtár, MCP szerverek, majd a gráf szerkesztő)', async () => {
    await render(createFetchFunction({ defaultProviderId: null, persistStreamDeltas: false }).fetchFunction);

    expect(headings()).toEqual([
      'Provider',
      'Párhuzamossági korlát',
      'Futás napló',
      'Skill könyvtár',
      'MCP szerverek',
      'Gráf szerkesztő',
    ]);
    expect(container.querySelector('.settings-screen')?.children).toHaveLength(6);
  });

  it('mind a hat kártya a képernyő közvetlen card gyereke, és egyik kártyában sincs második card (kártya a kártyában nélkül, AC1)', async () => {
    await render(createFetchFunction({ defaultProviderId: null, persistStreamDeltas: false }).fetchFunction);

    const children = [...(container.querySelector('.settings-screen')?.children ?? [])];
    expect(children.map((child) => child.classList.contains('card'))).toEqual([true, true, true, true, true, true]);
    expect(container.querySelectorAll(':scope .card .card')).toHaveLength(0);
  });

  it('a provider listát, a beállítást, a korlátokat, a skill listát, az MCP szerver listát és a szerver környezet neveit egyszer tölti be, kártyánként ismételt kérés nélkül', async () => {
    const { fetchFunction, requests } = createFetchFunction({ defaultProviderId: null, persistStreamDeltas: false });
    await render(fetchFunction);

    expect(requests.toSorted((left, right) => left.localeCompare(right))).toEqual([
      'GET /api/mcp-servers',
      'GET /api/providers',
      'GET /api/server-environment-names',
      'GET /api/settings',
      'GET /api/settings/concurrency-limits',
      'GET /api/skills',
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

  it('a skill feltöltése PUT /api/skills/:name hívással, nyers ZIP törzzsel megy, és a lista a válasz után a feltöltött skillt mutatja', async () => {
    const uploaded: SkillSummary = { name: 'riport', description: 'Riport.', sizeBytes: 4, modifiedAtMs: 1 };
    let skills: readonly SkillSummary[] = [];
    let putBody: unknown;
    let putContentType: string | undefined;
    const base = createFetchFunction({ defaultProviderId: null, persistStreamDeltas: false }).fetchFunction;
    const fetchFunction: FetchFunction = (input, init) => {
      if (input.endsWith('/api/skills')) {
        return Promise.resolve(Response.json(skills));
      }
      if (init.method === 'PUT' && input.endsWith('/api/skills/riport')) {
        putBody = init.body;
        putContentType = new Headers(init.headers).get('Content-Type') ?? undefined;
        skills = [uploaded];
        return Promise.resolve(Response.json(uploaded));
      }
      return base(input, init);
    };
    await render(fetchFunction);
    const archive = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'riport.zip', { type: 'application/zip' });
    const nameField = container.querySelector<HTMLInputElement>(':scope .skill-upload-form input.input');
    const fileInput = container.querySelector<HTMLInputElement>(':scope .skill-upload-form input[type="file"]');
    const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    act(() => {
      valueDescriptor?.set?.call(nameField, 'riport');
      nameField?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [archive] });
      fileInput?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>(':scope .skill-upload-form button[type="submit"]')?.click();
      await Promise.resolve();
    });

    expect(putBody).toBe(archive);
    expect(putContentType).toBe('application/zip');
    expect([...container.querySelectorAll('.preference-row__title')].map((title) => title.textContent)).toContain(
      'riport',
    );
  });
});
