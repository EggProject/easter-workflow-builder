import { describe, expect, it } from 'vitest';
import type { FetchFunction } from './fetch-function.ts';
import { getBinary } from './get-binary.ts';

const URL_UNDER_TEST = 'https://pelda.example/kep.png';

const failingFetch: FetchFunction = () => Promise.reject(new Error('idotullepes'));
const notFoundFetch: FetchFunction = () => Promise.resolve(new Response('', { status: 404 }));

const brokenStreamFetch: FetchFunction = () =>
  Promise.resolve(
    new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error('szakadt adatfolyam'));
        },
      }),
    ),
  );

const imageFetch: FetchFunction = () =>
  Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }));

const noContentTypeFetch: FetchFunction = () => Promise.resolve(new Response(new Uint8Array([9]), { headers: {} }));

describe('getBinary', () => {
  it('hibaágat ad, ha a hívás el sem jut a szolgáltatásig', async () => {
    const outcome = await getBinary(URL_UNDER_TEST, 500, failingFetch);
    if (outcome.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(outcome.message).toContain('idotullepes');
  });

  it('hibaágat ad nem sikeres HTTP státuszra', async () => {
    const outcome = await getBinary(URL_UNDER_TEST, 500, notFoundFetch);
    if (outcome.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(outcome.message).toContain('404');
  });

  it('hibaágat ad, ha a tartalom beolvasása megszakad', async () => {
    const outcome = await getBinary(URL_UNDER_TEST, 500, brokenStreamFetch);
    expect(outcome.kind).toBe('error');
  });

  it('visszaadja a letöltött bájtokat és a jelentett típust', async () => {
    const outcome = await getBinary(URL_UNDER_TEST, 500, imageFetch);
    if (outcome.kind !== 'ok') {
      throw new Error('sikeres ágat vártunk');
    }
    expect([...outcome.value.bytes]).toStrictEqual([1, 2, 3]);
    expect(outcome.value.contentType).toBe('image/png');
  });

  it('üres típust ad, ha nincs content-type fejléc', async () => {
    const outcome = await getBinary(URL_UNDER_TEST, 500, noContentTypeFetch);
    if (outcome.kind !== 'ok') {
      throw new Error('sikeres ágat vártunk');
    }
    expect(outcome.value.contentType).toBe('');
  });
});
