import { z } from 'zod';

/**
 * A skill könyvtár egy eleme (SPEC-009 5.1 és 5.3): `GET /api/skills` egy
 * sora és a `PUT /api/skills/:name` sikeres válasza. A `name` a tárolt,
 * puszta név (a könyvtárnév, O-12), a `description` a `SKILL.md`
 * frontmatteréből jön (egy kívülről elrontott könyvtárnál üres szöveg), a
 * `sizeBytes` a skill fájljainak összmérete, a `modifiedAtMs` a skill
 * könyvtárának módosítási ideje, epoch ezredmásodpercben (a `WorkflowRecord`
 * `updatedAtMs` mintája).
 */
export const SkillSummarySchema = z
  .strictObject({
    name: z.string(),
    description: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    modifiedAtMs: z.number(),
  })
  .readonly();

export type SkillSummary = z.infer<typeof SkillSummarySchema>;
