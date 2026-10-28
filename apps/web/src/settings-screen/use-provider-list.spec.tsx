import type { FetchFunction } from '@easter-workflow-builder/core';
import type { ProviderSummary } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RequestState } from '../request-state/request-state.ts';
import { useProviderList } from './use-provider-list.ts';

const API_ORIGIN = 'https://api.example.test';

const PROVIDER: ProviderSummary = {
  id: 'minimax',
  displayName: 'MiniMax',
  models: [],
  requiredEnvNames: [['ANTHROPIC_AUTH_TOKEN']],
};

describe('useProviderList', () => {
  let container: HTMLDivElement;
  let root: Root;
  let observed: RequestState<readonly ProviderSummary[]>[];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    observed = [];
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function Probe(properties: { readonly fetchFunction: FetchFunction }): undefined {
    observed.push(useProviderList(API_ORIGIN, properties.fetchFunction));
  }

  async function mount(fetchFunction: FetchFunction): Promise<void> {
    await act(async () => {
      root.render(<Probe fetchFunction={fetchFunction} />);
      await Promise.resolve();
    });
  }

  it('betöltéskor a GET /api/providers választ pending állapoton át success állapotba hozza', async () => {
    const urls: string[] = [];
    await mount((input) => {
      urls.push(input);
      return Promise.resolve(Response.json([PROVIDER]));
    });

    expect(urls).toEqual([`${API_ORIGIN}/api/providers`]);
    expect(observed.map((state) => state.status)).toContain('pending');
    expect(observed.at(-1)).toEqual({ status: 'success', value: [PROVIDER] });
  });

  it('a betöltés hibáját failure állapotban adja', async () => {
    await mount(() => Promise.reject(new Error('nincs hálózat')));

    expect(observed.at(-1)?.status).toBe('failure');
  });
});
