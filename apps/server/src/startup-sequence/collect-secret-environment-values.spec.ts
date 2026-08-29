import { describe, expect, it } from 'vitest';
import { collectSecretEnvironmentValues } from './collect-secret-environment-values.ts';

describe('collectSecretEnvironmentValues', () => {
  it('a minimax ANTHROPIC_AUTH_TOKEN titkos env változó beállított értékét adja vissza', () => {
    const values = collectSecretEnvironmentValues({ ANTHROPIC_AUTH_TOKEN: 'sk-teszt-titok' });
    expect(values).toStrictEqual(['sk-teszt-titok']);
  });

  it('hiányzó titkos env változóra üres listát ad', () => {
    const values = collectSecretEnvironmentValues({});
    expect(values).toStrictEqual([]);
  });
});
