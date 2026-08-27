import { describe, expect, it } from 'vitest';
import type { FetchFunction } from '@easter-workflow-builder/http-client';
import type { MiniMaxConfig } from '../config/minimax-config.ts';
import { callMiniMax } from './call-minimax.ts';
import { PATH_SEARCH } from './endpoint-path.ts';

const CONFIG: MiniMaxConfig = {
  apiKey: 'kulcs',
  baseUrl: 'https://minimax.example',
  timeoutMs: 1000,
};

const failingFetch: FetchFunction = () => Promise.reject(new Error('halozati hiba'));
const withoutEnvelopeFetch: FetchFunction = () => Promise.resolve(Response.json({ organic: [] }));
const authErrorFetch: FetchFunction = () =>
  Promise.resolve(Response.json({ base_resp: { status_code: 1004, status_msg: 'login fail' } }, { status: 200 }));

describe('callMiniMax', () => {
  it('továbbadja a HTTP réteg hibaágát', async () => {
    const outcome = await callMiniMax(CONFIG, PATH_SEARCH, {}, failingFetch);
    expect(outcome.kind).toBe('error');
  });

  it('hibaágat ad, ha a válaszban nincs base_resp', async () => {
    const outcome = await callMiniMax(CONFIG, PATH_SEARCH, {}, withoutEnvelopeFetch);
    if (outcome.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(outcome.message).toContain('base_resp');
  });

  it('hibaágat ad nem nulla státuszkódra, akkor is ha a HTTP státusz 200', async () => {
    const outcome = await callMiniMax(CONFIG, PATH_SEARCH, {}, authErrorFetch);
    if (outcome.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(outcome.message).toContain('1004');
    expect(outcome.message).toContain('login fail');
  });

  it('sikerre a teljes törzset adja vissza, és a megfelelő címre hív', async () => {
    let seenUrl = '';
    let seenHeaders: unknown;
    const fetchFunction: FetchFunction = (input, init) => {
      seenUrl = input;
      seenHeaders = init.headers;
      return Promise.resolve(Response.json({ base_resp: { status_code: 0, status_msg: 'success' } }));
    };
    const outcome = await callMiniMax(CONFIG, PATH_SEARCH, { q: 'a' }, fetchFunction);
    expect(outcome).toStrictEqual({ kind: 'ok', value: { base_resp: { status_code: 0, status_msg: 'success' } } });
    expect(seenUrl).toBe(`https://minimax.example${PATH_SEARCH}`);
    expect(seenHeaders).toStrictEqual({ Authorization: 'Bearer kulcs', 'Content-Type': 'application/json' });
  });
});
