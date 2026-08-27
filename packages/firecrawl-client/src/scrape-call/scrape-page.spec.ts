import { describe, expect, it } from 'vitest';
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { FirecrawlConfig } from '../firecrawl-config/firecrawl-config.ts';
import { scrapePage } from './scrape-page.ts';

const CONFIG: FirecrawlConfig = { baseUrl: 'http://localhost:3222', timeoutMs: 1000 };

const failingFetch: FetchFunction = () => Promise.reject(new Error('nincs kapcsolat'));

describe('scrapePage', () => {
  it('hibaágat ad, ha a szolgáltatás nem érhető el', async () => {
    const outcome = await scrapePage('https://a.example', CONFIG, failingFetch);
    expect(outcome.kind).toBe('error');
  });

  it('a beállított címre hív, és a nyers választ adja vissza', async () => {
    let seenUrl = '';
    let seenBody: unknown;
    const fetchFunction: FetchFunction = (input, init) => {
      seenUrl = input;
      seenBody = init.body;
      return Promise.resolve(Response.json({ success: true }));
    };
    const outcome = await scrapePage('https://a.example', CONFIG, fetchFunction);
    expect(outcome).toStrictEqual({ kind: 'ok', value: { success: true } });
    expect(seenUrl).toBe('http://localhost:3222/v1/scrape');
    expect(seenBody).toBe(JSON.stringify({ url: 'https://a.example', formats: ['markdown'] }));
  });
});
