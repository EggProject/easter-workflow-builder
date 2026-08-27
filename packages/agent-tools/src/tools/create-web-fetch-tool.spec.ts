import { describe, expect, it } from 'vitest';
import { ENV_FIRECRAWL_BASE_URL, ENV_FIRECRAWL_TIMEOUT_MS } from '../config/environment-variable-name.ts';
import type { FetchFunction } from '../http/fetch-function.ts';
import type { ReadFileFunction } from '../image/read-file-function.ts';
import type { AgentToolDependencies } from './agent-tool-dependencies.ts';
import { createWebFetchTool } from './create-web-fetch-tool.ts';

const readFileFunction: ReadFileFunction = () => Promise.reject(new Error('nem hasznalt'));
const failingFetch: FetchFunction = () => Promise.reject(new Error('ECONNREFUSED'));
const refusedByFirecrawlFetch: FetchFunction = () =>
  Promise.resolve(Response.json({ success: false, error: 'nem tolthetobe' }));

function dependencies(fetchFunction: FetchFunction, environment: Record<string, string>): AgentToolDependencies {
  return { fetchFunction, environment, readFileFunction };
}

describe('createWebFetchTool', () => {
  it('a szerződés szerinti nevet adja az eszköznek', () => {
    expect(createWebFetchTool(dependencies(failingFetch, {})).name).toBe('web_fetch');
  });

  it('hibát ad nem http címre, hívás nélkül', async () => {
    const result = await createWebFetchTool(dependencies(failingFetch, {})).handler(
      { url: 'ftp://a.example' },
      undefined,
    );
    expect(result.isError).toBe(true);
  });

  it('hibát ad hibás timeout beállításra', async () => {
    const result = await createWebFetchTool(dependencies(failingFetch, { [ENV_FIRECRAWL_TIMEOUT_MS]: 'sok' })).handler(
      { url: 'https://a.example' },
      undefined,
    );
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(ENV_FIRECRAWL_TIMEOUT_MS);
  });

  it('nem elérhető Firecrawl esetén hibát ad, és javasolja az ellenőrzést', async () => {
    const result = await createWebFetchTool(dependencies(failingFetch, {})).handler(
      { url: 'https://a.example' },
      undefined,
    );
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('Firecrawl');
  });

  it('továbbadja a Firecrawl saját hibáját', async () => {
    const result = await createWebFetchTool(dependencies(refusedByFirecrawlFetch, {})).handler(
      { url: 'https://a.example' },
      undefined,
    );
    expect(result.isError).toBe(true);
  });

  it('a beállított címre hív, és a markdown tartalmat adja vissza', async () => {
    let seenUrl = '';
    let seenBody: unknown;
    const fetchFunction: FetchFunction = (input, init) => {
      seenUrl = input;
      seenBody = init.body;
      return Promise.resolve(
        Response.json({
          success: true,
          data: { markdown: '# Oldal tartalma', metadata: { title: 'Oldal', sourceURL: 'https://a.example' } },
        }),
      );
    };
    const result = await createWebFetchTool(
      dependencies(fetchFunction, { [ENV_FIRECRAWL_BASE_URL]: 'http://localhost:9999' }),
    ).handler({ url: ' https://a.example ' }, undefined);
    expect(result.isError).toBe(false);
    expect(JSON.stringify(result.content)).toContain('Oldal tartalma');
    expect(seenUrl).toBe('http://localhost:9999/v1/scrape');
    expect(seenBody).toBe(JSON.stringify({ url: 'https://a.example', formats: ['markdown'] }));
  });
});
