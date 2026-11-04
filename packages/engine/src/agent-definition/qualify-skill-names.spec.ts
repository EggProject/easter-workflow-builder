import { describe, expect, it } from 'vitest';
import type { SkillLibrarySnapshot } from '../engine-port/skill-library-snapshot.ts';
import { qualifySkillNames } from './qualify-skill-names.ts';

const LIBRARY: SkillLibrarySnapshot = {
  rootDirectory: '/var/skillek',
  pluginName: 'skillek',
  skillNames: ['alfa', 'beta'],
};

describe('qualifySkillNames', () => {
  it('a tárolt lista puszta neveit a plugin névvel minősíti, a sorrendet megtartva', () => {
    expect(qualifySkillNames(['beta', 'nincs-ilyen'], LIBRARY)).toStrictEqual(['skillek:beta', 'skillek:nincs-ilyen']);
  });

  it("az 'all' a könyvtár aktuális neveinek minősített listája", () => {
    expect(qualifySkillNames('all', LIBRARY)).toStrictEqual(['skillek:alfa', 'skillek:beta']);
  });

  it('az üres lista üres marad', () => {
    expect(qualifySkillNames([], LIBRARY)).toStrictEqual([]);
  });
});
