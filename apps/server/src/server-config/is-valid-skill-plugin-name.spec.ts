import { describe, expect, it } from 'vitest';
import { isValidSkillPluginName } from './is-valid-skill-plugin-name.ts';

describe('isValidSkillPluginName', () => {
  it.each(['skills', 'easter-skills', 'Skill_Konyvtar.v2', 'skill konyvtar', 'skillek '])('elfogadja: %j', (name) => {
    expect(isValidSkillPluginName(name)).toBe(true);
  });

  it.each([
    ['üres (a gyökér könyvtár neve)', ''],
    ['kezdő szóköz', ' skills'],
    ['nyitó zárójel', 'skills(1)'],
    ['vessző', 'rossz,nev'],
    ['C0 vezérlő karakter', 'skill\tnev'],
    ['DEL', 'skill\u{7F}nev'],
    ['C1 vezérlő karakter', 'skill\u{85}nev'],
  ])('elutasítja: %s', (_label, name) => {
    expect(isValidSkillPluginName(name)).toBe(false);
  });
});
