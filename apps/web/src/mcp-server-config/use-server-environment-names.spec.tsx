import type { FetchFunction } from '@easter-workflow-builder/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RequestState } from '../request-state/request-state.ts';
import { useServerEnvironmentNames } from './use-server-environment-names.ts';

const API_ORIGIN = 'https://api.example.test';

describe('useServerEnvironmentNames', () => {
  let container: HTMLDivElement;
  let root: Root;
  let observed: RequestState<readonly string[]>[];

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
    observed.push(useServerEnvironmentNames(API_ORIGIN, properties.fetchFunction));
  }

  async function mount(fetchFunction: FetchFunction): Promise<void> {
    await act(async () => {
      root.render(<Probe fetchFunction={fetchFunction} />);
      await Promise.resolve();
    });
  }

  it('betöltéskor a GET /api/server-environment-names nevei pending állapoton át success állapotba kerülnek', async () => {
    const urls: string[] = [];
    await mount((input) => {
      urls.push(input);
      return Promise.resolve(Response.json(['GITHUB_TOKEN_CEG', 'GITHUB_TOKEN_SAJAT']));
    });

    expect(urls).toEqual([`${API_ORIGIN}/api/server-environment-names`]);
    expect(observed.map((state) => state.status)).toContain('pending');
    expect(observed.at(-1)).toEqual({ status: 'success', value: ['GITHUB_TOKEN_CEG', 'GITHUB_TOKEN_SAJAT'] });
  });

  it('a betöltés hibáját failure állapotban adja', async () => {
    await mount(() => Promise.reject(new Error('nincs hálózat')));

    expect(observed.at(-1)?.status).toBe('failure');
  });

  it('a szabálytalan névre (nem név alakú elem) váratlan válasz hibát ad', async () => {
    await mount(() => Promise.resolve(Response.json(['JÓ_NÉV_NEM', '1rossz'])));

    expect(observed.at(-1)?.status).toBe('failure');
  });
});
