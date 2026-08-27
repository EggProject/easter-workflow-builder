import { describe, expect, it } from 'vitest';
import type { ReadFileFunction } from '@easter-workflow-builder/core';
import { ENV_MINIMAX_API_KEY, type FetchFunction } from '@easter-workflow-builder/minimax-client';
import type { UnderstandImageToolDependencies } from './understand-image-tool-dependencies.ts';
import { createImageUnderstandingTool } from './create-image-understanding-tool.ts';

const failingReadFile: ReadFileFunction = () => Promise.reject(new Error('nincs ilyen fajl'));
const threeBytesReadFile: ReadFileFunction = () => Promise.resolve(new Uint8Array([1, 2, 3]));
const failingFetch: FetchFunction = () => Promise.reject(new Error('halozati hiba'));
const emptyEnvelopeFetch: FetchFunction = () =>
  Promise.resolve(Response.json({ base_resp: { status_code: 0, status_msg: 'success' } }));

const withKey = { [ENV_MINIMAX_API_KEY]: 'kulcs' };
const DATA_URL = 'data:image/png;base64,AQID';
const LOCAL_IMAGE = '/adat/kep.png';

function dependencies(
  fetchFunction: FetchFunction,
  environment: Record<string, string>,
  readFileFunction: ReadFileFunction = failingReadFile,
): UnderstandImageToolDependencies {
  return { fetchFunction, environment, readFileFunction };
}

describe('createImageUnderstandingTool', () => {
  it('a szerződés szerinti nevet adja az eszköznek', () => {
    expect(createImageUnderstandingTool(dependencies(failingFetch, withKey)).name).toBe('understand_image');
  });

  it('hibát ad üres kérdésre', async () => {
    const tool = createImageUnderstandingTool(dependencies(failingFetch, withKey));
    const result = await tool.handler({ prompt: ' ', image_source: DATA_URL }, undefined);
    expect(result.isError).toBe(true);
  });

  it('hibát ad üres képforrásra', async () => {
    const tool = createImageUnderstandingTool(dependencies(failingFetch, withKey));
    const result = await tool.handler({ prompt: 'mi ez', image_source: ' ' }, undefined);
    expect(result.isError).toBe(true);
  });

  it('hibát ad, ha hiányzik a kulcs, és megnevezi a változót', async () => {
    const result = await createImageUnderstandingTool(dependencies(failingFetch, {})).handler(
      { prompt: 'mi ez', image_source: DATA_URL },
      undefined,
    );
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(ENV_MINIMAX_API_KEY);
  });

  it('továbbadja a képforrás feloldásának hibáját', async () => {
    const result = await createImageUnderstandingTool(dependencies(failingFetch, withKey)).handler(
      { prompt: 'mi ez', image_source: LOCAL_IMAGE },
      undefined,
    );
    expect(result.isError).toBe(true);
  });

  it('hibát ad, ha a hívás nem sikerül', async () => {
    const result = await createImageUnderstandingTool(dependencies(failingFetch, withKey)).handler(
      { prompt: 'mi ez', image_source: DATA_URL },
      undefined,
    );
    expect(result.isError).toBe(true);
  });

  it('hibát ad ismeretlen alakú válaszra', async () => {
    const result = await createImageUnderstandingTool(dependencies(emptyEnvelopeFetch, withKey)).handler(
      { prompt: 'mi ez', image_source: DATA_URL },
      undefined,
    );
    expect(result.isError).toBe(true);
  });

  it('a helyi fájlt base64 alakban küldi ki, és visszaadja az elemzést', async () => {
    let seenBody: unknown;
    const fetchFunction: FetchFunction = (_input, init) => {
      seenBody = init.body;
      return Promise.resolve(Response.json({ content: 'Piros', base_resp: { status_code: 0, status_msg: 'success' } }));
    };
    const result = await createImageUnderstandingTool(dependencies(fetchFunction, withKey, threeBytesReadFile)).handler(
      { prompt: ' milyen szinu ', image_source: LOCAL_IMAGE },
      undefined,
    );
    expect(result.isError).toBe(false);
    expect(JSON.stringify(result.content)).toContain('Piros');
    expect(seenBody).toBe(JSON.stringify({ prompt: 'milyen szinu', image_url: 'data:image/png;base64,AQID' }));
  });
});
