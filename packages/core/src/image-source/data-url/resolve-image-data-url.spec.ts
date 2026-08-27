import { describe, expect, it } from 'vitest';
import type { FetchFunction } from '../../http-client/request/fetch-function.ts';
import type { ReadFileFunction } from './read-file-function.ts';
import { resolveImageDataUrl } from './resolve-image-data-url.ts';

const failingFetch: FetchFunction = () => Promise.reject(new Error('nem elerheto'));
const failingReadFile: ReadFileFunction = () => Promise.reject(new Error('nincs ilyen fajl'));
const htmlFetch: FetchFunction = () =>
  Promise.resolve(new Response('<html></html>', { headers: { 'content-type': 'text/html' } }));
const pngFetch: FetchFunction = () =>
  Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }));
const threeBytesReadFile: ReadFileFunction = () => Promise.resolve(new Uint8Array([1, 2, 3]));

const REMOTE_IMAGE = 'https://a.example/k.png';

describe('resolveImageDataUrl', () => {
  it('változatlanul továbbadja a kész kép data URL-t', async () => {
    const source = 'data:image/png;base64,AAAA';
    expect(await resolveImageDataUrl(source, 100, failingFetch, failingReadFile)).toStrictEqual({
      kind: 'ok',
      value: source,
    });
  });

  it('hibaágat ad nem képet tartalmazó data URL-re', async () => {
    const outcome = await resolveImageDataUrl('data:text/plain;base64,AAAA', 100, failingFetch, failingReadFile);
    expect(outcome.kind).toBe('error');
  });

  it('továbbadja a letöltés hibaágát', async () => {
    const outcome = await resolveImageDataUrl(REMOTE_IMAGE, 100, failingFetch, failingReadFile);
    if (outcome.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(outcome.message).toContain('nem elerheto');
  });

  it('hibaágat ad, ha a letöltött tartalom nem támogatott kép', async () => {
    const outcome = await resolveImageDataUrl(REMOTE_IMAGE, 100, htmlFetch, failingReadFile);
    if (outcome.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(outcome.message).toContain('text/html');
  });

  it('base64 data URL-t készít a letöltött képből', async () => {
    const outcome = await resolveImageDataUrl(REMOTE_IMAGE, 100, pngFetch, failingReadFile);
    expect(outcome).toStrictEqual({ kind: 'ok', value: 'data:image/png;base64,AQID' });
  });

  it('hibaágat ad nem támogatott helyi kiterjesztésre', async () => {
    const outcome = await resolveImageDataUrl('/adat/kep.gif', 100, failingFetch, failingReadFile);
    expect(outcome.kind).toBe('error');
  });

  it('továbbadja a fájlolvasás hibáját', async () => {
    const outcome = await resolveImageDataUrl('/adat/kep.png', 100, failingFetch, failingReadFile);
    if (outcome.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(outcome.message).toContain('nincs ilyen fajl');
  });

  it('base64 data URL-t készít a helyi fájlból', async () => {
    const outcome = await resolveImageDataUrl('/adat/kep.jpg', 100, failingFetch, threeBytesReadFile);
    expect(outcome).toStrictEqual({ kind: 'ok', value: 'data:image/jpeg;base64,AQID' });
  });
});
