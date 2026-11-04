/* eslint-disable unicorn/no-null -- a protokoll `errorMessage` mezője sikernél a dróton ténylegesen `null` */
import type { FetchFunction } from '@easter-workflow-builder/core';
import { describe, expect, it } from 'vitest';
import { createProviderConnectionTester } from './create-provider-connection-tester.ts';

const API_ORIGIN = 'https://api.example.test';

const invalidResponseFetchFunction: FetchFunction = () => Promise.resolve(Response.json({ succeeded: 'igen' }));

describe('createProviderConnectionTester', () => {
  it('törzs nélküli POST hívást küld a provider azonosítóval, és a választ a sémával olvassa', async () => {
    const requests: { readonly url: string; readonly init: RequestInit | undefined }[] = [];
    const fetchFunction: FetchFunction = (input, init) => {
      requests.push({ url: input, init });
      return Promise.resolve(Response.json({ succeeded: true, errorMessage: null }));
    };

    const outcome = await createProviderConnectionTester(API_ORIGIN, fetchFunction)('minimax');

    expect(outcome).toEqual({ kind: 'ok', value: { succeeded: true, errorMessage: null } });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(`${API_ORIGIN}/api/providers/minimax/connection-test`);
    expect(requests[0]?.init?.method).toBe('POST');
    expect(requests[0]?.init?.body).toBeNull();
  });

  it('a séma szerint hibás választ hibaágként adja vissza', async () => {
    const outcome = await createProviderConnectionTester(API_ORIGIN, invalidResponseFetchFunction)('minimax');

    expect(outcome.kind).toBe('error');
  });
});
