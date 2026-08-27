import { describe, expect, it } from 'vitest';
import { ENV_MINIMAX_API_KEY } from '../config/environment-variable-name.ts';
import type { FetchFunction } from '../http/fetch-function.ts';
import type { ReadFileFunction } from '../image/read-file-function.ts';
import type { AgentToolDependencies } from './agent-tool-dependencies.ts';
import { createWebSearchTool } from './create-web-search-tool.ts';

const readFileFunction: ReadFileFunction = () => Promise.reject(new Error('nem hasznalt'));
const failingFetch: FetchFunction = () => Promise.reject(new Error('halozati hiba'));
const emptyEnvelopeFetch: FetchFunction = () =>
  Promise.resolve(Response.json({ base_resp: { status_code: 0, status_msg: 'success' } }));
const oneResultFetch: FetchFunction = () =>
  Promise.resolve(
    Response.json({
      organic: [{ title: 'Talalat', link: 'https://a.example', snippet: 'kivonat', date: '' }],
      base_resp: { status_code: 0, status_msg: 'success' },
    }),
  );

const withKey = { [ENV_MINIMAX_API_KEY]: 'kulcs' };

function dependencies(fetchFunction: FetchFunction, environment: Record<string, string>): AgentToolDependencies {
  return { fetchFunction, environment, readFileFunction };
}

describe('createWebSearchTool', () => {
  it('a szerződés szerinti nevet adja az eszköznek', () => {
    expect(createWebSearchTool(dependencies(failingFetch, withKey)).name).toBe('web_search');
  });

  it('hibát ad üres keresési kifejezésre, hívás nélkül', async () => {
    const result = await createWebSearchTool(dependencies(failingFetch, withKey)).handler({ query: ' ' }, undefined);
    expect(result.isError).toBe(true);
  });

  it('hibát ad, ha hiányzik a kulcs környezeti változó', async () => {
    const result = await createWebSearchTool(dependencies(failingFetch, {})).handler({ query: 'teszt' }, undefined);
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(ENV_MINIMAX_API_KEY);
  });

  it('hibát ad, ha a hívás nem sikerül', async () => {
    const result = await createWebSearchTool(dependencies(failingFetch, withKey)).handler(
      { query: 'teszt' },
      undefined,
    );
    expect(result.isError).toBe(true);
  });

  it('hibát ad ismeretlen alakú válaszra', async () => {
    const result = await createWebSearchTool(dependencies(emptyEnvelopeFetch, withKey)).handler(
      { query: 'teszt' },
      undefined,
    );
    expect(result.isError).toBe(true);
  });

  it('a találatokat szövegként adja vissza', async () => {
    const result = await createWebSearchTool(dependencies(oneResultFetch, withKey)).handler(
      { query: ' teszt ' },
      undefined,
    );
    expect(result.isError).toBe(false);
    expect(JSON.stringify(result.content)).toContain('Talalat');
  });
});
