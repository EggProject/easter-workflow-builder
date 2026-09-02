import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserFetchFunction } from './browser-fetch-function.ts';

describe('browserFetchFunction', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    Object.assign(globalThis, { fetch: originalFetch });
  });

  it('a globalThis.fetch függvényt hívja meg, ugyanazokkal az argumentumokkal', async () => {
    const fakeResponse = new Response('{}');
    const fakeFetch = vi.fn().mockResolvedValue(fakeResponse);
    Object.assign(globalThis, { fetch: fakeFetch });

    const result = await browserFetchFunction('https://api.example.test/x', { method: 'GET' });

    expect(fakeFetch).toHaveBeenCalledWith('https://api.example.test/x', { method: 'GET' });
    expect(result).toBe(fakeResponse);
  });
});
