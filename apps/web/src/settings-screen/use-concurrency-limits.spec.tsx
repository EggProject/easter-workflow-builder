/* eslint-disable unicorn/no-null -- a ConcurrencyLimitView beállított korlátja és javaslata a dróton ténylegesen `null` értéket hordoz (packages/protocol/src/settings/concurrency-limit-view.ts). */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { ConcurrencyLimitView } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useConcurrencyLimits, type UseConcurrencyLimitsResult } from './use-concurrency-limits.ts';

const API_ORIGIN = 'https://api.example.test';

const CLAUDE: ConcurrencyLimitView = {
  providerId: 'claude-subscription',
  configuredMaxConcurrentSteps: 2,
  suggestion: { suggestedLimit: null, note: 'Nincs mért javaslat.' },
};
const MINIMAX: ConcurrencyLimitView = {
  providerId: 'minimax',
  configuredMaxConcurrentSteps: null,
  suggestion: { suggestedLimit: 3, note: 'Alsó korlát.' },
};

function bodyText(body: unknown): string {
  return typeof body === 'string' ? body : 'nincs törzs';
}

describe('useConcurrencyLimits', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseConcurrencyLimitsResult | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    latest = undefined;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function Probe(properties: { readonly fetchFunction: FetchFunction }): null {
    latest = useConcurrencyLimits(API_ORIGIN, properties.fetchFunction);
    return null;
  }

  async function mount(fetchFunction: FetchFunction): Promise<void> {
    await act(async () => {
      root.render(<Probe fetchFunction={fetchFunction} />);
      await Promise.resolve();
    });
  }

  function current(): UseConcurrencyLimitsResult {
    if (latest === undefined) {
      throw new Error('a teszt nem renderelte a hookot');
    }
    return latest;
  }

  it('betöltéskor a GET /api/settings/concurrency-limits listáját adja success állapotban', async () => {
    const requests: string[] = [];
    await mount((input, init) => {
      requests.push(`${init.method ?? ''} ${input}`);
      return Promise.resolve(Response.json([CLAUDE, MINIMAX]));
    });

    expect(requests).toEqual([`GET ${API_ORIGIN}/api/settings/concurrency-limits`]);
    expect(current().state).toEqual({ status: 'success', value: [CLAUDE, MINIMAX] });
  });

  it('a betöltés hibáját failure állapotban adja', async () => {
    await mount(() => Promise.reject(new Error('nincs hálózat')));

    expect(current().state.status).toBe('failure');
  });

  it('a mentés PUT hívást küld a providerId útvonallal és a pozitív egész törzzsel, és csak az azonos provider sora cserélődik', async () => {
    const saved: ConcurrencyLimitView = { ...MINIMAX, configuredMaxConcurrentSteps: 4 };
    const calls: string[] = [];
    await mount((input, init) => {
      if (init.method === 'PUT') {
        calls.push(`PUT ${input} ${bodyText(init.body)}`);
        return Promise.resolve(Response.json(saved));
      }
      return Promise.resolve(Response.json([CLAUDE, MINIMAX]));
    });

    let outcome: Awaited<ReturnType<UseConcurrencyLimitsResult['saveLimit']>> | undefined;
    await act(async () => {
      outcome = await current().saveLimit('minimax', 4);
    });

    expect(calls).toEqual([`PUT ${API_ORIGIN}/api/settings/concurrency-limits/minimax {"maxConcurrentSteps":4}`]);
    expect(outcome).toEqual({ kind: 'ok', value: saved });
    expect(current().state).toEqual({ status: 'success', value: [CLAUDE, saved] });
  });

  it('a mentés hibája hibaágat ad, és a megjelenített lista a korábbi marad', async () => {
    await mount((_input, init) =>
      init.method === 'PUT' ? Promise.reject(new Error('nincs hálózat')) : Promise.resolve(Response.json([CLAUDE])),
    );

    let outcome: Awaited<ReturnType<UseConcurrencyLimitsResult['saveLimit']>> | undefined;
    await act(async () => {
      outcome = await current().saveLimit('claude-subscription', 5);
    });

    expect(outcome?.kind).toBe('error');
    expect(current().state).toEqual({ status: 'success', value: [CLAUDE] });
  });

  it('a törlés DELETE hívást küld törzs nélkül; a 204 után az azonos provider korlátja null, a javaslata marad, a többi sor érintetlen', async () => {
    const calls: string[] = [];
    await mount((input, init) => {
      if (init.method === 'DELETE') {
        calls.push(`DELETE ${input} ${bodyText(init.body)}`);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(Response.json([CLAUDE, MINIMAX]));
    });

    let outcome: Awaited<ReturnType<UseConcurrencyLimitsResult['clearLimit']>> | undefined;
    await act(async () => {
      outcome = await current().clearLimit('claude-subscription');
    });

    expect(calls).toEqual([`DELETE ${API_ORIGIN}/api/settings/concurrency-limits/claude-subscription nincs törzs`]);
    expect(outcome).toEqual({ kind: 'ok', value: undefined });
    expect(current().state).toEqual({
      status: 'success',
      value: [{ ...CLAUDE, configuredMaxConcurrentSteps: null }, MINIMAX],
    });
  });

  it('a törlés hibája hibaágat ad, és a megjelenített lista a korábbi marad', async () => {
    await mount((_input, init) =>
      init.method === 'DELETE' ? Promise.reject(new Error('nincs hálózat')) : Promise.resolve(Response.json([CLAUDE])),
    );

    let outcome: Awaited<ReturnType<UseConcurrencyLimitsResult['clearLimit']>> | undefined;
    await act(async () => {
      outcome = await current().clearLimit('claude-subscription');
    });

    expect(outcome?.kind).toBe('error');
    expect(current().state).toEqual({ status: 'success', value: [CLAUDE] });
  });
});
