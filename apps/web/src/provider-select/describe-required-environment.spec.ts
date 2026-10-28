import { describe, expect, it } from 'vitest';
import { describeRequiredEnvironment } from './describe-required-environment.ts';

describe('describeRequiredEnvironment', () => {
  it('követelmény nélkül kimondja, hogy nem kell változó', () => {
    expect(describeRequiredEnvironment([])).toBe('Ehhez a providerhez nem kell környezeti változó.');
  });

  it('a követelményeket vesszővel, az alternatív neveket " vagy " kötőszóval sorolja', () => {
    expect(describeRequiredEnvironment([['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'], ['EXAMPLE_VARIABLE']])).toBe(
      'Szükséges környezeti változók: ANTHROPIC_AUTH_TOKEN vagy ANTHROPIC_API_KEY, EXAMPLE_VARIABLE',
    );
  });
});
