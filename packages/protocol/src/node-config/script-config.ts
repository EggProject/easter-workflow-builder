import { z } from 'zod';
import { ExpressionScriptConfigSchema } from './expression-script-config.ts';
import { JavaScriptScriptConfigSchema } from './javascript-script-config.ts';

/**
 * A `script` node és a `join` node `script` módjának közös beállítása, a
 * `packages/db` `script-config.ts` mirror sémája: a `runtime` szerinti
 * diszkriminált unió (SPEC-014 5.3).
 */
export const ScriptConfigSchema = z.discriminatedUnion('runtime', [
  ExpressionScriptConfigSchema,
  JavaScriptScriptConfigSchema,
]);

export type ScriptConfig = z.infer<typeof ScriptConfigSchema>;
