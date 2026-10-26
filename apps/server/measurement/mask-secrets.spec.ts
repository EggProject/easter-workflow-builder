import { describe, expect, it } from 'vitest';
import { maskSecrets, REDACTED } from './mask-secrets.ts';

describe('maskSecrets', () => {
  it('a titok minden előfordulását REDACTED-re cseréli', () => {
    expect(maskSecrets('a=titok-1, b=titok-1', ['titok-1'])).toBe(`a=${REDACTED}, b=${REDACTED}`);
  });

  it('a hosszabb titok előbb cserélődik, így a rövidebbet tartalmazó titok sem marad olvasható', () => {
    expect(maskSecrets('kulcs-hosszu', ['kulcs', 'kulcs-hosszu'])).toBe(REDACTED);
  });

  it('az üres érték nem titok, a szöveg változatlan marad', () => {
    expect(maskSecrets('semmi', [''])).toBe('semmi');
  });

  it('titok nélkül a szöveg változatlan', () => {
    expect(maskSecrets('semmi', [])).toBe('semmi');
  });
});
