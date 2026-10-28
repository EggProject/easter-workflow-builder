/* eslint-disable unicorn/no-null -- a SettingsRecord `defaultProviderId` mezője a dróton ténylegesen `null` értéket hordoz (packages/protocol/src/settings/settings-record.ts). */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { SettingsRecord } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSettingsRecord, type UseSettingsRecordResult } from './use-settings-record.ts';

const API_ORIGIN = 'https://api.example.test';

const INITIAL: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };
const SAVED: SettingsRecord = { defaultProviderId: 'minimax', persistStreamDeltas: false };

describe('useSettingsRecord', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseSettingsRecordResult | undefined;

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
    latest = useSettingsRecord(API_ORIGIN, properties.fetchFunction);
    return null;
  }

  async function mount(fetchFunction: FetchFunction): Promise<void> {
    await act(async () => {
      root.render(<Probe fetchFunction={fetchFunction} />);
      await Promise.resolve();
    });
  }

  function current(): UseSettingsRecordResult {
    if (latest === undefined) {
      throw new Error('a teszt nem renderelte a hookot');
    }
    return latest;
  }

  it('betöltéskor a GET /api/settings rekordját adja success állapotban', async () => {
    const requests: string[] = [];
    await mount((input, init) => {
      requests.push(`${init.method ?? ''} ${input}`);
      return Promise.resolve(Response.json(INITIAL));
    });

    expect(requests).toEqual([`GET ${API_ORIGIN}/api/settings`]);
    expect(current().state).toEqual({ status: 'success', value: INITIAL });
  });

  it('a betöltés hibáját failure állapotban adja', async () => {
    await mount(() => Promise.reject(new Error('nincs hálózat')));

    expect(current().state.status).toBe('failure');
  });

  it('a mentés PUT hívást küld a részleges törzzsel, és a válasz rekordja lesz a közös állapot', async () => {
    let putBody: unknown;
    await mount((_input, init) => {
      if (init.method === 'PUT') {
        putBody = init.body;
        return Promise.resolve(Response.json(SAVED));
      }
      return Promise.resolve(Response.json(INITIAL));
    });

    let outcome: Awaited<ReturnType<UseSettingsRecordResult['save']>> | undefined;
    await act(async () => {
      outcome = await current().save({ defaultProviderId: 'minimax' });
    });

    expect(putBody).toBe(JSON.stringify({ defaultProviderId: 'minimax' }));
    expect(outcome).toEqual({ kind: 'ok', value: SAVED });
    expect(current().state).toEqual({ status: 'success', value: SAVED });
  });

  it('a mentés hibája hibaágat ad, és a megjelenített rekord a korábbi marad', async () => {
    await mount((_input, init) =>
      init.method === 'PUT' ? Promise.reject(new Error('nincs hálózat')) : Promise.resolve(Response.json(INITIAL)),
    );

    let outcome: Awaited<ReturnType<UseSettingsRecordResult['save']>> | undefined;
    await act(async () => {
      outcome = await current().save({ defaultProviderId: 'minimax' });
    });

    expect(outcome?.kind).toBe('error');
    expect(current().state).toEqual({ status: 'success', value: INITIAL });
  });
});
