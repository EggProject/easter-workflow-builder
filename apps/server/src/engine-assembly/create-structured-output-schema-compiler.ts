import { compileStructuredOutputSchema } from '@easter-workflow-builder/agent';
import type { StructuredOutputSchemaCompilerPort } from '@easter-workflow-builder/engine';
import type { ServerLogger } from '@easter-workflow-builder/logger';

/**
 * A strukturált kimenet sémájának fordítója a szerver naplózójával (SPEC-015
 * 5.4, 5.7): az Ajv strict figyelmeztetései a `logger`-be kerülnek, nem a
 * konzolra. A motor portja (`buildEngineDependencies`) és a gráf mentésének
 * ellenőrzése (`buildRouteHandlers`) ugyanezt a függvényt kapja, tehát a
 * mentés, a futás indítása és a lépés kimenete ugyanazzal a fordítóval dönt.
 */
export function createStructuredOutputSchemaCompiler(logger: ServerLogger): StructuredOutputSchemaCompilerPort {
  return { compile: (schema) => compileStructuredOutputSchema(schema, logger) };
}
