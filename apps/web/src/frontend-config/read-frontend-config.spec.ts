import { isOkOutcome, type EnvironmentReader } from '@easter-workflow-builder/core';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FRONTEND_CONFIG } from './default-frontend-config.ts';
import { readFrontendConfig } from './read-frontend-config.ts';

// A teszt fixture értékei szándékosan NEM URL alakúak és nem tartalmaznak
// portszámot: a SPEC-007 16. szekció 45. kritériuma szerint az `apps/web/src`
// alatt nem állhat origin literál és nem állhat portszám. A beolvasó a formát
// nem is vizsgálja, tehát egy tetszőleges, nem üres sztring pontosan ugyanazt
// az ágat futtatja.
const ORIGIN_VALUE = 'origin-ertek';

const STREAM_ORIGIN_VALUE = 'stream-origin-ertek';

function environmentWith(overrides: Readonly<Record<string, string | undefined>>): EnvironmentReader {
  return {
    VITE_API_ORIGIN: ORIGIN_VALUE,
    VITE_STREAM_ORIGIN: STREAM_ORIGIN_VALUE,
    VITE_LIST_LIMIT: '25',
    VITE_STREAM_REPLAY_LIMIT: '200',
    ...overrides,
  };
}

describe('readFrontendConfig', () => {
  it('mind a négy kötelező változóból felépíti a konfigurációt', () => {
    const outcome = readFrontendConfig(environmentWith({}));

    expect(outcome).toEqual({
      kind: 'ok',
      value: {
        apiOrigin: ORIGIN_VALUE,
        streamOrigin: STREAM_ORIGIN_VALUE,
        listLimit: 25,
        streamReplayLimit: 200,
      },
    });
  });

  it('levágja a körbevevő szóközöket a szöveges értékről', () => {
    const outcome = readFrontendConfig(environmentWith({ VITE_API_ORIGIN: `  ${ORIGIN_VALUE}  ` }));

    expect(isOkOutcome(outcome) ? outcome.value.apiOrigin : undefined).toBe(ORIGIN_VALUE);
  });

  it('hiányzó API origin esetén az alapértéket adja', () => {
    const outcome = readFrontendConfig(environmentWith({ VITE_API_ORIGIN: undefined }));

    expect(isOkOutcome(outcome) ? outcome.value.apiOrigin : undefined).toBe(DEFAULT_FRONTEND_CONFIG.apiOrigin);
  });

  it('üres API origin esetén ugyanaz az alapérték jár, mint a hiányzónál', () => {
    const outcome = readFrontendConfig(environmentWith({ VITE_API_ORIGIN: ' '.repeat(3) }));

    expect(isOkOutcome(outcome) ? outcome.value.apiOrigin : undefined).toBe(DEFAULT_FRONTEND_CONFIG.apiOrigin);
  });

  it('hiányzó stream origin esetén az alapértéket adja', () => {
    const outcome = readFrontendConfig(environmentWith({ VITE_STREAM_ORIGIN: undefined }));

    expect(isOkOutcome(outcome) ? outcome.value.streamOrigin : undefined).toBe(DEFAULT_FRONTEND_CONFIG.streamOrigin);
  });

  it('hiányzó lista lapméret esetén az alapértéket adja', () => {
    const outcome = readFrontendConfig(environmentWith({ VITE_LIST_LIMIT: undefined }));

    expect(isOkOutcome(outcome) ? outcome.value.listLimit : undefined).toBe(DEFAULT_FRONTEND_CONFIG.listLimit);
  });

  it('üres lista lapméret esetén az alapértéket adja', () => {
    const outcome = readFrontendConfig(environmentWith({ VITE_LIST_LIMIT: '' }));

    expect(isOkOutcome(outcome) ? outcome.value.listLimit : undefined).toBe(DEFAULT_FRONTEND_CONFIG.listLimit);
  });

  it('hiányzó stream pótlási lapméret esetén az alapértéket adja', () => {
    const outcome = readFrontendConfig(environmentWith({ VITE_STREAM_REPLAY_LIMIT: undefined }));

    expect(isOkOutcome(outcome) ? outcome.value.streamReplayLimit : undefined).toBe(
      DEFAULT_FRONTEND_CONFIG.streamReplayLimit,
    );
  });

  it('teljesen üres környezetre a négy alapértéket adja', () => {
    expect(readFrontendConfig({})).toEqual({ kind: 'ok', value: DEFAULT_FRONTEND_CONFIG });
  });

  const invalidNumbers: readonly string[] = ['nem-szam', '2.5', '0', '-3'];
  it.each(invalidNumbers)('a(z) "%s" lapméret értéket elutasítja, az értéket meg nem nevezve', (rawValue) => {
    const outcome = readFrontendConfig(environmentWith({ VITE_LIST_LIMIT: rawValue }));

    expect(outcome).toEqual({
      kind: 'error',
      message: 'A(z) VITE_LIST_LIMIT konfiguráció értéke nem pozitív egész szám.',
    });
    expect(isOkOutcome(outcome) ? '' : outcome.message).not.toContain(rawValue);
  });

  it('a megadott érvénytelen stream pótlási lapméretre hibaágat ad, nem az alapértékre esik vissza', () => {
    const outcome = readFrontendConfig(environmentWith({ VITE_STREAM_REPLAY_LIMIT: 'nem-szam' }));

    expect(outcome).toEqual({
      kind: 'error',
      message: 'A(z) VITE_STREAM_REPLAY_LIMIT konfiguráció értéke nem pozitív egész szám.',
    });
  });
});
