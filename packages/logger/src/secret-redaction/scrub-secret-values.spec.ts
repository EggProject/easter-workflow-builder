import { describe, expect, it } from 'vitest';
import { scrubSecretValues } from './scrub-secret-values.ts';

describe('scrubSecretValues', () => {
  it('lecseréli a titkot a szöveg közepén', () => {
    const result = scrubSecretValues('hiba: kulcs sk-titok-123 érvénytelen', ['sk-titok-123']);
    expect(result).toBe('hiba: kulcs [Redacted] érvénytelen');
  });

  it('minden előfordulást lecserél, ha a titok többször szerepel', () => {
    const result = scrubSecretValues('sk-titok sk-titok', ['sk-titok']);
    expect(result).toBe('[Redacted] [Redacted]');
  });

  it('több titkot is lecserél egyetlen híváson belül', () => {
    const result = scrubSecretValues('a=titok-egy b=titok-ketto', ['titok-egy', 'titok-ketto']);
    expect(result).toBe('a=[Redacted] b=[Redacted]');
  });

  it('változatlanul hagyja a szöveget, ha nincs titok', () => {
    const result = scrubSecretValues('nincs titok ebben a sorban', []);
    expect(result).toBe('nincs titok ebben a sorban');
  });

  it('kihagyja az üres string titkot, hogy ne rontsa el a szöveget', () => {
    const result = scrubSecretValues('változatlan szöveg', ['']);
    expect(result).toBe('változatlan szöveg');
  });

  it('literálisan kezeli a speciális karaktereket, nem reguláris kifejezésként', () => {
    const result = scrubSecretValues('kulcs: a.b*c(d)', ['a.b*c(d)']);
    expect(result).toBe('kulcs: [Redacted]');
  });
});
