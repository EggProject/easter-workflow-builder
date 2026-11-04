import { z } from 'zod';

// A dokumentált `name` szabály (SPEC-009 2.2 és 5.4 5. pont): kisbetű, szám és kötőjel, kötőjel nem áll
// az elején, a végén és kettesével (research 3.4: agentskills.io specifikáció, platform doksi).
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
// A platform doksi tiltott szavai (research 3.4, megerősítés 2).
const RESERVED_WORDS = ['anthropic', 'claude'] as const;

/**
 * A feltöltéskor megadott skill név (SPEC-009 5.4 5. pont, O-12): ez lesz a
 * skill könyvtárának neve, 1-64 karakter. A `PUT` és a `DELETE
 * /api/skills/:name` útvonal paramétere ezen a sémán megy át, a felület a
 * név mezőjét ugyanezzel ellenőrizheti; a szabály így egy helyen áll.
 */
export const SkillNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(SKILL_NAME_PATTERN)
  .refine((name) => RESERVED_WORDS.every((word) => !name.includes(word)));

export type SkillName = z.infer<typeof SkillNameSchema>;
