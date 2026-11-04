import { describe, expect, it } from 'vitest';
import { SkillNameSchema } from './skill-name.ts';

describe('SkillNameSchema', () => {
  it.each(['pdf', 'pdf-tools', 'a1-b2-c3', 'x'.repeat(64)])('elfogadja a(z) "%s" nevet', (name) => {
    expect(SkillNameSchema.safeParse(name).success).toBe(true);
  });

  it.each([
    ['üres', ''],
    ['65 karakter', 'x'.repeat(65)],
    ['nagybetű', 'Pdf'],
    ['aláhúzás', 'pdf_tools'],
    ['kötőjellel kezdődik', '-pdf'],
    ['kötőjellel végződik', 'pdf-'],
    ['dupla kötőjel', 'pdf--tools'],
    ['útvonal elem', '../pdf'],
    ['ékezet', 'pdf-eszköz'],
    ['tiltott szó: anthropic', 'my-anthropic-skill'],
    ['tiltott szó: claude', 'claude-helper'],
  ])('elutasítja: %s', (_label, name) => {
    expect(SkillNameSchema.safeParse(name).success).toBe(false);
  });

  it('nem szöveges értéket elutasít', () => {
    expect(SkillNameSchema.safeParse(42).success).toBe(false);
  });
});
