import { describe, expect, it } from 'vitest';
import { isAllowedRequestSource } from './is-allowed-request-source.ts';

const ALLOWED_ORIGIN = 'http://localhost:5173';

describe('isAllowedRequestSource', () => {
  it('az engedett Origin átmegy, bármely Sec-Fetch-Site mellett (az SSE kérés cross-site)', () => {
    expect(isAllowedRequestSource({ origin: ALLOWED_ORIGIN }, ALLOWED_ORIGIN)).toBe(true);
    expect(isAllowedRequestSource({ origin: ALLOWED_ORIGIN, 'sec-fetch-site': 'cross-site' }, ALLOWED_ORIGIN)).toBe(
      true,
    );
  });

  it.each([
    'https://evil.example',
    'null',
    'http://127.0.0.1:5173',
    'http://localhost:5173/',
    'http://localhost:51730',
    `${ALLOWED_ORIGIN}, ${ALLOWED_ORIGIN}`,
  ])('az eltérő Origin ("%s") elutasít, a Sec-Fetch-Site same-origin értéke mellett is', (origin) => {
    expect(isAllowedRequestSource({ origin, 'sec-fetch-site': 'same-origin' }, ALLOWED_ORIGIN)).toBe(false);
  });

  it.each(['same-origin', 'none'])('Origin nélkül a Sec-Fetch-Site "%s" értéke átmegy', (fetchSite) => {
    expect(isAllowedRequestSource({ 'sec-fetch-site': fetchSite }, ALLOWED_ORIGIN)).toBe(true);
  });

  it.each(['same-site', 'cross-site'])(
    'Origin nélkül a Sec-Fetch-Site "%s" értéke elutasít, az engedett Referer mellett is',
    (fetchSite) => {
      expect(
        isAllowedRequestSource({ 'sec-fetch-site': fetchSite, referer: `${ALLOWED_ORIGIN}/runs` }, ALLOWED_ORIGIN),
      ).toBe(false);
    },
  );

  it('az ismeretlen Sec-Fetch-Site értéket figyelmen kívül hagyja, és a Referer dönt', () => {
    expect(
      isAllowedRequestSource({ 'sec-fetch-site': 'jovobeli', referer: 'https://evil.example/' }, ALLOWED_ORIGIN),
    ).toBe(false);
    expect(isAllowedRequestSource({ 'sec-fetch-site': 'jovobeli' }, ALLOWED_ORIGIN)).toBe(true);
  });

  it('az ismétlődő Sec-Fetch-Site fejléc (a Node vesszővel fűzi össze) nem számít ismert értéknek', () => {
    expect(
      isAllowedRequestSource(
        { 'sec-fetch-site': 'same-origin, cross-site', referer: 'https://evil.example/' },
        ALLOWED_ORIGIN,
      ),
    ).toBe(false);
  });

  it('Origin és Sec-Fetch-Site nélkül a Referer originje dönt', () => {
    expect(isAllowedRequestSource({ referer: `${ALLOWED_ORIGIN}/workflows/w-1` }, ALLOWED_ORIGIN)).toBe(true);
    expect(isAllowedRequestSource({ referer: 'https://evil.example/attack' }, ALLOWED_ORIGIN)).toBe(false);
    expect(isAllowedRequestSource({ referer: 'nem url' }, ALLOWED_ORIGIN)).toBe(false);
  });

  it('egyik forrás fejléc nélkül (nem böngésző kliens, például a próba eszköz) átmegy', () => {
    expect(isAllowedRequestSource({ host: '127.0.0.1:3001', 'content-type': 'application/json' }, ALLOWED_ORIGIN)).toBe(
      true,
    );
  });
});
