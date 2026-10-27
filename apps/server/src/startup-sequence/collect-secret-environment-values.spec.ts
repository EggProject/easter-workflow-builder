import { describe, expect, it } from 'vitest';
import { collectSecretEnvironmentValues } from './collect-secret-environment-values.ts';

describe('collectSecretEnvironmentValues', () => {
  it('a minimax ANTHROPIC_AUTH_TOKEN titkos env változó beállított értékét adja vissza', () => {
    const values = collectSecretEnvironmentValues({ ANTHROPIC_AUTH_TOKEN: 'sk-teszt-titok' });
    expect(values).toStrictEqual(['sk-teszt-titok']);
  });

  it('a minimax alternatív ANTHROPIC_API_KEY nevének értékét is visszaadja (SPEC-013 4.6)', () => {
    const values = collectSecretEnvironmentValues({ ANTHROPIC_API_KEY: 'sk-masik-nev' });
    expect(values).toStrictEqual(['sk-masik-nev']);
  });

  it('mindkét név állva mindkét érték maszkolandó', () => {
    const values = collectSecretEnvironmentValues({ ANTHROPIC_AUTH_TOKEN: 'sk-elso', ANTHROPIC_API_KEY: 'sk-masodik' });
    expect(values).toStrictEqual(['sk-elso', 'sk-masodik']);
  });

  it('hiányzó titkos env változóra üres listát ad', () => {
    const values = collectSecretEnvironmentValues({});
    expect(values).toStrictEqual([]);
  });
});
