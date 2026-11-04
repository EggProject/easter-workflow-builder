import { z } from 'zod';

/**
 * A CEL kifejezés nyelvű szkript beállítása (SPEC-014 5.3), a `packages/db`
 * `expression-script-config.ts` mirror sémája.
 */
export const ExpressionScriptConfigSchema = z
  .strictObject({
    source: z.string(),
    runtime: z.literal('expression'),
  })
  .readonly();

export type ExpressionScriptConfig = z.infer<typeof ExpressionScriptConfigSchema>;
