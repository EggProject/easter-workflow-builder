import { z } from 'zod';

/**
 * A `script` node és a `join` node `script` módjának közös beállítása, a
 * `packages/db` `script-config.ts` mirror sémája.
 */
export const ScriptConfigSchema = z
  .strictObject({
    source: z.string(),
    runtime: z.literal('expression'),
  })
  .readonly();

export type ScriptConfig = z.infer<typeof ScriptConfigSchema>;
