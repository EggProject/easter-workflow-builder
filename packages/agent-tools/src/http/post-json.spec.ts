import { describe, expect, it } from 'vitest';
import type { FetchFunction } from './fetch-function.ts';
import { postJson } from './post-json.ts';

const REQUEST = {
  url: 'https://pelda.example/vegpont',
  headers: { Authorization: 'Bearer x' },
  body: { a: 1 },
  timeoutMs: 1000,
};

const failingFetch: FetchFunction = () => Promise.reject(new Error('nincs kapcsolat'));
const serverErrorFetch: FetchFunction = () => Promise.resolve(new Response('', { status: 503 }));
const nonJsonFetch: FetchFunction = () => Promise.resolve(new Response('nem json'));

describe('postJson', () => {
  it('hibaágat ad, ha a hívás el sem jut a szolgáltatásig', async () => {
    const outcome = await postJson(REQUEST, failingFetch);
    if (outcome.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(outcome.message).toContain('nincs kapcsolat');
  });

  it('hibaágat ad nem sikeres HTTP státuszra', async () => {
    const outcome = await postJson(REQUEST, serverErrorFetch);
    if (outcome.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(outcome.message).toContain('503');
  });

  it('hibaágat ad értelmezhetetlen JSON törzsre', async () => {
    const outcome = await postJson(REQUEST, nonJsonFetch);
    expect(outcome.kind).toBe('error');
  });

  it('visszaadja az értelmezett törzset, és kiküldi a fejléceket', async () => {
    let seenInit: RequestInit | undefined;
    const fetchFunction: FetchFunction = (_input, init) => {
      seenInit = init;
      return Promise.resolve(Response.json({ ok: true }));
    };
    const outcome = await postJson(REQUEST, fetchFunction);
    expect(outcome).toStrictEqual({ kind: 'ok', value: { ok: true } });
    expect(seenInit?.method).toBe('POST');
    expect(seenInit?.headers).toStrictEqual({ Authorization: 'Bearer x', 'Content-Type': 'application/json' });
  });
});
