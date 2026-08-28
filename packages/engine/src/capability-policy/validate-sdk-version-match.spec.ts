import { describe, expect, it } from 'vitest';
import { validateSdkVersionMatch } from './validate-sdk-version-match.ts';

// Kitalált verziószámok: a függvény két szöveget hasonlít össze, a tényleges
// pinelt verzió a `docs/research/2026-08-26-toolchain.md` fájlban él, és nem a
// tesztben.
const pin = '9.9.9-fake';

describe('validateSdkVersionMatch', () => {
  it('egyezés esetén a futás indulhat', () => {
    expect(validateSdkVersionMatch(pin, pin)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('eltérés esetén provider_descriptor_sdk_mismatch hibát ad, mindkét verziót megnevezve', () => {
    expect(validateSdkVersionMatch(pin, '9.9.10-fake')).toStrictEqual({
      kind: 'error',
      message:
        'A provider leírója a(z) 9.9.9-fake SDK verzióhoz készült, a telepített verzió viszont 9.9.10-fake (provider_descriptor_sdk_mismatch).',
    });
  });

  it('az összehasonlítás szó szerinti, tehát az eltérő alakú, de rokon verzió is eltérésnek számít', () => {
    expect(validateSdkVersionMatch(pin, `v${pin}`)).toStrictEqual({
      kind: 'error',
      message:
        'A provider leírója a(z) 9.9.9-fake SDK verzióhoz készült, a telepített verzió viszont v9.9.9-fake (provider_descriptor_sdk_mismatch).',
    });
  });
});
