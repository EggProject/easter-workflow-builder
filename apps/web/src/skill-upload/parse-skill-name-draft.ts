import { SkillNameSchema } from '@easter-workflow-builder/protocol';

/**
 * A skill név mezőjének szövegéből a feltöltendő név, vagy `undefined`, ha a
 * szöveg nem felel meg a névszabálynak (SPEC-009 5.4 5. pont, AC11). A
 * szabály a `protocol` `SkillNameSchema` sémája, ugyanaz, amin a szerver a
 * `PUT` és a `DELETE /api/skills/:name` útvonal paraméterét ellenőrzi; a
 * mező körüli szóközöket a mező eldobja, a szerver pontosan azt a nevet
 * kapja, amit a séma elfogadott.
 */
export function parseSkillNameDraft(draft: string): string | undefined {
  const parsed = SkillNameSchema.safeParse(draft.trim());
  return parsed.success ? parsed.data : undefined;
}
