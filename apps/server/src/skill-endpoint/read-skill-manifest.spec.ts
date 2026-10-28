import { describe, expect, it } from 'vitest';
import { readSkillManifest } from './read-skill-manifest.ts';

const errorClassOf = (content: string, name = 'pdf-tools'): string | undefined => {
  const outcome = readSkillManifest(content, name);
  return outcome.kind === 'error'
    ? /\((?<errorClass>[a-z_]+)\)\.$/u.exec(outcome.message)?.groups?.['errorClass']
    : undefined;
};

describe('readSkillManifest', () => {
  it('a description értékét adja, name nélkül is (O-37: a hiány elfogadott)', () => {
    expect(readSkillManifest('---\ndescription: PDF kezelés\n---\n# Törzs\n', 'pdf-tools')).toStrictEqual({
      kind: 'ok',
      value: { description: 'PDF kezelés' },
    });
  });

  it('a megadott névvel egyező name mező és a CRLF sorvég elfogadott', () => {
    expect(readSkillManifest('---\r\nname: pdf-tools\r\ndescription: x\r\n---\r\n', 'pdf-tools').kind).toBe('ok');
  });

  it('a pontosan 1024 karakteres description elfogadott', () => {
    expect(readSkillManifest(`---\ndescription: "${'é'.repeat(1024)}"\n---\n`, 'pdf-tools').kind).toBe('ok');
  });

  it.each([
    ['frontmatter nélkül', '# csak törzs\n'],
    ['záró --- nélkül', '---\ndescription: x\n'],
    ['olvashatatlan YAML', '---\ndescription: [nyitott\n---\n'],
    ['nem leképezés', '---\n- a\n- b\n---\n'],
    ['üres frontmatter', '---\n---\n'],
    ['hiányzó description', '---\nname: pdf-tools\n---\n'],
    ['nem szöveges description', '---\ndescription: 42\n---\n'],
    ['csak szóköz description', '---\ndescription: "   "\n---\n'],
    ['1025 karakteres description', `---\ndescription: "${'a'.repeat(1025)}"\n---\n`],
  ])('%s: hibás fejléc', (_label, content) => {
    expect(errorClassOf(content)).toBe('skill_manifest_invalid');
  });

  it('a megadottól eltérő name elutasítva, az üzenet mindkét nevet megnevezi', () => {
    const outcome = readSkillManifest('---\nname: masik\ndescription: x\n---\n', 'pdf-tools');
    expect(outcome).toStrictEqual({
      kind: 'error',
      message: 'A SKILL.md name mezője ("masik") eltér a megadott névtől ("pdf-tools") (skill_name_mismatch).',
    });
  });

  it('a nem szöveges name is eltérés', () => {
    expect(errorClassOf('---\nname: 7\ndescription: x\n---\n')).toBe('skill_name_mismatch');
  });
});
