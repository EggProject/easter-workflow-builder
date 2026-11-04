import { describe, expect, it } from 'vitest';
import { parseSkillNameDraft } from './parse-skill-name-draft.ts';

describe('parseSkillNameDraft', () => {
  it.each(['riport', 'riport-keszito', 'a1', 'skill-2'])(
    'a névszabálynak megfelelő "%s" nevet változatlanul adja',
    (name) => {
      expect(parseSkillNameDraft(name)).toBe(name);
    },
  );

  it('a név körüli szóközöket eldobja', () => {
    expect(parseSkillNameDraft('  riport  ')).toBe('riport');
  });

  it.each([
    ['üres mező', ''],
    ['csak szóköz', ' '.repeat(3)],
    ['nagybetű', 'Riport'],
    ['szóköz a névben', 'riport keszito'],
    ['kezdő kötőjel', '-riport'],
    ['záró kötőjel', 'riport-'],
    ['dupla kötőjel', 'riport--keszito'],
    ['aláhúzás', 'riport_keszito'],
    ['ékezetes betű', 'riportkészítő'],
    ['a tiltott "anthropic" szó', 'anthropic-riport'],
    ['a tiltott "claude" szó', 'riport-claude'],
    ['65 karakter', 'a'.repeat(65)],
  ])('%s esetén undefined', (_description, draft) => {
    expect(parseSkillNameDraft(draft)).toBeUndefined();
  });

  it('a 64 karakteres nevet még elfogadja', () => {
    expect(parseSkillNameDraft('a'.repeat(64))).toBe('a'.repeat(64));
  });
});
