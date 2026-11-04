import { describe, expect, it } from 'vitest';
import { readEnvironmentBinding } from './read-environment-binding.ts';

describe('readEnvironmentBinding', () => {
  it('a deklarált névhez tartozó szerver oldali nevet adja', () => {
    expect(readEnvironmentBinding({ GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' }, 'GITHUB_TOKEN')).toBe('GITHUB_TOKEN_CEG');
  });

  it('hiányzó bejegyzésre üres szöveget ad', () => {
    expect(readEnvironmentBinding({ GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' }, 'MASIK')).toBe('');
  });

  it('az Object prototípus tagjainak nevére sem old fel (constructor, __proto__)', () => {
    expect(readEnvironmentBinding({}, 'constructor')).toBe('');
    expect(readEnvironmentBinding({}, '__proto__')).toBe('');
  });
});
