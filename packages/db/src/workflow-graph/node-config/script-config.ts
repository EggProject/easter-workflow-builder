import type { ExpressionScriptConfig } from './expression-script-config.ts';
import type { JavaScriptScriptConfig } from './javascript-script-config.ts';

/**
 * A `script` node és a `join` node `script` módjának közös beállítása
 * (SPEC-003 4.3, SPEC-014 5.3): a `runtime` szerinti diszkriminált unió. A
 * `runtime` neve nem változik: az `expression` a CEL kifejezés nyelv (SPEC-010).
 */
export type ScriptConfig = ExpressionScriptConfig | JavaScriptScriptConfig;
