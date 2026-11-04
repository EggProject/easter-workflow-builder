import type { Logger } from 'ajv';
import type { StructuredOutputSchemaLogger } from './structured-output-schema-logger.ts';

const AJV_LOG_MESSAGE = 'A strukturált kimenet sémájának fordítója (Ajv) üzenetet adott.';

/**
 * Az Ajv `logger` opciójának értéke (Ajv `Options.logger`, alapból a
 * `console`): a fordító üzenetei a projekt naplózójába kerülnek, nem a szerver
 * konzoljára. A strict mód figyelmeztetései (például a `strictTypes` és a
 * `strictTuples` alapértelmezett `"log"` módja) a `warn` metódusra jönnek
 * (`ajv/lib/compile/util.ts` `checkStrictMode`). A három metódus az azonos nevű
 * pino szintre képződik, a `log` az `info`-ra; a nyers argumentumok az `ajv`
 * mezőben állnak (SPEC-006 7.2, SPEC-015 5.2).
 */
export function createAjvLogger(logger: StructuredOutputSchemaLogger): Logger {
  return {
    log: (...ajvArguments: unknown[]) => {
      logger.info({ ajv: ajvArguments }, AJV_LOG_MESSAGE);
    },
    warn: (...ajvArguments: unknown[]) => {
      logger.warn({ ajv: ajvArguments }, AJV_LOG_MESSAGE);
    },
    error: (...ajvArguments: unknown[]) => {
      logger.error({ ajv: ajvArguments }, AJV_LOG_MESSAGE);
    },
  };
}
