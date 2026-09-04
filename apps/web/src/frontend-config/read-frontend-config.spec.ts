import { isOkOutcome, type EnvironmentReader } from '@easter-workflow-builder/core';
import { describe, expect, it } from 'vitest';
import { readFrontendConfig } from './read-frontend-config.ts';

// A teszt fixture értékei szándékosan NEM URL alakúak és nem tartalmaznak
// portszámot: a SPEC-007 16. szekció 45. kritériuma szerint az `apps/web/src`
// alatt nem állhat origin literál és nem állhat portszám. A beolvasó a formát
// nem is vizsgálja, tehát egy tetszőleges, nem üres sztring pontosan ugyanazt
// az ágat futtatja.
const ORIGIN_VALUE = 'origin-ertek';

function environmentWith(overrides: Readonly<Record<string, string | undefined>>): EnvironmentReader {
  return {
    VITE_API_ORIGIN: ORIGIN_VALUE,
    VITE_LIST_LIMIT: '25',
    VITE_STREAM_REPLAY_LIMIT: '200',
    ...overrides,
  };
}

describe('readFrontendConfig', () => {
  it('mind a három kötelező változóból felépíti a konfigurációt', () => {
    const outcome = readFrontendConfig(environmentWith({}));

    expect(outcome).toEqual({
      kind: 'ok',
      value: { apiOrigin: ORIGIN_VALUE, listLimit: 25, streamReplayLimit: 200 },
    });
  });

  it('levágja a körbevevő szóközöket a szöveges értékről', () => {
    const outcome = readFrontendConfig(environmentWith({ VITE_API_ORIGIN: `  ${ORIGIN_VALUE}  ` }));

    expect(isOkOutcome(outcome) ? outcome.value.apiOrigin : undefined).toBe(ORIGIN_VALUE);
  });

  it('hiányzó API origin esetén hibaágat ad, a változó nevével', () => {
    const outcome = readFrontendConfig(environmentWith({ VITE_API_ORIGIN: undefined }));

    expect(outcome).toEqual({ kind: 'error', message: 'Hiányzó kötelező konfiguráció: VITE_API_ORIGIN.' });
  });

  it('üres API origin esetén ugyanaz a hibaág fut, alapérték nélkül', () => {
    const outcome = readFrontendConfig(environmentWith({ VITE_API_ORIGIN: ' '.repeat(3) }));

    expect(outcome).toEqual({ kind: 'error', message: 'Hiányzó kötelező konfiguráció: VITE_API_ORIGIN.' });
  });

  it('hiányzó lista lapméret esetén hibaágat ad, a változó nevével', () => {
    const outcome = readFrontendConfig(environmentWith({ VITE_LIST_LIMIT: undefined }));

    expect(outcome).toEqual({ kind: 'error', message: 'Hiányzó kötelező konfiguráció: VITE_LIST_LIMIT.' });
  });

  it('hiányzó stream pótlási lapméret esetén hibaágat ad, a változó nevével', () => {
    const outcome = readFrontendConfig(environmentWith({ VITE_STREAM_REPLAY_LIMIT: undefined }));

    expect(outcome).toEqual({ kind: 'error', message: 'Hiányzó kötelező konfiguráció: VITE_STREAM_REPLAY_LIMIT.' });
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
});
