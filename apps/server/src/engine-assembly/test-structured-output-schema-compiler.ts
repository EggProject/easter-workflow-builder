import { createServerLogger } from '@easter-workflow-builder/logger';
import { createStructuredOutputSchemaCompiler } from './create-structured-output-schema-compiler.ts';

/**
 * A strukturált kimenet fordítója azoknak a teszteknek, amelyek a teljes
 * kezelő rekordot felépítik (`buildRouteHandlers`): a valódi fordító, eldobott
 * naplósorokkal. Kizárólag tesztek használják (a `TEST_SKILL_LIBRARY`
 * mintájára).
 */
function discardLogLine(): void {
  // szándékosan üres: a tesztek nem a fordító naplóját vizsgálják
}

export const TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER = createStructuredOutputSchemaCompiler(
  createServerLogger({ secretValues: [] }, { write: discardLogLine }),
);
